"""
tests/test_matcher.py

Unit tests for core/matcher.py.

Uses the realistic GSTR-2B scenario (gstr2b-realistic.csv) as the dataset:
  - Ramesh Traders:     HSN 1905 in 2B vs 1006 on invoice → HSN_MISMATCH
  - Sharma Supplies:    absent from 2B                     → MISSING_TRANSACTION
  - Gupta Electronics:  12% in 2B vs 18% on invoice       → RATE_MISMATCH
  - Patel Brothers:     matches exactly                    → CLEAN_MATCH
  - Kumar General:      matches exactly                    → CLEAN_MATCH
  - Singh Oil Mills:    matches exactly                    → CLEAN_MATCH

These results must be identical to what matching-engine.ts produces for the
same inputs (deliberate parity constraint).

Run:
    cd backend
    python -m pytest tests/test_matcher.py -v
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.matcher import match_invoice, MatchResult
from models.extraction import ExtractedInvoice, LineItem
from models.gstr2b import GSTR2BRecord
from models.mismatch import MismatchType


# ---------------------------------------------------------------------------
# Helpers: construct test fixtures without hitting the DB
# ---------------------------------------------------------------------------

def _make_extracted(
    gstin: str,
    invoice_number: str,
    cgst: float,
    sgst: float,
    igst: float,
    taxable_value: float,
    hsn_codes: list[str],
) -> ExtractedInvoice:
    return ExtractedInvoice(
        supplier_gstin=gstin,
        supplier_name="Test Supplier",
        invoice_number=invoice_number,
        invoice_date="2026-05-01",
        taxable_value=taxable_value,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        hsn_codes=hsn_codes,
    )


def _make_gstr2b(
    gstin: str,
    invoice_number: str,
    cgst: float,
    sgst: float,
    igst: float,
    taxable_value: float,
    hsn_codes: list[str],
) -> GSTR2BRecord:
    rec = GSTR2BRecord()
    rec.id              = f"test-{gstin[:8]}-{invoice_number[:6]}"
    rec.supplier_gstin  = gstin
    rec.invoice_number  = invoice_number
    rec.invoice_date    = date(2026, 5, 1)
    rec.taxable_value   = taxable_value
    rec.cgst            = cgst
    rec.sgst            = sgst
    rec.igst            = igst
    rec.total_tax       = cgst + sgst + igst
    rec.hsn_codes       = hsn_codes
    rec.ims_status      = "pending"
    return rec


# ---------------------------------------------------------------------------
# The 6 demo suppliers from the realistic scenario
# ---------------------------------------------------------------------------

# Supplier data: (gstin, invoice_number, cgst, sgst, igst, taxable_value, hsn_codes)
RAMESH  = ("09AAACR5055K1Z7", "RT/2026/0547",  1200.0, 1200.0, 0.0, 48000.0, ["1006"])
SHARMA  = ("09BBBCS8888M1Z5", "SS/26-27/0412", 1350.0, 1350.0, 0.0, 15000.0, ["3401"])
GUPTA   = ("09CCCPG7777N1Z3", "GE/26-27/1034", 1080.0, 1080.0, 0.0, 12000.0, ["8528"])
PATEL   = ("09DDDPP6666L1Z1", "PB/2026/3321",   800.0,  800.0, 0.0, 32000.0, ["0402"])
KUMAR   = ("09EEEKK5555P1Z9", "KGS/26/0088",    450.0,  450.0, 0.0, 18000.0, ["1701"])
SINGH   = ("09FFFSS4444Q1Z7", "SOM/2026/0271",  625.0,  625.0, 0.0, 25000.0, ["1508"])

# GSTR-2B dataset (realistic scenario: Ramesh has wrong HSN, Gupta has wrong rate,
# Sharma is absent, others are clean)
GSTR2B_RECORDS = [
    # Ramesh in 2B with wrong HSN 1905 (invoice says 1006)
    _make_gstr2b("09AAACR5055K1Z7", "RT/2026/0547",  4320.0, 4320.0, 0.0, 48000.0, ["1905"]),
    # Gupta in 2B with 12% rate (invoice says 18%)
    _make_gstr2b("09CCCPG7777N1Z3", "GE/26-27/1034",  720.0,  720.0, 0.0, 12000.0, ["8528"]),
    # Clean matches
    _make_gstr2b(*PATEL),
    _make_gstr2b(*KUMAR),
    _make_gstr2b(*SINGH),
    # Note: Sharma is intentionally ABSENT from 2B → MISSING_TRANSACTION
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_ramesh_hsn_mismatch():
    """HSN 1006 on invoice vs HSN 1905 in GSTR-2B → HSN_MISMATCH."""
    extracted = _make_extracted(*RAMESH)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.HSN_MISMATCH, (
        f"Expected HSN_MISMATCH, got {result.mismatch_type}"
    )
    assert result.matched_record is not None
    assert result.itc_at_risk == pytest.approx(2400.0, abs=1.0), (
        f"ITC at risk should be ₹2400 (total tax on invoice), got {result.itc_at_risk}"
    )


def test_sharma_missing_transaction():
    """Sharma is not in GSTR-2B at all → MISSING_TRANSACTION."""
    extracted = _make_extracted(*SHARMA)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.MISSING_TRANSACTION, (
        f"Expected MISSING_TRANSACTION, got {result.mismatch_type}"
    )
    assert result.matched_record is None
    assert result.itc_at_risk == pytest.approx(2700.0, abs=1.0), (
        f"ITC at risk should be ₹2700 (full tax blocked), got {result.itc_at_risk}"
    )


def test_gupta_rate_mismatch():
    """18% on invoice vs 12% in GSTR-2B → RATE_MISMATCH, ₹720 delta."""
    extracted = _make_extracted(*GUPTA)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.RATE_MISMATCH, (
        f"Expected RATE_MISMATCH, got {result.mismatch_type}"
    )
    assert result.matched_record is not None
    assert result.itc_at_risk == pytest.approx(720.0, abs=1.0), (
        f"ITC delta should be ₹720, got {result.itc_at_risk}"
    )


def test_patel_clean_match():
    extracted = _make_extracted(*PATEL)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.CLEAN_MATCH
    assert result.itc_at_risk == 0.0


def test_kumar_clean_match():
    extracted = _make_extracted(*KUMAR)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.CLEAN_MATCH
    assert result.itc_at_risk == 0.0


def test_singh_clean_match():
    extracted = _make_extracted(*SINGH)
    result = match_invoice(extracted, GSTR2B_RECORDS)
    assert result.mismatch_type == MismatchType.CLEAN_MATCH
    assert result.itc_at_risk == 0.0


def test_invoice_number_normalisation():
    """Spaces and hyphens in invoice number must not block a match."""
    # Invoice has "RT/2026/0547", GSTR-2B has same — but try with extra spaces
    extracted = _make_extracted(
        "09AAACR5055K1Z7", "RT / 2026 / 0547",  # spaces added
        4320.0, 4320.0, 0.0, 48000.0, ["1905"],
    )
    clean_2b = [_make_gstr2b("09AAACR5055K1Z7", "RT/2026/0547", 4320.0, 4320.0, 0.0, 48000.0, ["1905"])]
    result = match_invoice(extracted, clean_2b)
    # Should match (normalisation strips spaces) → CLEAN_MATCH (same HSN, same amounts)
    assert result.mismatch_type == MismatchType.CLEAN_MATCH, (
        f"Normalisation failed: got {result.mismatch_type} instead of CLEAN_MATCH"
    )


def test_hsn_comparison_is_set_not_positional():
    """
    HSN check must use set comparison, not positional index.
    If GSTR-2B has [A, B] and invoice has [B, A], that should be CLEAN_MATCH
    because both sets are equal.
    """
    extracted = _make_extracted(
        "09DDDPP6666L1Z1", "PB/2026/3321",
        800.0, 800.0, 0.0, 32000.0,
        ["0402", "1701"],        # invoice has two HSNs, different order
    )
    gstr2b = [_make_gstr2b(
        "09DDDPP6666L1Z1", "PB/2026/3321",
        800.0, 800.0, 0.0, 32000.0,
        ["1701", "0402"],        # same HSNs, reversed order
    )]
    result = match_invoice(extracted, gstr2b)
    assert result.mismatch_type == MismatchType.CLEAN_MATCH, (
        "HSN set comparison failed: positional comparison would give HSN_MISMATCH here"
    )


def test_tax_amount_delta_flagged():
    """Small absolute delta but >1% relative delta must trigger TAX_AMOUNT_DELTA."""
    extracted = _make_extracted(
        "09DDDPP6666L1Z1", "PB/2026/3321",
        820.0, 820.0, 0.0, 32000.0, ["0402"],
    )
    gstr2b = [_make_gstr2b(
        "09DDDPP6666L1Z1", "PB/2026/3321",
        800.0, 800.0, 0.0, 32000.0, ["0402"],
    )]
    result = match_invoice(extracted, gstr2b)
    # 1640 vs 1600 = 2.5% delta → should flag
    assert result.mismatch_type == MismatchType.TAX_AMOUNT_DELTA, (
        f"Expected TAX_AMOUNT_DELTA, got {result.mismatch_type}"
    )
