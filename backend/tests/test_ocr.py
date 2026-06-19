"""
tests/test_ocr.py

Stop-gate test: verify PaddleOCR can extract required tokens from the
real invoice images in test-csv/invoices/ at acceptable confidence.

If this test fails due to low confidence, execution STOPS here.
The test prints exact per-field confidence numbers so the problem can
be diagnosed precisely — we never silently loosen thresholds.

Run from the backend/ directory:
    python -m pytest tests/test_ocr.py -v -s
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Ensure backend/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.ocr import extract_text
from models.extraction import RawOCRResult

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

INVOICE_DIR = Path(__file__).parent.parent.parent / "test-csv" / "invoices"

INVOICE_FILES = [
    "ramesh-traders.png",
    "sharma-supplies.png",
    "gupta-electronics.png",
    "patel-brothers.png",
    "kumar-general.png",
    "singh-oil-mills.png",
]

# Known tokens that MUST appear in each invoice's OCR output.
# These are the critical identity fields — if PaddleOCR can't find them,
# the extractor will always fail.
REQUIRED_TOKENS: dict[str, list[str]] = {
    "ramesh-traders.png":    ["09AAACR5055K1Z7", "RT/2026/0547", "1006"],
    "sharma-supplies.png":   ["09BBBCS8888M1Z5", "SS/26-27/0412", "3401"],
    "gupta-electronics.png": ["09CCCPG7777N1Z3", "GE/26-27/1034", "8528"],
    "patel-brothers.png":    ["09DDDPP6666L1Z1", "PB/2026/3321",  "0402"],
    "kumar-general.png":     ["09EEEKK5555P1Z9", "KGS/26/0088",  "1701"],
    "singh-oil-mills.png":   ["09FFFSS4444Q1Z7", "SOM/2026/0271", "1508"],
}

# Minimum acceptable OCR confidence for individual tokens
MIN_CONFIDENCE = 0.75


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def ocr_results() -> dict[str, RawOCRResult]:
    """Run OCR on all 6 invoices once per test session (slow; cache with scope=module)."""
    results = {}
    for fname in INVOICE_FILES:
        path = INVOICE_DIR / fname
        if not path.exists():
            pytest.skip(f"Invoice image not found: {path}")
        results[fname] = extract_text(path)
    return results


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("fname", INVOICE_FILES)
def test_ocr_returns_tokens(ocr_results, fname):
    """OCR must produce at least 10 tokens per invoice (sanity check)."""
    result = ocr_results[fname]
    assert isinstance(result, RawOCRResult), f"{fname}: expected RawOCRResult"
    assert len(result.tokens) >= 10, (
        f"{fname}: only {len(result.tokens)} tokens — invoice may not have been read"
    )
    print(f"\n  {fname}: {len(result.tokens)} tokens in {result.processing_time_ms:.0f}ms")


@pytest.mark.parametrize("fname", INVOICE_FILES)
def test_ocr_finds_required_tokens(ocr_results, fname):
    """
    Each required token must appear in the OCR output.
    Prints confidence for each token found — critical stop-condition data.
    """
    result  = ocr_results[fname]
    all_text = {tok.text.strip().upper(): tok for tok in result.tokens}
    required = REQUIRED_TOKENS[fname]

    low_confidence_report = []
    missing_tokens        = []

    for expected in required:
        # Exact match or substring match (OCR may split tokens slightly)
        found_tok = None
        for tok in result.tokens:
            if expected.upper() in tok.text.upper():
                found_tok = tok
                break

        if found_tok is None:
            missing_tokens.append(expected)
            print(f"\n  STOP-CONDITION: '{expected}' NOT FOUND in {fname}")
            # Print nearby tokens to help diagnose
            print(f"    All tokens: {[t.text for t in result.tokens[:30]]}")
        else:
            conf = found_tok.confidence
            status = "OK" if conf >= MIN_CONFIDENCE else "LOW"
            print(f"\n  {fname} | '{expected}': conf={conf:.3f} [{status}]")
            if conf < MIN_CONFIDENCE:
                low_confidence_report.append(
                    f"  '{expected}': confidence={conf:.3f} (threshold={MIN_CONFIDENCE})"
                )

    if missing_tokens:
        pytest.fail(
            f"STOP-CONDITION — OCR could not find required tokens in {fname}:\n"
            f"  Missing: {missing_tokens}\n"
            f"  This means the extractor will always fail on this invoice.\n"
            f"  Do not loosen validation — report this to the team with the token list above."
        )

    if low_confidence_report:
        pytest.fail(
            f"STOP-CONDITION — Low-confidence tokens in {fname}:\n"
            + "\n".join(low_confidence_report)
            + f"\n  Min required confidence: {MIN_CONFIDENCE}\n"
            + "  Do not loosen the threshold — report with these exact numbers."
        )


@pytest.mark.parametrize("fname", INVOICE_FILES)
def test_ocr_accepts_bytes_input(fname):
    """extract_text() must work identically when given raw bytes."""
    path = INVOICE_DIR / fname
    if not path.exists():
        pytest.skip(f"Invoice image not found: {path}")

    image_bytes = path.read_bytes()
    result = extract_text(image_bytes)
    assert len(result.tokens) >= 10, (
        f"{fname} (bytes input): only {len(result.tokens)} tokens"
    )


@pytest.mark.parametrize("fname", INVOICE_FILES)
def test_ocr_accepts_base64_input(fname):
    """extract_text() must work identically when given a base64 string."""
    import base64
    path = INVOICE_DIR / fname
    if not path.exists():
        pytest.skip(f"Invoice image not found: {path}")

    b64 = base64.b64encode(path.read_bytes()).decode()
    result = extract_text(b64)
    assert len(result.tokens) >= 10, (
        f"{fname} (base64 input): only {len(result.tokens)} tokens"
    )
