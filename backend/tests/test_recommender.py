"""
tests/test_recommender.py

Unit tests for core/recommender.py.

Verifies action + severity mapping for every MismatchType and that
reason_text is non-empty and contains key information.

Run:
    cd backend
    python -m pytest tests/test_recommender.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.matcher import MatchResult
from core.recommender import recommend, VerdictPayload
from models.extraction import ExtractedInvoice, FieldConfidence
from models.mismatch import MismatchType
from models.gstr2b import GSTR2BRecord
from datetime import date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _invoice(
    gstin="09AAACR5055K1Z7",
    inv_no="RT/2026/0547",
    name="Ramesh Traders",
    cgst=1200.0,
    sgst=1200.0,
    igst=0.0,
) -> ExtractedInvoice:
    inv = ExtractedInvoice(
        supplier_gstin=gstin,
        supplier_name=name,
        invoice_number=inv_no,
        invoice_date="2026-05-08",
        taxable_value=48000.0,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        hsn_codes=["1006"],
        field_confidences=[
            FieldConfidence(
                field_name="cgst_or_igst",
                raw_text="1,200",
                parsed_value=1200.0,
                confidence=0.98,
                x1=0, y1=0, x2=0, y2=0,
            )
        ],
    )
    return inv


def _gstr2b_rec() -> GSTR2BRecord:
    rec = GSTR2BRecord()
    rec.id = "test-rec"
    rec.supplier_gstin = "09AAACR5055K1Z7"
    rec.invoice_number = "RT/2026/0547"
    rec.invoice_date = date(2026, 5, 8)
    rec.cgst = 4320.0
    rec.sgst = 4320.0
    rec.igst = 0.0
    rec.taxable_value = 48000.0
    rec.hsn_codes = ["1905"]
    return rec


def _match(mtype: MismatchType, itc: float = 2400.0, rec=None) -> MatchResult:
    return MatchResult(
        mismatch_type=mtype,
        matched_record=rec,
        itc_at_risk=itc,
    )


# ---------------------------------------------------------------------------
# Action + severity mapping
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("mtype,expected_action,expected_severity", [
    (MismatchType.MISSING_TRANSACTION, "REJECT",  "blocked"),
    (MismatchType.HSN_MISMATCH,        "HOLD",    "blocked"),
    (MismatchType.RATE_MISMATCH,       "HOLD",    "pending"),
    (MismatchType.TAX_AMOUNT_DELTA,    "HOLD",    "pending"),
    (MismatchType.CLEAN_MATCH,         "ACCEPT",  "resolved"),
])
def test_action_and_severity(mtype, expected_action, expected_severity):
    """Each MismatchType must map to exactly the documented action + severity."""
    inv = _invoice()
    match = _match(mtype, itc=2400.0, rec=_gstr2b_rec() if mtype != MismatchType.MISSING_TRANSACTION else None)
    verdict = recommend(match, inv)

    assert verdict.action == expected_action, (
        f"{mtype}: expected action={expected_action}, got={verdict.action}"
    )
    assert verdict.severity == expected_severity, (
        f"{mtype}: expected severity={expected_severity}, got={verdict.severity}"
    )


# ---------------------------------------------------------------------------
# ITC impact sign convention
# ---------------------------------------------------------------------------

def test_itc_positive_for_accept():
    """CLEAN_MATCH → positive ITC impact (claimable)."""
    inv = _invoice()
    verdict = recommend(_match(MismatchType.CLEAN_MATCH, itc=0.0, rec=_gstr2b_rec()), inv)
    assert verdict.itc_impact_inr > 0, (
        f"CLEAN_MATCH should have positive ITC, got {verdict.itc_impact_inr}"
    )


def test_itc_negative_for_reject():
    """MISSING_TRANSACTION → negative ITC impact (blocked)."""
    inv = _invoice()
    verdict = recommend(_match(MismatchType.MISSING_TRANSACTION, itc=2400.0, rec=None), inv)
    assert verdict.itc_impact_inr < 0, (
        f"REJECT should have negative ITC, got {verdict.itc_impact_inr}"
    )
    assert abs(verdict.itc_impact_inr) == pytest.approx(2400.0, abs=0.1)


def test_itc_negative_for_hold():
    """HSN_MISMATCH → negative ITC impact (at risk)."""
    inv = _invoice()
    verdict = recommend(_match(MismatchType.HSN_MISMATCH, itc=2400.0, rec=_gstr2b_rec()), inv)
    assert verdict.itc_impact_inr < 0


# ---------------------------------------------------------------------------
# Reason text
# ---------------------------------------------------------------------------

def test_reason_text_non_empty():
    """reason_text must be a non-empty string for every MismatchType."""
    for mtype in MismatchType:
        inv = _invoice()
        rec = None if mtype == MismatchType.MISSING_TRANSACTION else _gstr2b_rec()
        verdict = recommend(_match(mtype, rec=rec), inv)
        assert verdict.reason_text, f"{mtype}: reason_text is empty"
        assert len(verdict.reason_text) > 20, (
            f"{mtype}: reason_text is suspiciously short: '{verdict.reason_text}'"
        )


def test_reason_text_mentions_supplier():
    """reason_text should reference the supplier or invoice number."""
    inv = _invoice(name="Ramesh Traders", inv_no="RT/2026/0547")
    verdict = recommend(_match(MismatchType.HSN_MISMATCH, rec=_gstr2b_rec()), inv)
    assert "Ramesh Traders" in verdict.reason_text or "RT/2026/0547" in verdict.reason_text, (
        f"reason_text does not mention supplier or invoice: '{verdict.reason_text}'"
    )


# ---------------------------------------------------------------------------
# VerdictPayload serialisation
# ---------------------------------------------------------------------------

def test_to_dict_has_all_keys():
    """to_dict() must include all required API response keys."""
    inv = _invoice()
    verdict = recommend(_match(MismatchType.CLEAN_MATCH, itc=0.0, rec=_gstr2b_rec()), inv)
    d = verdict.to_dict()
    required_keys = {
        "invoice_number", "supplier_gstin", "supplier_name",
        "action", "severity", "reason_code", "reason_text",
        "itc_impact_inr", "confidence",
    }
    missing = required_keys - set(d.keys())
    assert not missing, f"to_dict() is missing keys: {missing}"


def test_reason_code_matches_mismatch_type():
    """reason_code in the payload must equal the MismatchType value."""
    for mtype in MismatchType:
        inv = _invoice()
        rec = None if mtype == MismatchType.MISSING_TRANSACTION else _gstr2b_rec()
        verdict = recommend(_match(mtype, rec=rec), inv)
        assert verdict.reason_code == mtype.value, (
            f"{mtype}: reason_code='{verdict.reason_code}' != mtype.value='{mtype.value}'"
        )


def test_confidence_is_float_in_range():
    """confidence must be a float between 0.0 and 1.0."""
    inv = _invoice()
    verdict = recommend(_match(MismatchType.CLEAN_MATCH, itc=0.0, rec=_gstr2b_rec()), inv)
    assert isinstance(verdict.confidence, float)
    assert 0.0 <= verdict.confidence <= 1.0
