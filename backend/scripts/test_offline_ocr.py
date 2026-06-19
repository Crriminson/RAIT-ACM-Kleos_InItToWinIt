"""
scripts/test_offline_ocr.py — End-to-end check of the OFFLINE OCR pipeline.

Runs PaddleOCR (core.ocr) → structured extraction (core.extractor) on every
sample invoice in test-csv/invoices/ and prints the extracted fields plus the
per-field OCR confidence. No Gemini, no network calls to an LLM — this is the
fully offline path.

Run from the backend/ directory:
    .venv\\Scripts\\python.exe scripts/test_offline_ocr.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.ocr import extract_text
from core.extractor import extract_invoice
from models.extraction import ExtractionError

INVOICE_DIR = Path(__file__).resolve().parent.parent.parent / "test-csv" / "invoices"

# Expected ground-truth values (from test-csv/README.md / server demo set).
EXPECTED = {
    "ramesh-traders.png":    ("09AAACR5055K1Z7", "RT/2026/0547", "1006"),
    "sharma-supplies.png":   ("09BBBCS8888M1Z5", "SS/26-27/0412", "3401"),
    "gupta-electronics.png": ("09CCCPG7777N1Z3", "GE/26-27/1034", "8528"),
    "patel-brothers.png":    ("09DDDPP6666L1Z1", "PB/2026/3321",  "0402"),
    "kumar-general.png":     ("09EEEKK5555P1Z9", "KGS/26/0088",   "1701"),
    "singh-oil-mills.png":   ("09FFFSS4444Q1Z7", "SOM/2026/0271", "1508"),
}


def main() -> int:
    passed = 0
    failed = 0
    for fname, (exp_gstin, exp_inv, exp_hsn) in EXPECTED.items():
        path = INVOICE_DIR / fname
        print("\n" + "=" * 70)
        print(f"  {fname}")
        print("=" * 70)
        if not path.exists():
            print("  SKIP — file not found")
            continue

        t0 = time.perf_counter()
        try:
            raw = extract_text(path)
            inv = extract_invoice(raw)
        except ExtractionError as exc:
            failed += 1
            print(f"  EXTRACTION FAILED on field '{exc.field}' ({exc.reason}): {exc.detail}")
            if exc.raw_text is not None:
                print(f"    raw OCR text: {exc.raw_text!r}  conf={exc.confidence}")
            continue
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  PIPELINE ERROR: {type(exc).__name__}: {exc}")
            continue
        elapsed = (time.perf_counter() - t0) * 1000

        hsn = inv.hsn_codes[0] if inv.hsn_codes else (inv.line_items[0].hsn_code if inv.line_items else "")
        total_tax = inv.cgst + inv.sgst + inv.igst

        gstin_ok = inv.supplier_gstin == exp_gstin
        inv_ok = inv.invoice_number == exp_inv
        hsn_ok = hsn == exp_hsn
        all_ok = gstin_ok and inv_ok and hsn_ok

        print(f"  supplier_name : {inv.supplier_name}")
        print(f"  GSTIN         : {inv.supplier_gstin}   {'OK' if gstin_ok else 'MISMATCH exp ' + exp_gstin}")
        print(f"  invoice_number: {inv.invoice_number}   {'OK' if inv_ok else 'MISMATCH exp ' + exp_inv}")
        print(f"  invoice_date  : {inv.invoice_date}")
        print(f"  HSN           : {hsn}   {'OK' if hsn_ok else 'MISMATCH exp ' + exp_hsn}")
        print(f"  taxable_value : {inv.taxable_value}")
        print(f"  tax (c/s/i)   : {inv.cgst}/{inv.sgst}/{inv.igst}  total={total_tax}")
        print(f"  overall_conf  : {inv.overall_confidence:.3f}   ({len(raw.tokens)} tokens, {elapsed:.0f}ms)")
        print(f"  RESULT        : {'PASS' if all_ok else 'FIELDS DIFFER'}")

        if all_ok:
            passed += 1
        else:
            failed += 1

    print("\n" + "=" * 70)
    print(f"  SUMMARY: {passed} passed, {failed} failed, of {len(EXPECTED)} invoices")
    print("=" * 70)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
