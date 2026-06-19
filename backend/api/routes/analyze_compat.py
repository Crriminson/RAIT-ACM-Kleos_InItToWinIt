"""
api/routes/analyze_compat.py  --  App-compatible OCR route

The React Native app sends:
    POST /api/analyze-invoice
    Content-Type: application/json
    {
      "base64Data": "<base64 string>",
      "mimeType":   "image/png",
      "fileName":   "scan.png",
      "ocrText":    "<plain text from ML Kit>"   <- optional, on-device OCR
    }

And expects back:
    { "method": "mlkit"|"gemini"|"fallback", "data": { ... } }

OCR pipeline (primary -> fallback chain):
  1. ocrText provided (ML Kit ran on-device) -> parse fields directly (no server OCR)
  2. ocrText absent/empty                    -> Gemini vision with base64 image
  3. Both fail                               -> empty shell (app uses mock data)
"""
from __future__ import annotations

import base64
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_db
from core import gemini
from core.extractor import extract_invoice
from core.matcher import match_invoice
from core.recommender import recommend
from models.extraction import ExtractionError, OCRToken, RawOCRResult
from models.gstr2b import GSTR2BRecord

log = logging.getLogger(__name__)

router = APIRouter(tags=["app-compat"])

# Vision prompt for Gemini-based extraction (fallback when ML Kit text is unavailable).
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


def _text_to_raw_ocr_result(text: str) -> RawOCRResult:
    """
    Convert plain text (from ML Kit on-device OCR) into a RawOCRResult that
    the spatial field extractor can process.

    Since ML Kit does not return bounding boxes in the format our extractor
    expects, we synthesise tokens with layout coordinates that preserve the
    left-to-right, top-to-bottom reading order:
      - Each line gets a unique Y coordinate (row_height * line_index).
      - Each word within a line gets sequential X coordinates.
      - Confidence is set to 1.0 (ML Kit already filtered low-confidence text).

    This is enough for the regex + label-proximity extractor to locate
    GSTIN, invoice number, dates, and tax amounts on typical GST invoices.
    """
    ROW_HEIGHT = 24      # px between line centres (virtual)
    CHAR_WIDTH = 9       # px per character (proportional font approximation)
    MARGIN_X   = 10      # px left margin

    tokens: list[OCRToken] = []
    lines = text.splitlines()
    max_line_width = max((len(l) for l in lines if l.strip()), default=80) * CHAR_WIDTH

    for line_idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        cy = ROW_HEIGHT * line_idx + ROW_HEIGHT // 2
        y1 = cy - ROW_HEIGHT // 2
        y2 = cy + ROW_HEIGHT // 2

        # Tokenise by whitespace -- mirrors how PaddleOCR splits words
        words = line.split()
        x_cursor = float(MARGIN_X)
        for word in words:
            w = len(word) * CHAR_WIDTH
            tokens.append(OCRToken(
                text=word,
                confidence=1.0,          # ML Kit already high-confidence
                x1=x_cursor,
                y1=float(y1),
                x2=x_cursor + w,
                y2=float(y2),
            ))
            x_cursor += w + CHAR_WIDTH   # inter-word gap

    image_height = ROW_HEIGHT * (len(lines) + 1)
    return RawOCRResult(
        tokens=tokens,
        image_width=max(max_line_width, 800),
        image_height=max(image_height, 400),
        processing_time_ms=0.0,   # OCR happened on-device
    )


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class AnalyzeInvoiceRequest(BaseModel):
    base64Data: str           = Field(...,           description="Base64-encoded image bytes")
    mimeType:   str           = Field("image/jpeg",  description="MIME type of the image")
    fileName:   str           = Field("invoice.jpg", description="Original filename")
    ocrText:    Optional[str] = Field(None,          description="On-device ML Kit OCR text (primary path)")


def _build_extracted_data(extracted) -> dict[str, Any]:
    """Map ExtractedInvoice -> ExtractedInvoiceData (app shape)."""
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
async def analyze_invoice_compat(
    body: AnalyzeInvoiceRequest,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Primary path (ML Kit on-device OCR):
        Accepts ocrText (plain text from on-device ML Kit), synthesises OCR
        tokens, and runs the field extractor locally. Fast, no network needed.

    Fallback path (Gemini vision):
        When ocrText is absent or field extraction fails, uses Gemini vision
        to extract fields from the base64 image. Requires GEMINI_API_KEY.

    Last resort:
        Returns an empty shell so the app never hard-crashes.
    """
    extraction_note: str | None = None
    extracted = None

    # -- PRIMARY: ML Kit on-device OCR text ----------------------------------
    if body.ocrText and body.ocrText.strip():
        log.info("Using ML Kit on-device OCR text (%d chars)", len(body.ocrText))
        try:
            raw_ocr   = _text_to_raw_ocr_result(body.ocrText)
            extracted = extract_invoice(raw_ocr)
        except ExtractionError as exc:
            extraction_note = exc.detail
            log.warning("Field extraction from ML Kit text failed (%s) -- trying Gemini fallback", exc.detail)
        except Exception as exc:  # noqa: BLE001
            extraction_note = str(exc)
            log.warning("Unexpected error during ML Kit extraction (%s) -- trying Gemini fallback", exc)

        if extracted is not None:
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
                log.exception("Match/recommend step failed (non-fatal)")

            return JSONResponse(status_code=200, content={
                "method": "mlkit",
                "data":   _build_extracted_data(extracted),
                **extra_meta,
            })
    else:
        log.info("No ocrText provided -- going straight to Gemini vision fallback")

    # -- FALLBACK: Gemini vision ---------------------------------------------
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
            log.warning("Gemini vision fallback failed: %s", exc)
            extraction_note = f"{extraction_note} | gemini: {exc}"

    # -- TESSERACT FALLBACK (free, local) ------------------------------------
    try:
        from core.ocr_tesseract import extract_text_tesseract
        raw_b64 = body.base64Data
        raw_ocr = extract_text_tesseract(raw_b64)
        extracted = extract_invoice(raw_ocr)
        if extracted is not None:
            return JSONResponse(status_code=200, content={
                "method": "tesseract",
                "data": _build_extracted_data(extracted),
            })
    except Exception as exc:
        log.warning("Tesseract fallback failed: %s", exc)

    # -- LAST RESORT: empty shell --------------------------------------------
    return JSONResponse(status_code=200, content={
        "method": "fallback",
        "data":   _empty_extracted_data(),
        "_error": extraction_note,
    })
