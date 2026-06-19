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
from core.reason_texts import get_rationale


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
    reason_text_en: str
    reason_text_hi: str
    action_text_en: str
    action_text_hi: str
    tts_url_en: str
    tts_url_hi: str
    itc_impact_inr: float   # positive = claimable, negative = at risk / blocked

    # F11: Permanent vs Recoverable
    is_recoverable: bool

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
            "reason_text_en":  self.reason_text_en,
            "reason_text_hi":  self.reason_text_hi,
            "action_text_en":  self.action_text_en,
            "action_text_hi":  self.action_text_hi,
            "tts_url_en":      self.tts_url_en,
            "tts_url_hi":      self.tts_url_hi,
            "itc_impact_inr":  self.itc_impact_inr,
            "confidence":      round(self.confidence, 4),
            "is_recoverable":  self.is_recoverable,
        }


# ---------------------------------------------------------------------------
# Action + reason tables
# ---------------------------------------------------------------------------

_ACTION_MAP: dict[MismatchType, str] = {
    MismatchType.MISSING_TRANSACTION: "REJECT",
    MismatchType.HSN_MISMATCH:        "HOLD",
    MismatchType.RATE_MISMATCH:       "HOLD",
    MismatchType.TAX_AMOUNT_DELTA:    "HOLD",
    MismatchType.POS_MISMATCH:        "HOLD",
    MismatchType.BLOCKED_CREDIT_17_5: "HOLD",
    MismatchType.CLEAN_MATCH:         "ACCEPT",
}

_SEVERITY_MAP: dict[MismatchType, str] = {
    MismatchType.MISSING_TRANSACTION: "blocked",
    MismatchType.HSN_MISMATCH:        "blocked",
    MismatchType.POS_MISMATCH:        "blocked",
    MismatchType.BLOCKED_CREDIT_17_5: "pending",
    MismatchType.RATE_MISMATCH:       "pending",
    MismatchType.TAX_AMOUNT_DELTA:    "pending",
    MismatchType.CLEAN_MATCH:         "resolved",
}

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
    rationale = get_rationale(match, invoice)

    # ITC impact convention:
    #   positive → claimable (ACCEPT)
    #   negative → at risk or blocked (HOLD / REJECT)
    total_itc = invoice.cgst + invoice.sgst + invoice.igst
    if match.mismatch_type == MismatchType.CLEAN_MATCH:
        itc_impact = total_itc
    else:
        itc_impact = -match.itc_at_risk

    # F11 check: deadline is Nov 30 of the following financial year
    is_recoverable = True
    if invoice.invoice_date:
        try:
            from datetime import datetime
            dt = datetime.strptime(invoice.invoice_date, "%Y-%m-%d")
            fy_end_year = dt.year + 1 if dt.month >= 4 else dt.year
            deadline = datetime(fy_end_year, 11, 30)
            if datetime.now() > deadline:
                is_recoverable = False
        except ValueError:
            pass

    return VerdictPayload(
        invoice_number=invoice.invoice_number,
        supplier_gstin=invoice.supplier_gstin,
        supplier_name=invoice.supplier_name,
        action=action,
        severity=severity,
        reason_code=match.mismatch_type.value,
        reason_text_en=rationale.reason_en,
        reason_text_hi=rationale.reason_hi,
        action_text_en=rationale.action_en,
        action_text_hi=rationale.action_hi,
        tts_url_en=rationale.tts_url_en,
        tts_url_hi=rationale.tts_url_hi,
        itc_impact_inr=itc_impact,
        confidence=invoice.overall_confidence,
        is_recoverable=is_recoverable,
    )
