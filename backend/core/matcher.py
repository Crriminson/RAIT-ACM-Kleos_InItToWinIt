"""
core/matcher.py — Match an extracted invoice against GSTR-2B records.

Public API
----------
    match_invoice(extracted, gstr2b_records) -> MatchResult

Parity constraint
-----------------
The matching rules here MUST stay identical to those in
app/src/data/matching-engine.ts.

If any rule diverges, STOP and flag it — do NOT silently pick one side.

Current rules (mirroring the TS engine, verified against the codebase):
  1. Normalize invoice number (strip spaces / hyphens / slashes, uppercase)
     + supplier GSTIN — exact match required as lookup key.
  2. No match → MISSING_TRANSACTION
  3. Match found → HSN set-comparison (SET difference, NOT positional index).
     invoice_hsn_set ⊄ gstr2b_hsn_set → HSN_MISMATCH
  4. Tax rate comparison (where HSNs align): rate differs → RATE_MISMATCH
  5. Tax amounts differ by > 1% after rate check → TAX_AMOUNT_DELTA
  6. All checks pass → CLEAN_MATCH
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from models.extraction import ExtractedInvoice
from models.gstr2b import GSTR2BRecord
from models.mismatch import MismatchType


# ---------------------------------------------------------------------------
# Tuneable constants — keep in sync with matching-engine.ts
# ---------------------------------------------------------------------------

# Maximum fractional tax-amount delta before flagging TAX_AMOUNT_DELTA
TAX_DELTA_THRESHOLD: float = 0.01  # 1%

# Section 17(5) blocked HSN prefixes (Motor vehicles, aircraft, vessels, etc.)
BLOCKED_HSN_PREFIXES: tuple[str, ...] = ("8703", "8802", "8901")


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class MatchResult:
    """Outcome of matching one invoice against the GSTR-2B dataset."""
    mismatch_type: MismatchType
    matched_record: Optional[GSTR2BRecord]   # None if MISSING_TRANSACTION
    itc_at_risk: float                        # absolute INR amount at risk
    # Extra detail for TAX_AMOUNT_DELTA and RATE_MISMATCH
    delta_detail: Optional[str] = None


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

_STRIP_RE = re.compile(r"[\s\-/]")


def _normalize_invoice_number(raw: str) -> str:
    """
    Strip spaces, hyphens, and slashes; uppercase.
    Mirrors normalizeInvoiceNumber() in matching-engine.ts.
    """
    return _STRIP_RE.sub("", raw).upper()


def _build_lookup_key(gstin: str, invoice_number: str) -> str:
    return f"{gstin.upper()}|{_normalize_invoice_number(invoice_number)}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def match_invoice(
    extracted: ExtractedInvoice,
    gstr2b_records: list[GSTR2BRecord],
) -> MatchResult:
    """
    Match *extracted* against *gstr2b_records* and return a MatchResult.

    Parameters
    ----------
    extracted : ExtractedInvoice
        Output of core.extractor.extract_invoice().
    gstr2b_records : list[GSTR2BRecord]
        All GSTR-2B records for the filing period.

    Returns
    -------
    MatchResult
        Always populated.  Never raises.
    """
    # Build lookup index for the records we received
    index: dict[str, GSTR2BRecord] = {}
    for rec in gstr2b_records:
        key = _build_lookup_key(rec.supplier_gstin, rec.invoice_number)
        index[key] = rec

    lookup_key = _build_lookup_key(extracted.supplier_gstin, extracted.invoice_number)
    matched = index.get(lookup_key)

    # ── Step 1: existence check ──────────────────────────────────────────────
    if matched is None:
        total_itc = extracted.cgst + extracted.sgst + extracted.igst
        return MatchResult(
            mismatch_type=MismatchType.MISSING_TRANSACTION,
            matched_record=None,
            itc_at_risk=total_itc,
        )

    total_itc = extracted.cgst + extracted.sgst + extracted.igst

    # ── Step 1b: Section 17(5) Blocked Credit check (F13) ────────────────────
    for hsn in extracted.hsn_codes:
        if any(hsn.startswith(p) for p in BLOCKED_HSN_PREFIXES):
            return MatchResult(
                mismatch_type=MismatchType.BLOCKED_CREDIT_17_5,
                matched_record=matched,
                itc_at_risk=total_itc,
                delta_detail=f"HSN {hsn} flagged as potentially blocked under Section 17(5)",
            )

    # ── Step 1c: Place of Supply check (F12) ─────────────────────────────────
    if extracted.place_of_supply and matched.place_of_supply:
        pos_inv = extracted.place_of_supply.strip().lower()
        pos_gstr = matched.place_of_supply.strip().lower()
        inv_code_match = re.search(r'\d{2}', pos_inv)
        gstr_code_match = re.search(r'\d{2}', pos_gstr)
        
        is_mismatch = False
        if inv_code_match and gstr_code_match:
            if inv_code_match.group() != gstr_code_match.group():
                is_mismatch = True
        elif pos_inv not in pos_gstr and pos_gstr not in pos_inv:
            # Fallback basic substring check if codes aren't present
            is_mismatch = True
            
        if is_mismatch:
            return MatchResult(
                mismatch_type=MismatchType.POS_MISMATCH,
                matched_record=matched,
                itc_at_risk=total_itc,
                delta_detail=f"Invoice POS '{extracted.place_of_supply}' vs GSTR-2B POS '{matched.place_of_supply}'",
            )

    # ── Step 2: HSN set comparison (NOT positional) ───────────────────────────
    # Mirrors: checkHsnMismatch() in matching-engine.ts
    inv_hsn_set   = set(extracted.hsn_codes)
    gstr_hsn_set  = set(matched.hsn_codes or [])

    if inv_hsn_set and gstr_hsn_set:
        # If invoice HSNs are not a subset of GSTR-2B HSNs → mismatch
        if not inv_hsn_set.issubset(gstr_hsn_set):
            total_itc = extracted.cgst + extracted.sgst + extracted.igst
            return MatchResult(
                mismatch_type=MismatchType.HSN_MISMATCH,
                matched_record=matched,
                itc_at_risk=total_itc,
                delta_detail=(
                    f"Invoice HSNs {sorted(inv_hsn_set)} "
                    f"not in GSTR-2B HSNs {sorted(gstr_hsn_set)}"
                ),
            )

    # ── Step 3: Tax rate comparison ──────────────────────────────────────────
    # For now, compare total tax rates implied by the amounts.
    # taxable_value > 0 guard prevents division-by-zero.
    if extracted.taxable_value > 0 and (matched.taxable_value or 0) > 0:
        inv_rate  = (extracted.cgst + extracted.sgst + extracted.igst) / extracted.taxable_value
        gstr_rate = ((matched.cgst or 0) + (matched.sgst or 0) + (matched.igst or 0)) / matched.taxable_value

        # Rates differ by more than 1 percentage point → RATE_MISMATCH
        # (mirrors rate_mismatch detection in matching-engine.ts)
        if abs(inv_rate - gstr_rate) > 0.01:
            # ITC at risk = difference in total tax claimed
            inv_total_tax  = extracted.cgst + extracted.sgst + extracted.igst
            gstr_total_tax = (matched.cgst or 0) + (matched.sgst or 0) + (matched.igst or 0)
            delta          = abs(inv_total_tax - gstr_total_tax)
            return MatchResult(
                mismatch_type=MismatchType.RATE_MISMATCH,
                matched_record=matched,
                itc_at_risk=delta,
                delta_detail=(
                    f"Invoice effective rate {inv_rate*100:.1f}% "
                    f"vs GSTR-2B {gstr_rate*100:.1f}%"
                ),
            )

    # ── Step 4: Absolute tax amount delta ────────────────────────────────────
    inv_total_tax  = extracted.cgst + extracted.sgst + extracted.igst
    gstr_total_tax = (matched.cgst or 0) + (matched.sgst or 0) + (matched.igst or 0)

    if gstr_total_tax > 0:
        relative_delta = abs(inv_total_tax - gstr_total_tax) / gstr_total_tax
        if relative_delta > TAX_DELTA_THRESHOLD:
            return MatchResult(
                mismatch_type=MismatchType.TAX_AMOUNT_DELTA,
                matched_record=matched,
                itc_at_risk=abs(inv_total_tax - gstr_total_tax),
                delta_detail=(
                    f"Invoice tax ₹{inv_total_tax:.0f} "
                    f"vs GSTR-2B ₹{gstr_total_tax:.0f} "
                    f"({relative_delta*100:.1f}% delta)"
                ),
            )

    # ── Step 5: Clean match ──────────────────────────────────────────────────
    return MatchResult(
        mismatch_type=MismatchType.CLEAN_MATCH,
        matched_record=matched,
        itc_at_risk=0.0,
    )
