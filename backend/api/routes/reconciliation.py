"""
api/routes/reconciliation.py — Batch reconciliation endpoint.

POST /api/v1/reconciliation/run
    Loads all successfully-extracted invoices from the DB, runs each through
    the match → recommend pipeline against the current GSTR-2B snapshot,
    and persists (upserts) a Verdict row per invoice.

    Re-running is idempotent: existing verdicts for the same invoice are
    replaced (the GSTR-2B snapshot may have changed since the last run).

GET /api/v1/reconciliation/status
    Quick check: how many invoices and verdicts exist, whether reconciliation
    has been run at least once.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from api.deps import get_db
from core.matcher import match_invoice
from core.recommender import recommend
from models.extraction import ExtractedInvoice, LineItem
from models.gstr2b import GSTR2BRecord
from models.invoice import Invoice
from models.verdict import Verdict

log = logging.getLogger(__name__)

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _reconstruct_extracted(fields: dict) -> ExtractedInvoice:
    """
    Rebuild an ExtractedInvoice dataclass from the JSON blob stored in
    Invoice.extracted_fields.  This is the inverse of ExtractedInvoice.to_dict().
    """
    line_items = []
    for li in (fields.get("line_items") or []):
        line_items.append(LineItem(
            hsn_code=li.get("hsn_code", ""),
            description=li.get("description", ""),
            quantity=li.get("quantity", 0.0),
            unit=li.get("unit", ""),
            taxable_value=li.get("taxable_value", 0.0),
            tax_rate=li.get("tax_rate", 0.0),
            cgst=li.get("cgst", 0.0),
            sgst=li.get("sgst", 0.0),
            igst=li.get("igst", 0.0),
        ))

    return ExtractedInvoice(
        supplier_gstin=fields.get("supplier_gstin", ""),
        supplier_name=fields.get("supplier_name", ""),
        invoice_number=fields.get("invoice_number", ""),
        invoice_date=fields.get("invoice_date", ""),
        taxable_value=fields.get("taxable_value", 0.0),
        cgst=fields.get("cgst", 0.0),
        sgst=fields.get("sgst", 0.0),
        igst=fields.get("igst", 0.0),
        hsn_codes=fields.get("hsn_codes", []),
        line_items=line_items,
    )


def _load_gstr2b(db: Session, period: Optional[str]) -> list[GSTR2BRecord]:
    """Return all GSTR-2B records, optionally filtered by MMYYYY period."""
    query = db.query(GSTR2BRecord)
    if period and len(period) == 6:
        try:
            month = int(period[:2])
            year = int(period[2:])
            from sqlalchemy import extract
            query = query.filter(
                extract("month", GSTR2BRecord.invoice_date) == month,
                extract("year", GSTR2BRecord.invoice_date) == year,
            )
        except ValueError:
            pass
    return query.all()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/run",
    summary="Run batch reconciliation on all extracted invoices",
    response_description="Reconciliation results summary",
)
async def run_reconciliation(
    period: Optional[str] = Query(
        None,
        description="MMYYYY period filter for GSTR-2B records (e.g. '052026'). "
                    "Leave blank to match against all loaded records.",
    ),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Batch reconciliation: match every extracted invoice against GSTR-2B,
    generate verdicts, and persist them.

    Idempotent — existing verdicts for the same invoice_id are replaced.

    Returns
    -------
    200 OK — { invoices_processed, verdicts_created, skipped, summary }
    404    — no invoices or no GSTR-2B records found
    """
    # 1. Load all successfully-extracted invoices
    invoices = (
        db.query(Invoice)
        .filter(Invoice.extraction_status == "success")
        .filter(Invoice.extracted_fields.isnot(None))
        .all()
    )
    if not invoices:
        return JSONResponse(
            status_code=404,
            content={
                "error": "no_invoices",
                "detail": "No successfully-extracted invoices found in the database. "
                          "Upload and process invoices first via POST /api/v1/invoices/analyze "
                          "or POST /api/analyze-invoice.",
            },
        )

    # 2. Load GSTR-2B records
    gstr2b_records = _load_gstr2b(db, period)
    if not gstr2b_records:
        period_hint = f" for period '{period}'" if period else ""
        return JSONResponse(
            status_code=404,
            content={
                "error": "no_gstr2b_records",
                "detail": f"No GSTR-2B records found{period_hint}. "
                          "Run scripts/load_dummy_dataset.py to seed the database.",
            },
        )

    # 3. Run match → recommend for each invoice, upsert Verdict rows
    verdicts_created = 0
    skipped = 0
    action_counts = {"ACCEPT": 0, "REJECT": 0, "HOLD": 0}
    itc_safe = 0.0
    itc_at_risk = 0.0

    for inv in invoices:
        try:
            extracted = _reconstruct_extracted(inv.extracted_fields)
        except Exception as exc:
            log.warning(
                "Could not reconstruct extraction for invoice %s: %s",
                inv.id, exc,
            )
            skipped += 1
            continue

        match_result = match_invoice(extracted, gstr2b_records)
        verdict_payload = recommend(match_result, extracted)

        # Delete any existing verdict for this invoice (idempotent re-run)
        db.query(Verdict).filter(Verdict.invoice_id == inv.id).delete()

        gstr2b_id = (
            match_result.matched_record.id
            if match_result.matched_record
            else None
        )

        db_verdict = Verdict(
            id=str(uuid.uuid4()),
            invoice_id=inv.id,
            gstr2b_record_id=gstr2b_id,
            action=verdict_payload.action,
            reason_code=verdict_payload.reason_code,
            reason_text_en=verdict_payload.reason_text_en,
            reason_text_hi=verdict_payload.reason_text_hi,
            action_text_en=verdict_payload.action_text_en,
            action_text_hi=verdict_payload.action_text_hi,
            tts_url_en=verdict_payload.tts_url_en,
            tts_url_hi=verdict_payload.tts_url_hi,
            itc_impact_inr=verdict_payload.itc_impact_inr,
            confidence=verdict_payload.confidence,
            is_recoverable="true" if verdict_payload.is_recoverable else "false",
            match_status=(
                "matched" if match_result.matched_record else "unmatched"
            ),
            created_at=datetime.utcnow(),
        )
        db.add(db_verdict)

        action_counts[verdict_payload.action] = (
            action_counts.get(verdict_payload.action, 0) + 1
        )
        if verdict_payload.action == "ACCEPT":
            itc_safe += abs(verdict_payload.itc_impact_inr)
        else:
            itc_at_risk += abs(verdict_payload.itc_impact_inr)

        verdicts_created += 1

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        log.exception("Failed to persist reconciliation verdicts")
        return JSONResponse(
            status_code=500,
            content={
                "error": "persistence_failed",
                "detail": f"Reconciliation ran but verdicts could not be saved: {exc}",
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "invoices_processed": len(invoices),
            "verdicts_created": verdicts_created,
            "skipped": skipped,
            "summary": {
                "accept_count": action_counts.get("ACCEPT", 0),
                "reject_count": action_counts.get("REJECT", 0),
                "hold_count": action_counts.get("HOLD", 0),
                "itc_safe": round(itc_safe, 2),
                "itc_at_risk": round(itc_at_risk, 2),
            },
        },
    )


@router.get(
    "/status",
    summary="Check reconciliation status",
    response_description="Counts of invoices and verdicts in the database",
)
async def reconciliation_status(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Quick status check: how many invoices exist, how many have been
    reconciled (have a Verdict row), and the GSTR-2B record count.
    """
    total_invoices = db.query(Invoice).count()
    extracted_invoices = (
        db.query(Invoice)
        .filter(Invoice.extraction_status == "success")
        .count()
    )
    total_verdicts = db.query(Verdict).count()
    total_gstr2b = db.query(GSTR2BRecord).count()

    # Find the most recent verdict timestamp
    latest_verdict = (
        db.query(Verdict.created_at)
        .order_by(Verdict.created_at.desc())
        .first()
    )
    last_run_at = (
        latest_verdict[0].isoformat() if latest_verdict and latest_verdict[0]
        else None
    )

    return JSONResponse(
        status_code=200,
        content={
            "total_invoices": total_invoices,
            "extracted_invoices": extracted_invoices,
            "total_verdicts": total_verdicts,
            "total_gstr2b_records": total_gstr2b,
            "has_been_reconciled": total_verdicts > 0,
            "last_run_at": last_run_at,
        },
    )
