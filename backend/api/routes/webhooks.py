"""
api/routes/webhooks.py — Webhook endpoints for external integrations.

POST /api/v1/webhooks/whatsapp
    Accepts a webhook payload from a simulated WhatsApp integration, downloads the 
    invoice image, runs the full OCR + matching pipeline, and returns a formatted
    WhatsApp text reply.
"""
from __future__ import annotations

import logging
import uuid
import httpx
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api.deps import get_db
from api.routes.invoices import _load_gstr2b
from core.extractor import extract_invoice
from core.matcher import match_invoice
from core.ocr import extract_text
from core.recommender import recommend
from models.extraction import ExtractionError
from models.invoice import Invoice
from models.verdict import Verdict

log = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

class WhatsAppPayload(BaseModel):
    message_id: str
    from_number: str
    media_url: str
    text: str = ""

@router.post(
    "/whatsapp",
    summary="Process an invoice sent via WhatsApp webhook",
    response_description="Formatted WhatsApp text response containing the diagnosis",
)
async def whatsapp_webhook(
    payload: WhatsAppPayload,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Webhook endpoint to simulate processing an invoice from WhatsApp.
    1. Downloads the image from media_url
    2. Runs OCR -> Extract -> Match -> Recommend pipeline
    3. Formats and returns a plain-text WhatsApp response
    """
    if not payload.media_url:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing media_url in payload. An invoice image is required."}
        )

    # ── 1. Download image ────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(payload.media_url, timeout=10.0)
            resp.raise_for_status()
            image_bytes = resp.content
    except Exception as exc:
        log.error("Failed to download media from %s: %s", payload.media_url, exc)
        return JSONResponse(
            status_code=400,
            content={"error": "Failed to download image from media_url", "detail": str(exc)}
        )

    invoice_id = str(uuid.uuid4())
    
    # ── 2. OCR ───────────────────────────────────────────────────────────────
    try:
        raw_ocr = extract_text(image_bytes)
    except Exception as exc:
        log.exception("OCR failed for whatsapp invoice %s", invoice_id)
        reply = "⚠️ Sorry, we couldn't read the image you sent. Please send a clearer photo of the invoice."
        return JSONResponse(status_code=200, content={"reply": reply})

    # ── 3. Extract structured fields ─────────────────────────────────────────
    try:
        extracted = extract_invoice(raw_ocr)
    except ExtractionError as exc:
        db_invoice = Invoice(
            id=invoice_id,
            uploaded_at=datetime.utcnow(),
            source="whatsapp",
            raw_image_path=payload.media_url, # using url as path for audit
            ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=None,
            extraction_status="failed",
            extraction_error=exc.detail,
        )
        db.add(db_invoice)
        db.commit()

        # In WhatsApp, we just tell the user we couldn't read key fields
        reply = "⚠️ We couldn't find all required fields (like GSTIN or invoice number) in the image. Please ensure the full invoice is visible."
        return JSONResponse(status_code=200, content={"reply": reply})

    # ── 4. Load GSTR-2B records ──────────────────────────────────────────────
    gstr2b_records = _load_gstr2b(db, None)
    if not gstr2b_records:
        reply = "⚠️ You haven't imported your GSTR-2B data for this month yet. Please import it in the app before checking invoices."
        return JSONResponse(status_code=200, content={"reply": reply})

    # ── 5. Match ─────────────────────────────────────────────────────────────
    match_result = match_invoice(extracted, gstr2b_records)

    # ── 6. Recommend ─────────────────────────────────────────────────────────
    verdict_payload = recommend(match_result, extracted)

    # ── 7. Persist Invoice + Verdict rows ────────────────────────────────────
    try:
        db_invoice = Invoice(
            id=invoice_id,
            uploaded_at=datetime.utcnow(),
            source="whatsapp",
            raw_image_path=payload.media_url,
            ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=extracted.to_dict(),
            extraction_status="success",
            extraction_error=None,
        )
        db.add(db_invoice)
        db.flush()

        gstr2b_id = match_result.matched_record.id if match_result.matched_record else None

        db_verdict = Verdict(
            id=str(uuid.uuid4()),
            invoice_id=invoice_id,
            gstr2b_record_id=gstr2b_id,
            action=verdict_payload.action,
            reason_code=verdict_payload.reason_code,
            reason_text_en=verdict_payload.reason_text_en,
            itc_impact_inr=verdict_payload.itc_impact_inr,
            confidence=verdict_payload.confidence,
            match_status="matched" if match_result.matched_record else "unmatched",
            created_at=datetime.utcnow(),
        )
        db.add(db_verdict)
        db.commit()
    except Exception as exc:
        db.rollback()
        log.exception("DB persistence failed for whatsapp invoice")

    # ── 8. Format WhatsApp Reply ─────────────────────────────────────────────
    # Emoji based on severity
    sev = verdict_payload.severity
    emoji = "🔴" if sev == "blocked" else ("🟡" if sev == "pending" else "🟢")
    
    amount = f"₹{round(abs(verdict_payload.itc_impact_inr)):,}"
    
    if sev == "blocked":
        status_word = "ITC blocked"
    elif sev == "pending":
        status_word = "needs follow-up"
    else:
        status_word = "matched"

    reply_text = (
        f"🧾 *{verdict_payload.supplier_name}* · {verdict_payload.invoice_number}\n"
        f"{emoji} {amount} {status_word}\n\n"
        f"{verdict_payload.reason_text_en}\n\n"
    )
    
    if sev != "resolved":
        reply_text += f"👉 *{verdict_payload.action}*: {verdict_payload.action_text_en}\n\n"
        
    reply_text += "⚠️ _This is a recommendation — take the action yourself on the IMS portal._"

    return JSONResponse(status_code=200, content={
        "reply": reply_text,
        "verdict_data": verdict_payload.to_dict()
    })
