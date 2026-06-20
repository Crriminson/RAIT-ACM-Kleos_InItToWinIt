"""
api/routes/webhooks.py — Webhook endpoints for external integrations.

POST /api/v1/webhooks/whatsapp
    Accepts a webhook payload from the WhatsApp Business Cloud API,
    verifies the X-Hub-Signature-256 header, downloads the invoice image,
    runs the full OCR + matching pipeline, and returns a formatted reply.

GET  /api/v1/webhooks/whatsapp
    Hub verification — Meta sends a challenge token on subscription setup.

Security:
    - Signature verification via WHATSAPP_APP_SECRET (HMAC-SHA256).
    - media_url is validated against Meta's CDN domain before fetching.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import uuid
from datetime import datetime
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse
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

# ── Config ──────────────────────────────────────────────────────────────────
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "kleos-webhook-verify-2026")

ALLOWED_MEDIA_HOSTS = {
    "lookaside.fbsbx.com",
    "scontent.whatsapp.net",
    "mmg.whatsapp.net",
    "localhost",       # local dev / test_webhook.py
    "127.0.0.1",
}

# ── Signature verification ──────────────────────────────────────────────────

def _verify_signature(body: bytes, signature_header: str | None) -> None:
    """Verify X-Hub-Signature-256 from Meta.  Skipped when WHATSAPP_APP_SECRET
    is empty (local dev), but logs a warning so it's never silent."""
    if not WHATSAPP_APP_SECRET:
        log.warning("WHATSAPP_APP_SECRET not set — skipping signature verification (dev mode)")
        return
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing X-Hub-Signature-256 header")
    prefix = "sha256="
    if not signature_header.startswith(prefix):
        raise HTTPException(status_code=401, detail="Malformed signature header")
    expected = hmac.new(
        WHATSAPP_APP_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    received = signature_header[len(prefix):]
    if not hmac.compare_digest(expected, received):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def _validate_media_url(url: str) -> None:
    """Reject media_url that doesn't point at a known Meta CDN host."""
    parsed = urlparse(url)
    if parsed.hostname not in ALLOWED_MEDIA_HOSTS:
        raise HTTPException(
            status_code=400,
            detail=f"media_url host '{parsed.hostname}' is not an allowed Meta CDN domain",
        )


# ── Hub verification (GET) ──────────────────────────────────────────────────

@router.get(
    "/whatsapp",
    summary="WhatsApp webhook verification (hub challenge)",
)
async def whatsapp_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta sends a GET with hub.mode=subscribe, hub.verify_token, and
    hub.challenge.  Echo back the challenge if the token matches."""
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        log.info("WhatsApp webhook verified successfully")
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ── Webhook handler (POST) ──────────────────────────────────────────────────

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
    request: Request,
    payload: WhatsAppPayload,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Webhook endpoint for processing invoices from WhatsApp.
    1. Verifies X-Hub-Signature-256 (when WHATSAPP_APP_SECRET is configured)
    2. Validates media_url against allowed Meta CDN hosts
    3. Downloads the image, runs OCR → Extract → Match → Recommend
    4. Returns a formatted WhatsApp text reply
    """
    # ── 0. Verify signature ─────────────────────────────────────────────────
    body = await request.body()
    sig_header = request.headers.get("X-Hub-Signature-256")
    _verify_signature(body, sig_header)

    if not payload.media_url:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing media_url in payload. An invoice image is required."}
        )

    # ── 0b. Validate media_url host ─────────────────────────────────────────
    _validate_media_url(payload.media_url)

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
            raw_image_path=payload.media_url,
            ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=None,
            extraction_status="failed",
            extraction_error=exc.detail,
        )
        db.add(db_invoice)
        db.commit()

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
