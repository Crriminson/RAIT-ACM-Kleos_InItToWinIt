"""
api/routes/summary.py — Monthly summary endpoint.

GET /api/v1/summary
    Aggregate all Verdict rows into the monthly summary view that powers
    the app's Monthly Summary Screen (§7.7 in FLOW.md).

    Returns counts and ₹ totals per action (Accept/Reject/Hold), plus
    unreadable invoices and a disagree count placeholder for the audit trail.

    Shape mirrors computeSummary() from app/src/data/matching-engine.ts
    so the app can consume it directly.
"""
from __future__ import annotations

import logging
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from models.invoice import Invoice
from models.verdict import Verdict

log = logging.getLogger(__name__)

router = APIRouter(prefix="/summary", tags=["summary"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_period(db: Session) -> str:
    """
    Derive a human-readable period label (e.g. "June 2026") from the
    most common invoice date in the verdicts.  Falls back to current month.
    """
    MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    # Try to derive from invoice extracted_fields dates
    sample = (
        db.query(Invoice.extracted_fields)
        .join(Verdict, Verdict.invoice_id == Invoice.id)
        .filter(Invoice.extracted_fields.isnot(None))
        .first()
    )

    if sample and sample[0]:
        inv_date = sample[0].get("invoice_date", "")
        if inv_date and "-" in inv_date:
            parts = inv_date.split("-")
            if len(parts) >= 2:
                try:
                    year = parts[0]
                    month_idx = int(parts[1]) - 1
                    if 0 <= month_idx < 12:
                        return f"{MONTHS[month_idx]} {year}"
                except (ValueError, IndexError):
                    pass

    # Fallback: current month
    today = date.today()
    return f"{MONTHS[today.month - 1]} {today.year}"


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.get(
    "",
    summary="Get monthly aggregate summary",
    response_description="Aggregate ITC figures and action breakdown",
)
async def get_summary(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Monthly summary of all reconciliation verdicts.

    Returns
    -------
    200 OK — {
        period, total_invoices,
        accept_count, accept_itc,
        reject_count, reject_itc,
        hold_count, hold_itc,
        unreadable_count,
        total_itc_safe, total_itc_at_risk, total_itc_pending,
        issue_count, resolved_count,
        disagree_count
    }
    """
    # ── Aggregate verdict counts and ITC amounts per action ───────────────
    rows = (
        db.query(
            Verdict.action,
            func.count(Verdict.id).label("cnt"),
            func.sum(func.abs(Verdict.itc_impact_inr)).label("total_itc"),
        )
        .group_by(Verdict.action)
        .all()
    )

    action_data: dict[str, dict] = {}
    for row in rows:
        action_data[row.action] = {
            "count": row.cnt or 0,
            "itc": round(float(row.total_itc or 0), 2),
        }

    accept = action_data.get("ACCEPT", {"count": 0, "itc": 0.0})
    reject = action_data.get("REJECT", {"count": 0, "itc": 0.0})
    hold = action_data.get("HOLD", {"count": 0, "itc": 0.0})

    # ── Unreadable invoices: extraction failed / no verdict ───────────────
    unreadable_count = (
        db.query(Invoice)
        .filter(Invoice.extraction_status != "success")
        .count()
    )

    # ── Total invoice count (including unreadable) ────────────────────────
    total_invoices = db.query(Invoice).count()

    # ── Derive period label ──────────────────────────────────────────────
    period = _derive_period(db)

    total_verdicts = accept["count"] + reject["count"] + hold["count"]
    total_itc_safe = accept["itc"]
    total_itc_at_risk = reject["itc"]
    total_itc_pending = hold["itc"]

    return JSONResponse(
        status_code=200,
        content={
            "period": period,
            "total_invoices": total_invoices,
            "total_verdicts": total_verdicts,

            # Per-action breakdown
            "accept_count": accept["count"],
            "accept_itc": accept["itc"],
            "reject_count": reject["count"],
            "reject_itc": reject["itc"],
            "hold_count": hold["count"],
            "hold_itc": hold["itc"],
            "unreadable_count": unreadable_count,

            # Aggregate totals (mirrors computeSummary in matching-engine.ts)
            "total_itc_safe": total_itc_safe,
            "total_itc_at_risk": total_itc_at_risk,
            "total_itc_pending": total_itc_pending,

            # Convenience fields for the app's summary shape
            "issue_count": reject["count"] + hold["count"],
            "resolved_count": accept["count"],
            "total_blocked": total_itc_at_risk,
            "total_pending": total_itc_pending,
            "total_resolved": total_itc_safe,

            # Audit trail — placeholder until feedback persistence is built
            "disagree_count": 0,
        },
    )
