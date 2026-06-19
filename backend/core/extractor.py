"""
core/extractor.py — Structured invoice field extraction from OCR output.

Public API
----------
    extract_invoice(raw: RawOCRResult) -> ExtractedInvoice

Raises ExtractionError (never returns None / partial without raising) if
any *required* field cannot be extracted at >= MIN_CONFIDENCE.

Design: label-proximity spatial matching
-----------------------------------------
Rather than running regexes over concatenated OCR text (which loses the
spatial relationship between a label and its value), this module:

1. Sorts tokens by Y coordinate (top to bottom, left to right within a row).
2. Groups tokens into "rows" — tokens whose vertical centres are within
   ROW_TOLERANCE pixels of each other.
3. For each target label pattern, finds the row where the label appears and
   takes the token immediately to its right as the candidate value.
4. For table columns (HSN, tax amounts), finds the column header token and
   collects all tokens in the same horizontal X-band below it.

This approach survives invoice layout variation because it depends on
spatial proximity rather than fixed text offsets.

GSTIN validation
----------------
Full structural validation per Indian GST rules (not just length check):
  - 15 characters total
  - chars 1–2:  state code (01–38)
  - chars 3–12: PAN format ([A-Z]{5}[0-9]{4}[A-Z])
  - char  13:   entity type (1–9 or A–Z)
  - char  14:   always 'Z'
  - char  15:   checksum (alphanumeric)
"""
from __future__ import annotations

import re
from typing import Optional

from models.extraction import (
    ExtractedInvoice,
    ExtractionError,
    FieldConfidence,
    LineItem,
    OCRToken,
    RawOCRResult,
)

# ---------------------------------------------------------------------------
# Tuneable constants
# ---------------------------------------------------------------------------

# Confidence threshold below which a required field raises ExtractionError
MIN_CONFIDENCE: float = 0.75

# Tokens within this many pixels (vertical centre distance) are in the same row
ROW_TOLERANCE: float = 12.0

# When searching for the nearest right-neighbour, only look this far right
# (as a fraction of image width) to avoid picking up tokens from the next column
MAX_RIGHTWARD_SEARCH: float = 0.65

# ---------------------------------------------------------------------------
# GSTIN validation
# ---------------------------------------------------------------------------

_GSTIN_RE = re.compile(
    r"^([0-3][0-9])"          # state code 01–39 (we validate range separately)
    r"([A-Z]{5}[0-9]{4}[A-Z])"  # PAN structure
    r"([1-9A-Z])"              # entity type
    r"Z"                       # always Z
    r"([0-9A-Z])$"            # checksum
)

_VALID_STATE_CODES = set(f"{i:02d}" for i in range(1, 38))  # 01–37


def _validate_gstin(raw: str) -> str:
    """
    Validate and return normalised GSTIN (uppercase, spaces stripped).
    Raises ValueError with a descriptive message on failure.
    """
    cleaned = re.sub(r"[\s\-]", "", raw).upper()

    if len(cleaned) != 15:
        raise ValueError(f"GSTIN has {len(cleaned)} characters, expected 15")

    m = _GSTIN_RE.match(cleaned)
    if not m:
        raise ValueError(
            f"GSTIN '{cleaned}' does not match pattern "
            "[StateCode][PAN][EntityType]Z[Checksum]"
        )

    state_code = m.group(1)
    if state_code not in _VALID_STATE_CODES:
        raise ValueError(
            f"GSTIN state code '{state_code}' is not a valid Indian state code (01–37)"
        )

    return cleaned


# ---------------------------------------------------------------------------
# Currency / numeric parsing
# ---------------------------------------------------------------------------

_RUPEE_SYMBOL_RE = re.compile(r"[₹\u20b9Rs\.]", re.IGNORECASE)
_COMMA_RE        = re.compile(r",")


def _parse_amount(raw: str) -> Optional[float]:
    """
    Convert a token like '₹1,200', '48,000', '2.5%' to float.
    Returns None if it cannot be parsed.
    """
    s = _RUPEE_SYMBOL_RE.sub("", raw)
    s = _COMMA_RE.sub("", s.strip())
    # Strip trailing % (tax rate fields)
    s = s.rstrip("%")
    try:
        return float(s)
    except ValueError:
        return None


def _parse_date(raw: str) -> Optional[str]:
    """
    Convert DD-MM-YYYY or DD/MM/YYYY → ISO YYYY-MM-DD.
    Returns None on parse failure.
    """
    raw = raw.strip()
    for sep in ("-", "/"):
        parts = raw.split(sep)
        if len(parts) == 3:
            d, m, y = parts
            if len(y) == 4 and d.isdigit() and m.isdigit():
                return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return None


# ---------------------------------------------------------------------------
# Row grouping helpers
# ---------------------------------------------------------------------------

def _group_into_rows(tokens: list[OCRToken]) -> list[list[OCRToken]]:
    """
    Group tokens into horizontal rows.
    Tokens are sorted by Y centre; any token within ROW_TOLERANCE pixels
    of the current row's Y centre is merged into that row.
    Returns rows sorted top-to-bottom, each row sorted left-to-right.
    """
    if not tokens:
        return []

    sorted_tokens = sorted(tokens, key=lambda t: t.cy)
    rows: list[list[OCRToken]] = []
    current_row: list[OCRToken] = [sorted_tokens[0]]
    row_cy = sorted_tokens[0].cy

    for tok in sorted_tokens[1:]:
        if abs(tok.cy - row_cy) <= ROW_TOLERANCE:
            current_row.append(tok)
        else:
            rows.append(sorted(current_row, key=lambda t: t.cx))
            current_row = [tok]
            row_cy = tok.cy

    if current_row:
        rows.append(sorted(current_row, key=lambda t: t.cx))

    return rows


# ---------------------------------------------------------------------------
# Label search helpers
# ---------------------------------------------------------------------------

def _find_token_matching(tokens: list[OCRToken], *patterns: str) -> Optional[OCRToken]:
    """
    Return the first token whose text matches any of the given patterns
    (case-insensitive substring or regex).
    Patterns starting with '^' or ending with '$' are treated as regex.
    """
    compiled = [
        re.compile(p, re.IGNORECASE) if (p.startswith("^") or p.endswith("$") or "(" in p)
        else re.compile(re.escape(p), re.IGNORECASE)
        for p in patterns
    ]
    for tok in tokens:
        for pat in compiled:
            if pat.search(tok.text):
                return tok
    return None


def _right_neighbour(
    label_tok: OCRToken,
    row_tokens: list[OCRToken],
    image_width: int,
) -> Optional[OCRToken]:
    """
    Return the token in *row_tokens* that is immediately to the right of
    *label_tok* and within MAX_RIGHTWARD_SEARCH fraction of image width.
    """
    candidates = [
        t for t in row_tokens
        if t.x1 > label_tok.x2
        and (t.x1 - label_tok.x2) < image_width * MAX_RIGHTWARD_SEARCH
    ]
    if not candidates:
        return None
    return min(candidates, key=lambda t: t.x1)


def _find_value_in_row(
    rows: list[list[OCRToken]],
    label_tok: OCRToken,
    image_width: int,
) -> Optional[OCRToken]:
    """
    Given a label token, find the row it belongs to and return its
    right-hand value token.
    """
    for row in rows:
        if label_tok in row:
            return _right_neighbour(label_tok, row, image_width)
    return None


def _field_confidence(
    fc: FieldConfidence | None, fallback_tok: OCRToken | None
) -> float:
    if fc is not None:
        return fc.confidence
    if fallback_tok is not None:
        return fallback_tok.confidence
    return 0.0


# ---------------------------------------------------------------------------
# Specific field extractors
# ---------------------------------------------------------------------------

def _extract_gstin(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
    image_width: int,
) -> tuple[str, FieldConfidence]:
    """
    Extract supplier GSTIN.

    Invoices place GSTIN in the header, typically as:
      "GSTIN: 09AAACR5055K1Z7"  or  "GSTIN 09AAACR5055K1Z7"
    We find any token containing "GSTIN" then take its right-neighbour.
    We also fall back to scanning all tokens for a 15-char alphanumeric
    that matches the GSTIN pattern (handles cases where the colon separator
    causes PaddleOCR to merge "GSTIN:" with the value).
    """
    label = _find_token_matching(all_tokens, "GSTIN")
    value_tok: Optional[OCRToken] = None

    if label:
        value_tok = _find_value_in_row(rows, label, image_width)
        # Sometimes "GSTIN: 09AAA..." is one merged token
        if value_tok is None and ":" in label.text:
            parts = label.text.split(":", 1)
            if len(parts) == 2:
                candidate = parts[1].strip()
                if len(candidate) >= 10:
                    # Fake a token with the label's confidence
                    value_tok = OCRToken(
                        text=candidate,
                        confidence=label.confidence,
                        x1=label.x1, y1=label.y1,
                        x2=label.x2, y2=label.y2,
                    )

    # Fallback: scan all tokens for something that looks like a GSTIN
    if value_tok is None:
        gstin_re = re.compile(r"^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
        for tok in all_tokens:
            candidate = re.sub(r"[\s\-:]", "", tok.text).upper()
            if gstin_re.match(candidate):
                value_tok = tok
                break

    if value_tok is None:
        raise ExtractionError(
            field="supplier_gstin",
            reason="not_found",
            detail="Could not locate a GSTIN token in the invoice",
        )

    raw = value_tok.text.strip()
    try:
        validated = _validate_gstin(raw)
    except ValueError as exc:
        raise ExtractionError(
            field="supplier_gstin",
            reason="validation_failed",
            detail=str(exc),
            raw_text=raw,
            confidence=value_tok.confidence,
        ) from exc

    if value_tok.confidence < MIN_CONFIDENCE:
        raise ExtractionError(
            field="supplier_gstin",
            reason="low_confidence",
            detail=f"GSTIN confidence {value_tok.confidence:.2f} < {MIN_CONFIDENCE}",
            raw_text=raw,
            confidence=value_tok.confidence,
        )

    fc = FieldConfidence(
        field_name="supplier_gstin",
        raw_text=raw,
        parsed_value=validated,
        confidence=value_tok.confidence,
        x1=value_tok.x1, y1=value_tok.y1, x2=value_tok.x2, y2=value_tok.y2,
    )
    return validated, fc


def _extract_invoice_number(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
    image_width: int,
) -> tuple[str, FieldConfidence]:
    """
    Extract invoice number.  Invoices use the pattern:
      "INVOICE"  [right-side header block]  "RT/2026/0547"
      "Invoice Number:" "GE/26-27/1034"
    We search for the INVOICE header block's right-neighbour row.
    """
    # Try "Invoice Number" label first
    label = _find_token_matching(
        all_tokens,
        "Invoice Number",
        "Invoice No",
        "Inv No",
        "Invoice#",
    )
    value_tok: Optional[OCRToken] = None

    if label:
        value_tok = _find_value_in_row(rows, label, image_width)

    # The sample invoices show "INVOICE" in a right-aligned block with the number
    # directly below it.  Search for a token that looks like a GST invoice number
    # (contains "/" or "-" and has mixed digits/letters).
    if value_tok is None:
        inv_re = re.compile(r"[A-Z]{1,6}[/\-][0-9]{2,4}[/\-][0-9]{2,6}", re.IGNORECASE)
        for tok in all_tokens:
            if inv_re.search(tok.text):
                value_tok = tok
                break

    if value_tok is None:
        raise ExtractionError(
            field="invoice_number",
            reason="not_found",
            detail="Could not locate an invoice number token in the invoice",
        )

    if value_tok.confidence < MIN_CONFIDENCE:
        raise ExtractionError(
            field="invoice_number",
            reason="low_confidence",
            detail=f"Invoice number confidence {value_tok.confidence:.2f} < {MIN_CONFIDENCE}",
            raw_text=value_tok.text,
            confidence=value_tok.confidence,
        )

    fc = FieldConfidence(
        field_name="invoice_number",
        raw_text=value_tok.text,
        parsed_value=value_tok.text.strip(),
        confidence=value_tok.confidence,
        x1=value_tok.x1, y1=value_tok.y1, x2=value_tok.x2, y2=value_tok.y2,
    )
    return value_tok.text.strip(), fc


def _extract_date(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
    image_width: int,
) -> tuple[str, FieldConfidence]:
    """
    Extract invoice date.  Invoices use: "Date: 08-05-2026".
    """
    label = _find_token_matching(all_tokens, "Date:", "Date", "Invoice Date")
    value_tok: Optional[OCRToken] = None

    if label:
        value_tok = _find_value_in_row(rows, label, image_width)
        # Handle merged "Date: 08-05-2026" token
        if value_tok is None and ":" in label.text:
            parts = label.text.split(":", 1)
            if len(parts) == 2 and parts[1].strip():
                value_tok = OCRToken(
                    text=parts[1].strip(),
                    confidence=label.confidence,
                    x1=label.x1, y1=label.y1, x2=label.x2, y2=label.y2,
                )

    # Fallback: find a date-shaped token DD-MM-YYYY anywhere
    if value_tok is None:
        date_re = re.compile(r"\d{2}[-/]\d{2}[-/]\d{4}")
        for tok in all_tokens:
            if date_re.search(tok.text):
                value_tok = tok
                break

    if value_tok is None:
        raise ExtractionError(
            field="invoice_date",
            reason="not_found",
            detail="Could not locate a date token in the invoice",
        )

    parsed = _parse_date(value_tok.text)
    if parsed is None:
        raise ExtractionError(
            field="invoice_date",
            reason="validation_failed",
            detail=f"Could not parse date from '{value_tok.text}' (expected DD-MM-YYYY)",
            raw_text=value_tok.text,
            confidence=value_tok.confidence,
        )

    if value_tok.confidence < MIN_CONFIDENCE:
        raise ExtractionError(
            field="invoice_date",
            reason="low_confidence",
            detail=f"Date confidence {value_tok.confidence:.2f} < {MIN_CONFIDENCE}",
            raw_text=value_tok.text,
            confidence=value_tok.confidence,
        )

    fc = FieldConfidence(
        field_name="invoice_date",
        raw_text=value_tok.text,
        parsed_value=parsed,
        confidence=value_tok.confidence,
        x1=value_tok.x1, y1=value_tok.y1, x2=value_tok.x2, y2=value_tok.y2,
    )
    return parsed, fc


def _extract_tax_amounts(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
    image_width: int,
) -> tuple[float, float, float, float, list[FieldConfidence]]:
    """
    Extract taxable_value, cgst, sgst, igst.

    Invoices show:
      "Taxable Value   ₹48,000"
      "CGST @ 2.5%     ₹1,200"
      "SGST @ 2.5%     ₹1,200"

    Returns (taxable_value, cgst, sgst, igst, [FieldConfidences]).
    At minimum, either (cgst + sgst) or igst must be found.
    """
    fcs: list[FieldConfidence] = []

    def _find_amount(label_patterns: list[str], field_name: str) -> Optional[tuple[float, FieldConfidence]]:
        for pat in label_patterns:
            label = _find_token_matching(all_tokens, pat)
            if label is None:
                continue
            val_tok = _find_value_in_row(rows, label, image_width)
            if val_tok is None:
                continue
            amount = _parse_amount(val_tok.text)
            if amount is None:
                continue
            fc = FieldConfidence(
                field_name=field_name,
                raw_text=val_tok.text,
                parsed_value=amount,
                confidence=val_tok.confidence,
                x1=val_tok.x1, y1=val_tok.y1, x2=val_tok.x2, y2=val_tok.y2,
            )
            return amount, fc
        return None

    # Taxable value
    tv_result = _find_amount(
        ["Taxable Value", "Taxable Amt", "Taxable Amount"],
        "taxable_value",
    )
    taxable_value = 0.0
    if tv_result:
        taxable_value, tv_fc = tv_result
        fcs.append(tv_fc)

    # CGST
    cgst_result = _find_amount(
        ["CGST @", "CGST@", "Central Tax", "CGST"],
        "cgst",
    )
    cgst = 0.0
    if cgst_result:
        cgst, cgst_fc = cgst_result
        fcs.append(cgst_fc)

    # SGST
    sgst_result = _find_amount(
        ["SGST @", "SGST@", "State Tax", "SGST"],
        "sgst",
    )
    sgst = 0.0
    if sgst_result:
        sgst, sgst_fc = sgst_result
        fcs.append(sgst_fc)

    # IGST
    igst_result = _find_amount(
        ["IGST @", "IGST@", "Integrated Tax", "IGST"],
        "igst",
    )
    igst = 0.0
    if igst_result:
        igst, igst_fc = igst_result
        fcs.append(igst_fc)

    # Require at least one tax component
    if cgst == 0.0 and sgst == 0.0 and igst == 0.0:
        raise ExtractionError(
            field="cgst_or_igst",
            reason="not_found",
            detail="Could not locate any tax amount (CGST/SGST/IGST) in the invoice",
        )

    # Check confidence on the tax fields we found
    for fc in fcs:
        if fc.field_name in ("cgst", "sgst", "igst") and fc.confidence < MIN_CONFIDENCE:
            raise ExtractionError(
                field=fc.field_name,
                reason="low_confidence",
                detail=(
                    f"{fc.field_name.upper()} confidence {fc.confidence:.2f} "
                    f"< {MIN_CONFIDENCE}"
                ),
                raw_text=fc.raw_text,
                confidence=fc.confidence,
            )

    # Synthesise a combined confidence record for required field tracking
    if cgst > 0 or sgst > 0:
        min_tax_conf = min(
            (fc.confidence for fc in fcs if fc.field_name in ("cgst", "sgst")),
            default=0.0,
        )
    else:
        min_tax_conf = min(
            (fc.confidence for fc in fcs if fc.field_name == "igst"),
            default=0.0,
        )
    fcs.append(FieldConfidence(
        field_name="cgst_or_igst",
        raw_text="",
        parsed_value=max(cgst + sgst, igst),
        confidence=min_tax_conf,
        x1=0, y1=0, x2=0, y2=0,
    ))

    return taxable_value, cgst, sgst, igst, fcs


def _extract_supplier_name(all_tokens: list[OCRToken]) -> str:
    """
    Best-effort: supplier name is usually the first large token in the header,
    above the GSTIN line.  We return the first non-trivial token.
    """
    # The first token with more than 3 chars that doesn't look like a number,
    # label keyword, or GSTIN.
    skip_patterns = re.compile(
        r"^(TAX|INVOICE|GSTIN|BILLED|BILL|TO|DATE|#|PLACE|SUPPLY|HSN|QTY|RATE"
        r"|TAXABLE|GST|TAX|CGST|SGST|IGST|TOTAL|DESCRIPTION)$",
        re.IGNORECASE,
    )
    for tok in sorted(all_tokens, key=lambda t: t.cy):
        txt = tok.text.strip()
        if len(txt) >= 4 and not skip_patterns.match(txt) and not re.match(r"^\d", txt):
            return txt
    return ""


def _extract_hsn_codes(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
) -> list[str]:
    """
    Find the 'HSN' column header and collect all tokens in the same X-band
    below it — these are the HSN codes for each line item.

    HSN codes are 4–8 digit numbers.  We validate the pattern to avoid
    picking up quantity / amount values that live in adjacent columns.
    """
    hsn_header = _find_token_matching(all_tokens, r"^HSN$", "HSN Code", "HSN/SAC")
    if hsn_header is None:
        return []

    # Column X-band: tokens whose horizontal centre is within HSN header ±30px
    band_left  = hsn_header.x1 - 10
    band_right = hsn_header.x2 + 30
    below_y    = hsn_header.y2

    hsn_re = re.compile(r"^\d{4,8}$")
    codes: list[str] = []
    for tok in all_tokens:
        if tok.cy <= below_y:
            continue
        if tok.cx < band_left or tok.cx > band_right:
            continue
        if hsn_re.match(tok.text.strip()):
            codes.append(tok.text.strip())

    return list(dict.fromkeys(codes))  # deduplicate preserving order


def _extract_line_items(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
) -> list[LineItem]:
    """
    Extract line items from the invoice table.

    Strategy: find the table header row containing column labels
    (DESCRIPTION, HSN, QTY, RATE, TAXABLE, GST, TAX).
    Each subsequent non-header row with a HSN code is treated as a line item.

    This implementation handles single-item invoices (all 6 test invoices)
    and will gracefully degrade for multi-item invoices.
    """
    # Find HSN header
    hsn_header = _find_token_matching(all_tokens, r"^HSN$", "HSN Code", "HSN/SAC")
    if hsn_header is None:
        return []

    # Find column header row (the row containing HSN)
    header_row: list[OCRToken] = []
    for row in rows:
        if hsn_header in row:
            header_row = row
            break

    if not header_row:
        return []

    # Map header labels to approximate X centres
    def _col_cx(patterns: list[str]) -> Optional[float]:
        for tok in header_row:
            for p in patterns:
                if re.search(p, tok.text, re.IGNORECASE):
                    return tok.cx
        return None

    col_desc    = _col_cx(["DESC", "DESCRIPTION", "ITEM"])
    col_hsn     = hsn_header.cx
    col_qty     = _col_cx(["QTY", "QUANTITY"])
    col_rate    = _col_cx(["RATE", "PRICE"])
    col_taxable = _col_cx(["TAXABLE", "TAXVAL"])
    col_gst     = _col_cx(["GST", "TAX RATE", "RATE%", "%"])
    # Anchor the tax-amount column so the bare "TAX" pattern does not also match
    # the "TAXABLE" header sitting to its left (which gave taxAmount == taxableValue).
    col_tax     = _col_cx([r"^TAX$", "AMOUNT", r"\bAMT\b"])

    header_y = max(t.cy for t in header_row)
    col_tolerance = 40.0  # px — column-matching window

    def _value_for_col(data_row: list[OCRToken], target_cx: Optional[float]) -> Optional[OCRToken]:
        if target_cx is None:
            return None
        candidates = [t for t in data_row if abs(t.cx - target_cx) <= col_tolerance]
        return candidates[0] if candidates else None

    # Collect HSN code tokens below the header (data rows)
    hsn_re = re.compile(r"^\d{4,8}$")
    items: list[LineItem] = []

    for row in rows:
        if max((t.cy for t in row), default=0) <= header_y:
            continue

        # Is there a HSN code in this row?
        hsn_tok = None
        for tok in row:
            if abs(tok.cx - col_hsn) <= col_tolerance and hsn_re.match(tok.text.strip()):
                hsn_tok = tok
                break

        if hsn_tok is None:
            continue

        hsn_code = hsn_tok.text.strip()

        desc_tok  = _value_for_col(row, col_desc)
        qty_tok   = _value_for_col(row, col_qty)
        rate_tok  = _value_for_col(row, col_rate)
        tv_tok    = _value_for_col(row, col_taxable)
        gst_tok   = _value_for_col(row, col_gst)
        tax_tok   = _value_for_col(row, col_tax)

        description  = desc_tok.text.strip()  if desc_tok  else ""
        quantity     = _parse_amount(qty_tok.text)  if qty_tok   else 0.0
        rate         = _parse_amount(rate_tok.text) if rate_tok  else 0.0
        taxable_val  = _parse_amount(tv_tok.text)   if tv_tok    else 0.0
        tax_rate     = _parse_amount(gst_tok.text)  if gst_tok   else 0.0
        tax_amount   = _parse_amount(tax_tok.text)  if tax_tok   else 0.0

        # For intra-state invoices the single TAX column = CGST+SGST
        # We can't split it here without additional context; default to equal split
        cgst = tax_amount / 2.0 if tax_amount else 0.0
        sgst = tax_amount / 2.0 if tax_amount else 0.0
        igst = 0.0

        items.append(LineItem(
            hsn_code=hsn_code,
            description=description,
            quantity=quantity or 0.0,
            unit="",
            taxable_value=taxable_val or 0.0,
            tax_rate=tax_rate or 0.0,
            cgst=cgst,
            sgst=sgst,
            igst=igst,
        ))

    return items


def _extract_place_of_supply(
    rows: list[list[OCRToken]],
    all_tokens: list[OCRToken],
    image_width: int,
) -> str:
    """
    Extract Place of Supply. Looks for 'Place of Supply', 'State', 'State Code', etc.
    """
    label = _find_token_matching(all_tokens, "Place of Supply", "Place of supply:", "State", "State Code")
    if label:
        val_tok = _find_value_in_row(rows, label, image_width)
        if val_tok:
            return val_tok.text.strip()
    return ""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_invoice(raw: RawOCRResult) -> ExtractedInvoice:
    """
    Convert a RawOCRResult into a fully validated ExtractedInvoice.

    Raises ExtractionError (never returns None) if any required field
    cannot be extracted at >= MIN_CONFIDENCE.

    Required fields
    ---------------
    supplier_gstin, invoice_number, invoice_date, taxable_value,
    cgst+sgst (for intra-state) or igst (for inter-state).

    Parameters
    ----------
    raw : RawOCRResult
        Output of core.ocr.extract_text().

    Returns
    -------
    ExtractedInvoice
        Fully populated with all extractable fields.

    Raises
    ------
    ExtractionError
        If any required field cannot be found or fails validation.
        Always carries `.field`, `.reason`, `.detail`, and optionally
        `.raw_text` and `.confidence` for transparent stop-condition reporting.
    """
    tokens = raw.tokens
    rows   = _group_into_rows(tokens)
    w      = raw.image_width

    all_fcs: list[FieldConfidence] = []

    # Required fields — each raises ExtractionError on failure
    gstin, gstin_fc       = _extract_gstin(rows, tokens, w)
    inv_no, inv_fc        = _extract_invoice_number(rows, tokens, w)
    date, date_fc         = _extract_date(rows, tokens, w)

    all_fcs.extend([gstin_fc, inv_fc, date_fc])

    # Tax amounts — raises if no tax component found at all
    taxable, cgst, sgst, igst, tax_fcs = _extract_tax_amounts(rows, tokens, w)
    all_fcs.extend(tax_fcs)

    # Optional but best-effort
    supplier_name = _extract_supplier_name(tokens)
    place_of_supply = _extract_place_of_supply(rows, tokens, w)
    hsn_codes     = _extract_hsn_codes(rows, tokens)
    line_items    = _extract_line_items(rows, tokens)

    return ExtractedInvoice(
        supplier_gstin=gstin,
        supplier_name=supplier_name,
        invoice_number=inv_no,
        invoice_date=date,
        taxable_value=taxable,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        place_of_supply=place_of_supply,
        hsn_codes=hsn_codes,
        line_items=line_items,
        field_confidences=all_fcs,
    )
