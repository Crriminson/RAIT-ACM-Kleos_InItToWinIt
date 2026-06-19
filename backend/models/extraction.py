"""
Pydantic data-shapes for the OCR → extraction pipeline.

These are NOT SQLAlchemy models — they are in-memory data contracts
between pipeline stages.  Persistence happens through models/invoice.py
(which stores extracted_fields as JSON).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Low-level OCR output
# ---------------------------------------------------------------------------

@dataclass
class OCRToken:
    """A single text token returned by PaddleOCR."""
    text: str
    confidence: float                    # 0.0 – 1.0
    # Axis-aligned bounding box: (x1, y1, x2, y2) in pixel coordinates
    # top-left = (x1, y1), bottom-right = (x2, y2)
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def cx(self) -> float:
        """Horizontal centre of the token."""
        return (self.x1 + self.x2) / 2.0

    @property
    def cy(self) -> float:
        """Vertical centre of the token."""
        return (self.y1 + self.y2) / 2.0

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1


@dataclass
class RawOCRResult:
    """Complete output of one PaddleOCR call on a single image."""
    tokens: list[OCRToken]
    image_width: int
    image_height: int
    processing_time_ms: float


# ---------------------------------------------------------------------------
# Extraction layer types
# ---------------------------------------------------------------------------

@dataclass
class FieldConfidence:
    """Per-field audit record: what OCR saw and how confident we are."""
    field_name: str       # e.g. "supplier_gstin"
    raw_text: str         # verbatim OCR text before any parsing
    parsed_value: Any     # the value actually used in ExtractedInvoice
    confidence: float     # 0.0 – 1.0  (from OCR token confidence)
    x1: float             # bounding box of the value token in the image
    y1: float
    x2: float
    y2: float


@dataclass
class LineItem:
    """A single product/service row from the invoice line-items table."""
    hsn_code: str
    description: str
    quantity: float
    unit: str
    taxable_value: float
    tax_rate: float       # GST rate in percent, e.g. 18.0
    cgst: float
    sgst: float
    igst: float


@dataclass
class ExtractedInvoice:
    """
    Structured extraction result for one invoice image.

    Required fields are non-optional; the extractor raises ExtractionError
    if any of them cannot be extracted at acceptable confidence.
    """
    # Required
    supplier_gstin: str
    invoice_number: str
    invoice_date: str         # ISO 8601: YYYY-MM-DD
    taxable_value: float
    cgst: float
    sgst: float
    igst: float

    # Optional fields (best-effort)
    supplier_name: str = ""
    place_of_supply: str = ""
    hsn_codes: list[str] = field(default_factory=list)
    line_items: list[LineItem] = field(default_factory=list)

    # Confidence audit
    field_confidences: list[FieldConfidence] = field(default_factory=list)

    @property
    def overall_confidence(self) -> float:
        """Minimum confidence across all *required* field extractions."""
        required_names = {
            "supplier_gstin", "invoice_number", "invoice_date",
            "taxable_value", "cgst_or_igst",
        }
        relevant = [
            fc.confidence for fc in self.field_confidences
            if fc.field_name in required_names
        ]
        return min(relevant) if relevant else 0.0

    def to_dict(self) -> dict:
        """Serialisable snapshot for storing in Invoice.extracted_fields JSON."""
        return {
            "supplier_gstin": self.supplier_gstin,
            "supplier_name": self.supplier_name,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date,
            "taxable_value": self.taxable_value,
            "cgst": self.cgst,
            "sgst": self.sgst,
            "igst": self.igst,
            "hsn_codes": self.hsn_codes,
            "line_items": [
                {
                    "hsn_code": li.hsn_code,
                    "description": li.description,
                    "quantity": li.quantity,
                    "unit": li.unit,
                    "taxable_value": li.taxable_value,
                    "tax_rate": li.tax_rate,
                    "cgst": li.cgst,
                    "sgst": li.sgst,
                    "igst": li.igst,
                }
                for li in self.line_items
            ],
            "overall_confidence": self.overall_confidence,
            "field_confidences": [
                {
                    "field_name": fc.field_name,
                    "raw_text": fc.raw_text,
                    "parsed_value": fc.parsed_value,
                    "confidence": fc.confidence,
                }
                for fc in self.field_confidences
            ],
        }


# ---------------------------------------------------------------------------
# Extraction failure
# ---------------------------------------------------------------------------

class ExtractionError(Exception):
    """
    Raised when a required field cannot be extracted at acceptable confidence.

    Attributes
    ----------
    field : str
        Exactly which field failed (e.g. "supplier_gstin").
    reason : str
        One of: "not_found" | "low_confidence" | "validation_failed"
    detail : str
        Human-readable explanation (e.g. "GSTIN has 14 chars, expected 15").
    raw_text : str | None
        What OCR actually found before the failure, if anything.
    confidence : float | None
        OCR confidence if applicable (helps stop-condition reporting).
    """

    def __init__(
        self,
        field: str,
        reason: str,
        detail: str,
        raw_text: str | None = None,
        confidence: float | None = None,
    ) -> None:
        super().__init__(detail)
        self.field = field
        self.reason = reason
        self.detail = detail
        self.raw_text = raw_text
        self.confidence = confidence

    def to_dict(self) -> dict:
        return {
            "error": "extraction_failed",
            "field": self.field,
            "reason": self.reason,
            "detail": self.detail,
            "raw_text": self.raw_text,
            "confidence": self.confidence,
        }
