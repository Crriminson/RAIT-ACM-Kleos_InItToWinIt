"""
api/routes/webhooks.py — WhatsApp Business Cloud API integration.

GET  /api/v1/webhooks/whatsapp  — Hub verification (Meta subscription handshake)
POST /api/v1/webhooks/whatsapp  — Receives messages from Meta, processes invoice
                                  images, sends back verdict via Graph API.

Also supports the legacy simplified payload format for local testing
(test_webhook.py) when the request doesn't look like a Meta envelope.

Security:
    - HMAC-SHA256 signature verification via WHATSAPP_APP_SECRET.
    - Media downloaded only from Meta's Graph API (authenticated with token).

Env vars:
    WHATSAPP_ACCESS_TOKEN   — permanent or temporary token from Meta dashboard
    WHATSAPP_PHONE_ID       — phone number ID (not the phone number itself)
    WHATSAPP_APP_SECRET     — for X-Hub-Signature-256 verification
    WHATSAPP_VERIFY_TOKEN   — for hub challenge handshake
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime
from typing import Any

import httpx
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
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "kleos-webhook-verify-2026")

GRAPH_API = "https://graph.facebook.com/v21.0"


# ── Signature verification ──────────────────────────────────────────────────

def _verify_signature(body: bytes, signature_header: str | None) -> None:
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


# ── Graph API helpers ───────────────────────────────────────────────────────

async def _download_media(media_id: str) -> bytes:
    """Download media from Meta's Graph API using the media ID."""
    async with httpx.AsyncClient() as client:
        # Step 1: get the media URL
        meta = await client.get(
            f"{GRAPH_API}/{media_id}",
            headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
            timeout=10.0,
        )
        meta.raise_for_status()
        media_url = meta.json().get("url")
        if not media_url:
            raise RuntimeError(f"No URL in media response for {media_id}")

        # Step 2: download the actual bytes (Meta CDN, requires auth)
        resp = await client.get(
            media_url,
            headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.content


async def _send_reply(to: str, text: str) -> None:
    """Send a text message back to the user via WhatsApp Cloud API."""
    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_ID:
        log.warning("WHATSAPP_ACCESS_TOKEN/PHONE_ID not set — reply not sent (dev mode)")
        return

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{GRAPH_API}/{WHATSAPP_PHONE_ID}/messages",
            headers={
                "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"preview_url": False, "body": text},
            },
            timeout=10.0,
        )
        if r.status_code >= 400:
            log.error("Failed to send WhatsApp reply: %s %s", r.status_code, r.text)
        else:
            log.info("WhatsApp reply sent to %s", to)


async def _mark_read(message_id: str) -> None:
    """Mark the incoming message as read (blue ticks)."""
    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_ID:
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{GRAPH_API}/{WHATSAPP_PHONE_ID}/messages",
            headers={
                "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id,
            },
            timeout=5.0,
        )


# ── Parse Meta's nested webhook payload ─────────────────────────────────────

def _extract_message(payload: dict[str, Any]) -> tuple[str, str, str | None, str | None] | None:
    """Extract (from_number, message_id, media_id, text) from Meta's webhook.
    Returns None if this isn't a user message (e.g. status update)."""
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            if not messages:
                continue
            msg = messages[0]
            from_number = msg.get("from", "")
            message_id = msg.get("id", "")
            msg_type = msg.get("type", "")

            if msg_type == "image":
                media_id = msg.get("image", {}).get("id")
                caption = msg.get("image", {}).get("caption", "")
                return (from_number, message_id, media_id, caption)
            elif msg_type == "document":
                media_id = msg.get("document", {}).get("id")
                return (from_number, message_id, media_id, "")
            elif msg_type == "text":
                text = msg.get("text", {}).get("body", "")
                return (from_number, message_id, None, text)

    return None


# ── Pipeline (shared by both Meta and legacy payloads) ──────────────────────

async def _run_pipeline(image_bytes: bytes, db: Session) -> str:
    """Run OCR → Extract → Match → Recommend and return a formatted reply."""
    invoice_id = str(uuid.uuid4())

    # OCR
    try:
        raw_ocr = extract_text(image_bytes)
    except Exception:
        return "⚠️ Sorry, we couldn't read the image you sent. Please send a clearer photo of the invoice."

    # Extract
    try:
        extracted = extract_invoice(raw_ocr)
    except ExtractionError:
        return "⚠️ We couldn't find all required fields (like GSTIN or invoice number) in the image. Please ensure the full invoice is visible."

    # Load GSTR-2B
    gstr2b_records = _load_gstr2b(db, None)
    if not gstr2b_records:
        return "⚠️ You haven't imported your GSTR-2B data for this month yet. Please import it in the app first."

    # Match + Recommend
    match_result = match_invoice(extracted, gstr2b_records)
    verdict = recommend(match_result, extracted)

    # Persist (best-effort)
    try:
        db_invoice = Invoice(
            id=invoice_id, uploaded_at=datetime.utcnow(), source="whatsapp",
            raw_image_path="whatsapp-media", ocr_raw_output={"token_count": len(raw_ocr.tokens)},
            extracted_fields=extracted.to_dict(), extraction_status="success", extraction_error=None,
        )
        db.add(db_invoice)
        db.flush()
        gstr2b_id = match_result.matched_record.id if match_result.matched_record else None
        db_verdict = Verdict(
            id=str(uuid.uuid4()), invoice_id=invoice_id, gstr2b_record_id=gstr2b_id,
            action=verdict.action, reason_code=verdict.reason_code,
            reason_text_en=verdict.reason_text_en, itc_impact_inr=verdict.itc_impact_inr,
            confidence=verdict.confidence,
            match_status="matched" if match_result.matched_record else "unmatched",
            created_at=datetime.utcnow(),
        )
        db.add(db_verdict)
        db.commit()
    except Exception:
        db.rollback()

    # Format reply
    sev = verdict.severity
    emoji = "🔴" if sev == "blocked" else ("🟡" if sev == "pending" else "🟢")
    amount = f"₹{round(abs(verdict.itc_impact_inr)):,}"
    status_word = "ITC blocked" if sev == "blocked" else ("needs follow-up" if sev == "pending" else "matched")

    reply = (
        f"🧾 *{verdict.supplier_name}* · {verdict.invoice_number}\n"
        f"{emoji} {amount} {status_word}\n\n"
        f"{verdict.reason_text_en}\n\n"
    )
    if sev != "resolved":
        reply += f"👉 *{verdict.action}*: {verdict.action_text_en}\n\n"
    reply += "⚠️ _This is a recommendation — take the action yourself on the IMS portal._"
    return reply


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
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        log.info("WhatsApp webhook verified successfully")
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ── Webhook handler (POST) ──────────────────────────────────────────────────

GREETING = (
    "Namaste! 👋 I'm *CA in Your Pocket*.\n\n"
    "Send me a photo of any GST invoice and I'll check if your ITC is at risk.\n\n"
    "📸 _Just send an invoice image to get started._"
)

@router.post(
    "/whatsapp",
    summary="WhatsApp Cloud API webhook — receives and processes invoice images",
)
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> JSONResponse:
    # ── 0. Verify signature ─────────────────────────────────────────────────
    body = await request.body()
    sig_header = request.headers.get("X-Hub-Signature-256")
    _verify_signature(body, sig_header)

    import json as _json
    try:
        payload = _json.loads(body)
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    # ── 1. Parse Meta's webhook format ──────────────────────────────────────
    # Support both Meta's real format and legacy test format.
    parsed = _extract_message(payload)

    if parsed is None:
        # Could be a status update or a legacy test payload
        if "message_id" in payload and "media_url" in payload:
            # Legacy test format — download directly
            media_url = payload["media_url"]
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(media_url, timeout=10.0)
                    resp.raise_for_status()
                    image_bytes = resp.content
            except Exception as exc:
                return JSONResponse(status_code=400, content={"error": str(exc)})
            reply = await _run_pipeline(image_bytes, db)
            return JSONResponse(status_code=200, content={"reply": reply})

        # Status update or unrecognized — acknowledge
        return JSONResponse(status_code=200, content={"status": "ok"})

    from_number, message_id, media_id, text = parsed

    # Mark as read immediately
    await _mark_read(message_id)

    # ── 2. Handle text messages (no image) ──────────────────────────────────
    if not media_id:
        await _send_reply(from_number, GREETING)
        return JSONResponse(status_code=200, content={"status": "greeting_sent"})

    # ── 3. Download image from Meta Graph API ───────────────────────────────
    try:
        image_bytes = await _download_media(media_id)
    except Exception as exc:
        log.error("Failed to download media %s: %s", media_id, exc)
        await _send_reply(from_number, "⚠️ Couldn't download the image. Please try sending it again.")
        return JSONResponse(status_code=200, content={"status": "media_download_failed"})

    # ── 4. Run the full pipeline ────────────────────────────────────────────
    reply = await _run_pipeline(image_bytes, db)

    # ── 5. Send reply back via WhatsApp ─────────────────────────────────────
    await _send_reply(from_number, reply)

    return JSONResponse(status_code=200, content={"status": "reply_sent", "reply": reply})
