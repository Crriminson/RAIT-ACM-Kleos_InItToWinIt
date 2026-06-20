"""
api/routes/analyze_compat.py  ─  App-compatible OCR route

The React Native app sends:
    POST /api/analyze-invoice
    Content-Type: application/json
    { "base64Data": "<base64 string>", "mimeType": "image/png", "fileName": "scan.png" }

And expects back:
    { "method": "fallback", "data": { "supplierName", "supplierGSTIN",
      "invoiceNumber", "invoiceDate", "taxableValue", "totalTax", "items" } }

This route acts as an adapter:
  1. Decodes the base64 image
  2. Runs the full OCR → extract → match → recommend pipeline
  3. Returns the ExtractedInvoiceData shape the app expects

The app's matching engine (matching-engine.ts) runs client-side, so we only
need to return the extracted fields — the verdict from recommend() is attached
as extra metadata the app ignores gracefully.

If extraction fails, we return a best-effort empty shell so the app can fall
back to mock data rather than hard-crashing.
"""
from __future__ import annotations

import base64
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

limiter = Limiter(key_func=get_remote_address)

from api.deps import get_db
from core import gemini
from core.extractor import extract_invoice
from core.matcher import match_invoice
from core.ocr import extract_text
from core.recommender import recommend
from models.extraction import ExtractionError
from models.gstr2b import GSTR2BRecord

log = logging.getLogger(__name__)

router = APIRouter(tags=["app-compat"])

# Vision prompt for Gemini-based extraction (mirrors the previous Node server).
_VISION_PROMPT = (
    "You are an expert Indian Chartered Accountant (CA) and tax audit bot.\n"
    "Extract all relevant details from this Indian GST invoice and return ONLY JSON "
    "with this exact shape:\n"
    '{ "supplierName": str, "supplierGSTIN": str (15 chars), "invoiceNumber": str, '
    '"invoiceDate": str (YYYY-MM-DD), "taxableValue": number, "totalTax": number, '
    '"items": [ { "description": str, "hsnCode": str, "taxableValue": number, '
    '"taxRate": integer percent (e.g. 18/12/5), "taxAmount": number } ] }\n'
    "totalTax is the sum of CGST/SGST/IGST. Be careful even if the image is "
    "low-resolution, skewed, or rotated. If an HSN code is not clearly listed, "
    "deduce the closest match from the description."
)


def _num(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _normalise_vision(data: dict[str, Any]) -> dict[str, Any]:
    """Coerce Gemini's JSON into the exact ExtractedInvoiceData shape the app expects."""
    items = []
    for it in (data.get("items") or []):
        if not isinstance(it, dict):
            continue
        items.append({
            "description":  str(it.get("description", "") or ""),
            "hsnCode":      str(it.get("hsnCode", "") or ""),
            "taxableValue": _num(it.get("taxableValue")),
            "taxRate":      _num(it.get("taxRate")),
            "taxAmount":    _num(it.get("taxAmount")),
        })
    return {
        "supplierName":  str(data.get("supplierName", "") or ""),
        "supplierGSTIN": str(data.get("supplierGSTIN", "") or "").strip().upper(),
        "invoiceNumber": str(data.get("invoiceNumber", "") or ""),
        "invoiceDate":   str(data.get("invoiceDate", "") or ""),
        "taxableValue":  _num(data.get("taxableValue")),
        "totalTax":      _num(data.get("totalTax")),
        "items":         items,
    }

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AnalyzeInvoiceRequest(BaseModel):
    base64Data: str = Field(..., description="Base64-encoded image bytes")
    mimeType: str   = Field("image/jpeg", description="MIME type of the image")
    fileName: str   = Field("invoice.jpg", description="Original filename")


# Shape the app expects back (mirrors ExtractedInvoiceData in api/ai.ts)
def _build_extracted_data(extracted) -> dict[str, Any]:
    """Map ExtractedInvoice → ExtractedInvoiceData (app shape)."""
    total_cgst = extracted.cgst or 0.0
    total_sgst = extracted.sgst or 0.0
    total_igst = extracted.igst or 0.0
    total_tax  = total_cgst + total_sgst + total_igst

    items = []
    for li in (extracted.line_items or []):
        item_tax = (li.cgst or 0) + (li.sgst or 0) + (li.igst or 0)
        items.append({
            "description":  li.description or "",
            "hsnCode":      li.hsn_code   or "",
            "taxableValue": li.taxable_value or 0.0,
            "taxRate":      li.tax_rate   or 0.0,
            "taxAmount":    item_tax,
        })

    # If no line items were extracted, synthesise one from header totals
    if not items and (extracted.taxable_value or 0) > 0:
        hsn = extracted.hsn_codes[0] if extracted.hsn_codes else ""
        items = [{
            "description":  extracted.supplier_name or "",
            "hsnCode":      hsn,
            "taxableValue": extracted.taxable_value or 0.0,
            "taxRate":      0.0,
            "taxAmount":    total_tax,
        }]

    return {
        "supplierName":  extracted.supplier_name  or "",
        "supplierGSTIN": extracted.supplier_gstin or "",
        "invoiceNumber": extracted.invoice_number or "",
        "invoiceDate":   extracted.invoice_date   or "",
        "taxableValue":  extracted.taxable_value  or 0.0,
        "totalTax":      total_tax,
        "items":         items,
    }


def _empty_extracted_data() -> dict[str, Any]:
    """Fallback shell so the app can use mock data instead of crashing."""
    return {
        "supplierName":  "",
        "supplierGSTIN": "",
        "invoiceNumber": "",
        "invoiceDate":   "",
        "taxableValue":  0.0,
        "totalTax":      0.0,
        "items":         [],
    }


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post(
    "/api/analyze-invoice",
    summary="Analyze invoice (app-compatible JSON endpoint)",
    response_description="Extracted invoice data in app format",
)
@limiter.limit("20/minute")
async def analyze_invoice_compat(
    request: Request,
    body: AnalyzeInvoiceRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    App-compatible endpoint used by the React Native client.

    Accepts base64 image JSON, runs OCR + extraction pipeline,
    and returns ExtractedInvoiceData in the shape api/ai.ts expects.
    """
    # 1. Decode base64 → bytes
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    try:
        raw_b64 = body.base64Data
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_base64", "detail": str(exc)},
        )

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_image", "detail": "Decoded image is empty."},
        )

    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"error": "file_too_large", "detail": f"Image exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB limit."},
        )

    # 2. Offline OCR pipeline (PRIMARY) — our own PaddleOCR + extractor.
    #    Deterministic, runs with no network/API dependency. If OCR or field
    #    extraction fails (unreadable/unusual invoice), we fall back to Gemini.
    extracted = None
    extraction_note: str | None = None
    try:
        raw_ocr   = extract_text(image_bytes)
        extracted = extract_invoice(raw_ocr)
    except ExtractionError as exc:
        extraction_note = exc.detail
        log.warning("Offline extraction failed (%s) — trying Gemini fallback", exc.detail)
    except Exception as exc:  # noqa: BLE001 — OCR engine error
        extraction_note = str(exc)
        log.warning("Offline OCR failed (%s) — trying Gemini fallback", exc)

    if extracted is not None:
        # Best-effort match + verdict (not required for the app flow).
        extra_meta: dict[str, Any] = {}
        try:
            gstr2b_records: list[GSTR2BRecord] = db.query(GSTR2BRecord).all()
            if gstr2b_records:
                match_result = match_invoice(extracted, gstr2b_records)
                verdict      = recommend(match_result, extracted)
                extra_meta   = {
                    "action":         verdict.action,
                    "severity":       verdict.severity,
                    "reason_code":    verdict.reason_code,
                    "itc_impact_inr": verdict.itc_impact_inr,
                }
        except Exception:
            log.exception("Match/recommend step failed in compat route (non-fatal)")

        return JSONResponse(status_code=200, content={
            "method": "paddleocr",        # our offline OCR + extractor
            "data":   _build_extracted_data(extracted),
            **extra_meta,
        })

    # 3. Gemini vision fallback — only when the offline pipeline couldn't read it.
    if gemini.has_key():
        try:
            vision = gemini.generate_json_from_image(
                _VISION_PROMPT, image_bytes, body.mimeType
            )
            return JSONResponse(status_code=200, content={
                "method":  "gemini",
                "data":    _normalise_vision(vision),
                "_offline_note": extraction_note,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning("Gemini vision fallback also failed: %s", exc)
            extraction_note = f"{extraction_note} | gemini: {exc}"

    # 4. Both paths failed — empty shell so the app uses its own mock and never crashes.
    return JSONResponse(status_code=200, content={
        "method": "fallback",
        "data":   _empty_extracted_data(),
        "_error": extraction_note,
    })
