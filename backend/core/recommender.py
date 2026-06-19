"""
core/recommender.py — Map a MatchResult to an IMS action recommendation.

Public API
----------
    recommend(match, invoice) -> VerdictPayload

Action mapping (mirrors app/src/data/matching-engine.ts):
  MISSING_TRANSACTION → REJECT  (severity: blocked)
  HSN_MISMATCH        → HOLD    (severity: blocked)
  RATE_MISMATCH       → HOLD    (severity: pending)
  TAX_AMOUNT_DELTA    → HOLD    (severity: pending)
  CLEAN_MATCH         → ACCEPT  (severity: resolved)
"""
from __future__ import annotations

from dataclasses import dataclass

from core.matcher import MatchResult
from models.extraction import ExtractedInvoice
from models.mismatch import MismatchType


# ---------------------------------------------------------------------------
# Output type
# ---------------------------------------------------------------------------

@dataclass
class VerdictPayload:
    """
    Serialisable result of the full OCR → extract → match → recommend
    pipeline for a single invoice.

    This is what the API endpoint returns (and what the Verdict DB row stores).
    """
    invoice_number: str
    supplier_gstin: str
    supplier_name: str

    action: str       # "ACCEPT" | "REJECT" | "HOLD"
    severity: str     # "resolved" | "blocked" | "pending"
    reason_code: str  # MismatchType value, e.g. "MISSING_TRANSACTION"
    reason_text: str  # Plain English, one sentence
    itc_impact_inr: float   # positive = claimable, negative = at risk / blocked

    # Extraction confidence — lets the API surface low-confidence warnings
    confidence: float

    def to_dict(self) -> dict:
        return {
            "invoice_number":  self.invoice_number,
            "supplier_gstin":  self.supplier_gstin,
            "supplier_name":   self.supplier_name,
            "action":          self.action,
            "severity":        self.severity,
            "reason_code":     self.reason_code,
            "reason_text":     self.reason_text,
            "itc_impact_inr":  self.itc_impact_inr,
            "confidence":      round(self.confidence, 4),
        }


# ---------------------------------------------------------------------------
# Action + reason tables
# ---------------------------------------------------------------------------

_ACTION_MAP: dict[MismatchType, str] = {
    MismatchType.MISSING_TRANSACTION: "REJECT",
    MismatchType.HSN_MISMATCH:        "HOLD",
    MismatchType.RATE_MISMATCH:       "HOLD",
    MismatchType.TAX_AMOUNT_DELTA:    "HOLD",
    MismatchType.CLEAN_MATCH:         "ACCEPT",
}

_SEVERITY_MAP: dict[MismatchType, str] = {
    MismatchType.MISSING_TRANSACTION: "blocked",
    MismatchType.HSN_MISMATCH:        "blocked",
    MismatchType.RATE_MISMATCH:       "pending",
    MismatchType.TAX_AMOUNT_DELTA:    "pending",
    MismatchType.CLEAN_MATCH:         "resolved",
}

def _reason_text(match: MatchResult, invoice: ExtractedInvoice) -> str:
    """
    One-sentence English explanation for the trader.
    Mirrors the reason_en strings in matching-engine.ts.
    """
    mt = match.mismatch_type
    supplier = invoice.supplier_name or invoice.supplier_gstin

    if mt == MismatchType.MISSING_TRANSACTION:
        return (
            f"{supplier} has not filed this invoice (#{invoice.invoice_number}) "
            f"in their GSTR-1, so it does not appear in your GSTR-2B. "
            f"ITC of ₹{match.itc_at_risk:,.0f} is blocked."
        )
    if mt == MismatchType.HSN_MISMATCH:
        return (
            f"The HSN code on your invoice from {supplier} does not match "
            f"what they reported in GSTR-2B. "
            f"₹{match.itc_at_risk:,.0f} ITC is blocked until corrected."
        )
    if mt == MismatchType.RATE_MISMATCH:
        detail = f" ({match.delta_detail})" if match.delta_detail else ""
        return (
            f"Tax rate differs between your invoice and GSTR-2B for {supplier}"
            f"{detail}. "
            f"₹{match.itc_at_risk:,.0f} ITC is at risk — hold and request an amendment."
        )
    if mt == MismatchType.TAX_AMOUNT_DELTA:
        detail = f" ({match.delta_detail})" if match.delta_detail else ""
        return (
            f"Tax amounts differ by more than 1% between your invoice and "
            f"GSTR-2B for {supplier}{detail}. "
            f"₹{match.itc_at_risk:,.0f} ITC is at risk."
        )
    # CLEAN_MATCH
    return (
        f"Invoice #{invoice.invoice_number} from {supplier} matches GSTR-2B "
        f"exactly. ITC is claimable."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def recommend(match: MatchResult, invoice: ExtractedInvoice) -> VerdictPayload:
    """
    Produce a VerdictPayload from a MatchResult.

    Parameters
    ----------
    match : MatchResult
        Output of core.matcher.match_invoice().
    invoice : ExtractedInvoice
        The extracted invoice (used for reason text and supplier name).

    Returns
    -------
    VerdictPayload
        Fully populated recommendation.  Never raises.
    """
    action   = _ACTION_MAP[match.mismatch_type]
    severity = _SEVERITY_MAP[match.mismatch_type]
    reason   = _reason_text(match, invoice)

    # ITC impact convention:
    #   positive → claimable (ACCEPT)
    #   negative → at risk or blocked (HOLD / REJECT)
    total_itc = invoice.cgst + invoice.sgst + invoice.igst
    if match.mismatch_type == MismatchType.CLEAN_MATCH:
        itc_impact = total_itc
    else:
        itc_impact = -match.itc_at_risk

    return VerdictPayload(
        invoice_number=invoice.invoice_number,
        supplier_gstin=invoice.supplier_gstin,
        supplier_name=invoice.supplier_name,
        action=action,
        severity=severity,
        reason_code=match.mismatch_type.value,
        reason_text=reason,
        itc_impact_inr=itc_impact,
        confidence=invoice.overall_confidence,
    )
