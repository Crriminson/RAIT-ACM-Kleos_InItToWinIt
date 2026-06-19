"""
tests/test_extractor.py

Verify extract_invoice() produces correct field values for each of the
6 real invoice images.  Ground-truth values come from the invoices
themselves (visually confirmed) and from test-csv/README.md.

Run:
    cd backend
    python -m pytest tests/test_extractor.py -v -s
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.ocr import extract_text
from core.extractor import extract_invoice
from models.extraction import ExtractedInvoice, ExtractionError

INVOICE_DIR = Path(__file__).parent.parent.parent / "test-csv" / "invoices"

# Ground-truth table from visual inspection + test-csv/README.md
# Format: (filename, gstin, invoice_number, cgst, sgst, igst, hsn_codes)
GROUND_TRUTH = [
    (
        "ramesh-traders.png",
        "09AAACR5055K1Z7",
        "RT/2026/0547",
        1200.0, 1200.0, 0.0,
        ["1006"],
    ),
    (
        "sharma-supplies.png",
        "09BBBCS8888M1Z5",
        "SS/26-27/0412",
        1350.0, 1350.0, 0.0,
        ["3401"],
    ),
    (
        "gupta-electronics.png",
        "09CCCPG7777N1Z3",
        "GE/26-27/1034",
        1080.0, 1080.0, 0.0,
        ["8528"],
    ),
    (
        "patel-brothers.png",
        "09DDDPP6666L1Z1",
        "PB/2026/3321",
        800.0, 800.0, 0.0,
        ["0402"],
    ),
    (
        "kumar-general.png",
        "09EEEKK5555P1Z9",
        "KGS/26/0088",
        450.0, 450.0, 0.0,
        ["1701"],
    ),
    (
        "singh-oil-mills.png",
        "09FFFSS4444Q1Z7",
        "SOM/2026/0271",
        625.0, 625.0, 0.0,
        ["1508"],
    ),
]


@pytest.fixture(scope="module")
def extracted_invoices() -> dict[str, ExtractedInvoice]:
    """Extract all 6 invoices once per session."""
    results = {}
    for fname, *_ in GROUND_TRUTH:
        path = INVOICE_DIR / fname
        if not path.exists():
            pytest.skip(f"Invoice not found: {path}")
        raw = extract_text(path)
        extracted = extract_invoice(raw)
        results[fname] = extracted
        print(f"\n  {fname}: confidence={extracted.overall_confidence:.3f}")
    return results


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_gstin(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    inv = extracted_invoices[fname]
    assert inv.supplier_gstin == gstin, (
        f"{fname}: expected GSTIN '{gstin}', got '{inv.supplier_gstin}'"
    )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_invoice_number(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    inv = extracted_invoices[fname]
    assert inv.invoice_number == inv_no, (
        f"{fname}: expected invoice number '{inv_no}', got '{inv.invoice_number}'"
    )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_cgst(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    inv = extracted_invoices[fname]
    assert abs(inv.cgst - cgst) < 1.0, (
        f"{fname}: expected CGST {cgst}, got {inv.cgst}"
    )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_sgst(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    inv = extracted_invoices[fname]
    assert abs(inv.sgst - sgst) < 1.0, (
        f"{fname}: expected SGST {sgst}, got {inv.sgst}"
    )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_hsn_codes(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    inv = extracted_invoices[fname]
    for expected_hsn in hsns:
        assert expected_hsn in inv.hsn_codes, (
            f"{fname}: expected HSN '{expected_hsn}' in {inv.hsn_codes}"
        )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_date_is_iso(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    """invoice_date must be ISO YYYY-MM-DD format."""
    import re
    inv = extracted_invoices[fname]
    assert re.match(r"^\d{4}-\d{2}-\d{2}$", inv.invoice_date), (
        f"{fname}: invoice_date '{inv.invoice_date}' is not ISO YYYY-MM-DD"
    )


@pytest.mark.parametrize("fname,gstin,inv_no,cgst,sgst,igst,hsns", GROUND_TRUTH)
def test_extract_overall_confidence(extracted_invoices, fname, gstin, inv_no, cgst, sgst, igst, hsns):
    """Overall confidence must meet the minimum threshold (stop-gate)."""
    inv = extracted_invoices[fname]
    conf = inv.overall_confidence
    print(f"\n  {fname}: overall_confidence={conf:.3f}")
    assert conf >= 0.75, (
        f"STOP-CONDITION — {fname}: overall_confidence={conf:.3f} < 0.75\n"
        f"  Field breakdown:\n"
        + "\n".join(
            f"    {fc.field_name}: {fc.confidence:.3f} (raw='{fc.raw_text}')"
            for fc in inv.field_confidences
        )
        + "\n  Do not loosen the threshold — report these exact numbers."
    )


def test_extraction_error_names_field():
    """ExtractionError must always carry a non-empty .field attribute."""
    err = ExtractionError(
        field="supplier_gstin",
        reason="not_found",
        detail="GSTIN not found",
    )
    assert err.field == "supplier_gstin"
    assert err.reason == "not_found"
    d = err.to_dict()
    assert d["field"] == "supplier_gstin"
    assert d["error"] == "extraction_failed"


def test_gstin_validation_rejects_short():
    """Extractor must reject GSTINs shorter than 15 chars."""
    from core.extractor import _validate_gstin
    with pytest.raises(ValueError, match="15"):
        _validate_gstin("09AAACR5055K1Z")   # 14 chars


def test_gstin_validation_rejects_invalid_state():
    """Extractor must reject invalid state codes (e.g. 99)."""
    from core.extractor import _validate_gstin
    with pytest.raises(ValueError, match="state code"):
        _validate_gstin("99AAACR5055K1Z7")


def test_gstin_validation_accepts_valid():
    """Extractor must accept well-formed GSTINs."""
    from core.extractor import _validate_gstin
    assert _validate_gstin("09AAACR5055K1Z7") == "09AAACR5055K1Z7"
    assert _validate_gstin("09BBBCS8888M1Z5") == "09BBBCS8888M1Z5"
