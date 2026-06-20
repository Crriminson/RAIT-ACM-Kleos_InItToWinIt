"""
api/routes/invoices.py — Invoice OCR → extract → match → recommend endpoint.

POST /api/v1/invoices/analyze
    Accepts a multipart invoice image, runs the full pipeline, persists
    an Invoice + Verdict row, and returns a VerdictPayload JSON.

Error responses (never bare 500):
    400  — invalid/unreadable image
    404  — no GSTR-2B records found for the period
    422  — ExtractionError (includes field + reason + detail)
    500  — unexpected pipeline error (typed, with error_id for logging)
"""
from __future__ import annotations

import io
import logging
import os
import tempfile
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

limiter = Limiter(key_func=get_remote_address)

from api.deps import get_db
from core.extractor import extract_invoice
from core.matcher import match_invoice
from core.ocr import extract_text
from core.recommender import recommend
from models.extraction import ExtractionError
from models.gstr2b import GSTR2BRecord
from models.invoice import Invoice
from models.verdict import Verdict

log = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["invoices"])

# Supported upload MIME types
_ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/jpg",
    "image/webp", "image/bmp", "image/tiff",
}


# ---------------------------------------------------------------------------
# Helper: load GSTR-2B records for a period
# ---------------------------------------------------------------------------

def _load_gstr2b(db: Session, period: Optional[str]) -> list[GSTR2BRecord]:
    """
    Return all GSTR-2B records from the DB.
    If *period* is provided (format: MMYYYY, e.g. "052026"), filter by date.
    """
    query = db.query(GSTR2BRecord)
    if period and len(period) == 6:
        try:
            month = int(period[:2])
            year  = int(period[2:])
            from sqlalchemy import extract
            query = query.filter(
                extract("month", GSTR2BRecord.invoice_date) == month,
                extract("year",  GSTR2BRecord.invoice_date) == year,
            )
        except ValueError:
            pass  # Ignore malformed period — fall through to all records
    return query.all()


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    summary="Analyze an invoice image against GSTR-2B",
    response_description="Verdict payload with action, reason, and ITC impact",
)
@limiter.limit("20/minute")
async def analyze_invoice(
    request: Request,
    file: UploadFile = File(..., description="Invoice image (PNG/JPEG/WebP)"),
    gstr2b_period: Optional[str] = Form(
        None,
        description="MMYYYY period filter, e.g. '052026'.  Leave blank to match against all loaded records.",
    ),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Full pipeline: upload → OCR → extract → match → recommend → persist.

    Returns
    -------
    200 OK — VerdictPayload JSON
    400    — unreadable image
    404    — no GSTR-2B records in DB / for the given period
    422    — field extraction failed (includes which field and why)
    500    — unexpected internal error
    """

    # ── 1. Validate upload ───────────────────────────────────────────────────
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in _ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "unsupported_file_type",
                "detail": (
                    f"Received '{content_type}'. "
                    "Supported types: PNG, JPEG, WebP, BMP, TIFF."
                ),
            },
        )

    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"error": "file_too_large", "detail": f"Upload exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB limit."},
        )
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "empty_file", "detail": "Uploaded file is empty."},
        )

    # ── 2. Save raw image (for audit trail) ──────────────────────────────────
    invoice_id = str(uuid.uuid4())
    upload_dir = os.getenv("UPLOAD_DIR", "/tmp/kleos_uploads")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "invoice.png")[-1] or ".png"
    raw_path = os.path.join(upload_dir, f"{invoice_id}{ext}")
    with open(raw_path, "wb") as fh:
        fh.write(image_bytes)

    # ── 3. OCR ───────────────────────────────────────────────────────────────
    try:
        raw_ocr = extract_text(image_bytes)
    except Exception as exc:
        log.exception("OCR failed for invoice %s", invoice_id)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "ocr_failed",
                "detail": f"Could not read image: {exc}",
                "invoice_id": invoice_id,
            },
        )

    # ── 4. Extract structured fields ─────────────────────────────────────────
    try:
        extracted = extract_invoice(raw_ocr)
    except ExtractionError as exc:
        # Persist a failed Invoice row for audit
        db_invoice = Invoice(
            id=invoice_id,
            uploaded_at=datetime.utcnow(),
            source="upload",
            raw_image_path=raw_path,
            ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=None,
            extraction_status="failed",
            extraction_error=exc.detail,
        )
        db.add(db_invoice)
        db.commit()

        raise HTTPException(
            status_code=422,
            detail=exc.to_dict(),
        )

    # ── 5. Load GSTR-2B records ───────────────────────────────────────────────
    gstr2b_records = _load_gstr2b(db, gstr2b_period)
    if not gstr2b_records:
        period_hint = f" for period '{gstr2b_period}'" if gstr2b_period else ""
        raise HTTPException(
            status_code=404,
            detail={
                "error": "no_gstr2b_records",
                "detail": (
                    f"No GSTR-2B records found{period_hint}. "
                    "Run scripts/load_dummy_dataset.py to seed the database."
                ),
            },
        )

    # ── 6. Match ─────────────────────────────────────────────────────────────
    match_result = match_invoice(extracted, gstr2b_records)

    # ── 7. Recommend ─────────────────────────────────────────────────────────
    verdict_payload = recommend(match_result, extracted)

    # ── 8. Persist Invoice + Verdict rows ─────────────────────────────────────
    try:
        db_invoice = Invoice(
            id=invoice_id,
            uploaded_at=datetime.utcnow(),
            source="upload",
            raw_image_path=raw_path,
            ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=extracted.to_dict(),
            extraction_status="success",
            extraction_error=None,
        )
        db.add(db_invoice)
        db.flush()  # get the ID before creating the Verdict FK

        gstr2b_id = match_result.matched_record.id if match_result.matched_record else None

        db_verdict = Verdict(
            id=str(uuid.uuid4()),
            invoice_id=invoice_id,
            gstr2b_record_id=gstr2b_id,
            action=verdict_payload.action,
            reason_code=verdict_payload.reason_code,
            reason_text_en=verdict_payload.reason_text,
            itc_impact_inr=verdict_payload.itc_impact_inr,
            confidence=verdict_payload.confidence,
            match_status="matched" if match_result.matched_record else "unmatched",
            created_at=datetime.utcnow(),
        )
        db.add(db_verdict)
        db.commit()

    except Exception as exc:
        db.rollback()
        error_id = str(uuid.uuid4())
        log.exception("DB persistence failed [error_id=%s]", error_id)
        # Return the verdict anyway — persistence failure must not block the trader
        return JSONResponse(
            status_code=200,
            content={
                **verdict_payload.to_dict(),
                "_warning": f"Result could not be persisted (error_id={error_id})",
            },
        )

    return JSONResponse(status_code=200, content=verdict_payload.to_dict())
