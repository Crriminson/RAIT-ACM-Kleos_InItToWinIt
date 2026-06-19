"""
api/routes/verdicts.py — Verdict retrieval endpoints.

GET /api/v1/verdicts
    List all verdicts, sorted by ₹ ITC impact (highest first).
    Includes joined invoice and GSTR-2B record data.

GET /api/v1/verdicts/{verdict_id}
    Single verdict with full detail.

These endpoints return data shaped to be consumable by the React Native
app's DiagnosisResult type (app/src/data/types.ts).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from models.gstr2b import GSTR2BRecord
from models.invoice import Invoice
from models.verdict import Verdict

log = logging.getLogger(__name__)

router = APIRouter(prefix="/verdicts", tags=["verdicts"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Maps backend MismatchType reason_codes → app's DiagnosisResult.type values.
_TYPE_MAP = {
    "MISSING_TRANSACTION": "missing_transaction",
    "HSN_MISMATCH":        "hsn_mismatch",
    "RATE_MISMATCH":       "rate_mismatch",
    "TAX_AMOUNT_DELTA":    "rate_mismatch",   # app groups both under rate_mismatch
    "POS_MISMATCH":        "pos_mismatch",
    "BLOCKED_CREDIT_17_5": "blocked_credit_17_5",
    "CLEAN_MATCH":         "clean_match",
}

# Maps backend action → app ImsAction enum values.
_IMS_ACTION_MAP = {
    "ACCEPT": "ACCEPT",
    "REJECT": "NOT_ON_IMS_YET",  # REJECT in our engine = supplier hasn't filed correctly
    "HOLD":   "HOLD",
}

# Maps backend action → app Severity values.
_SEVERITY_MAP = {
    "ACCEPT": "resolved",
    "REJECT": "blocked",
    "HOLD":   "pending",
}


def _verdict_to_dict(
    verdict: Verdict,
    invoice: Optional[Invoice] = None,
    gstr2b: Optional[GSTR2BRecord] = None,
    *,
    include_detail: bool = False,
) -> dict:
    """
    Serialize a Verdict row into the JSON shape the app expects.

    Mirrors DiagnosisResult from app/src/data/types.ts:
        id, severity, amount, reason_hi, reason_en, action_hi, action_en,
        supplierName, invoiceNumber, invoiceDate, type, imsAction
    """
    fields = (invoice.extracted_fields or {}) if invoice else {}
    supplier_name = fields.get("supplier_name", "") or ""
    supplier_gstin = fields.get("supplier_gstin", "") or ""
    invoice_number = fields.get("invoice_number", "") or ""
    invoice_date = fields.get("invoice_date", "") or ""

    severity = _SEVERITY_MAP.get(verdict.action, "pending")
    diagnosis_type = _TYPE_MAP.get(verdict.reason_code, "rate_mismatch")
    ims_action = _IMS_ACTION_MAP.get(verdict.action, "HOLD")

    # Pull from Verdict (set by reason_texts.py during reconciliation)
    reason_en = verdict.reason_text_en or ""
    reason_hi = verdict.reason_text_hi or reason_en
    action_en = verdict.action_text_en or ""
    action_hi = verdict.action_text_hi or action_en

    result: dict = {
        "id": verdict.id,
        "severity": severity,
        "amount": abs(verdict.itc_impact_inr or 0.0),
        "reason_hi": reason_hi,
        "reason_en": reason_en,
        "action_hi": action_hi,
        "action_en": action_en,
        "tts_url_hi": verdict.tts_url_hi or "",
        "tts_url_en": verdict.tts_url_en or "",
        "supplierName": supplier_name or supplier_gstin,
        "invoiceNumber": invoice_number,
        "invoiceDate": invoice_date,
        "type": diagnosis_type,
        "imsAction": ims_action,
        "invoiceId": verdict.invoice_id,
        "is_recoverable": verdict.is_recoverable == "true",
        "confidence": verdict.confidence,
        "match_status": verdict.match_status,
        "itc_impact_inr": verdict.itc_impact_inr,
        "created_at": (
            verdict.created_at.isoformat() if verdict.created_at else None
        ),
    }

    # Full detail: include extracted fields + matched GSTR-2B record
    if include_detail:
        result["extracted_fields"] = fields
        if gstr2b:
            result["gstr2b_record"] = {
                "id": gstr2b.id,
                "supplier_gstin": gstr2b.supplier_gstin,
                "supplier_name": gstr2b.supplier_name,
                "invoice_number": gstr2b.invoice_number,
                "invoice_date": (
                    gstr2b.invoice_date.isoformat()
                    if gstr2b.invoice_date else None
                ),
                "taxable_value": gstr2b.taxable_value,
                "cgst": gstr2b.cgst,
                "sgst": gstr2b.sgst,
                "igst": gstr2b.igst,
                "total_tax": gstr2b.total_tax,
                "hsn_codes": gstr2b.hsn_codes,
                "place_of_supply": gstr2b.place_of_supply,
            }
        else:
            result["gstr2b_record"] = None

    return result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    summary="List all verdicts",
    response_description="Array of verdict objects sorted by ITC impact (highest first)",
)
async def list_verdicts(
    action: Optional[str] = Query(
        None,
        description="Filter by IMS action: ACCEPT, REJECT, or HOLD",
    ),
    limit: int = Query(
        200,
        ge=1,
        le=1000,
        description="Max number of verdicts to return",
    ),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Return all verdicts with joined invoice data.

    Sorted by absolute ITC impact descending (Assumption A12: highest ₹
    impact first) so the trader sees the most financially significant
    actions at the top.
    """
    query = db.query(Verdict)

    if action:
        action_upper = action.upper()
        if action_upper in ("ACCEPT", "REJECT", "HOLD"):
            query = query.filter(Verdict.action == action_upper)

    # Sort by absolute ITC impact descending
    verdicts = (
        query
        .order_by(func.abs(Verdict.itc_impact_inr).desc())
        .limit(limit)
        .all()
    )

    # Batch-load related invoices to avoid N+1 queries
    invoice_ids = [v.invoice_id for v in verdicts if v.invoice_id]
    invoices_map: dict[str, Invoice] = {}
    if invoice_ids:
        invoice_rows = (
            db.query(Invoice)
            .filter(Invoice.id.in_(invoice_ids))
            .all()
        )
        invoices_map = {inv.id: inv for inv in invoice_rows}

    results = []
    for v in verdicts:
        inv = invoices_map.get(v.invoice_id) if v.invoice_id else None
        results.append(_verdict_to_dict(v, inv))

    return JSONResponse(status_code=200, content={"verdicts": results})


@router.get(
    "/{verdict_id}",
    summary="Get a single verdict with full detail",
    response_description="Verdict object with extracted fields and matched GSTR-2B record",
)
async def get_verdict(
    verdict_id: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Return a single verdict by ID, including:
    - All extracted invoice fields
    - The matched GSTR-2B record (if any)
    - Mismatch detail and reason text
    """
    verdict = db.query(Verdict).filter(Verdict.id == verdict_id).first()
    if not verdict:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "verdict_not_found",
                "detail": f"No verdict found with id '{verdict_id}'.",
            },
        )

    invoice = (
        db.query(Invoice).filter(Invoice.id == verdict.invoice_id).first()
        if verdict.invoice_id
        else None
    )
    gstr2b = (
        db.query(GSTR2BRecord)
        .filter(GSTR2BRecord.id == verdict.gstr2b_record_id)
        .first()
        if verdict.gstr2b_record_id
        else None
    )

    result = _verdict_to_dict(verdict, invoice, gstr2b, include_detail=True)
    return JSONResponse(status_code=200, content=result)
