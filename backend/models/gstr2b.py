import uuid
from sqlalchemy import Column, String, Float, Date, JSON, Boolean
from db.session import Base
from sqlalchemy.orm import relationship


class GSTR2BRecord(Base):
    __tablename__ = "gstr2b_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # ── Key columns (lookup key: supplier_gstin + normalized invoice_number) ──
    supplier_gstin   = Column(String, nullable=False, index=True)
    invoice_number   = Column(String, nullable=False, index=True)
    invoice_date     = Column(Date,   nullable=False)

    # ── Identity ─────────────────────────────────────────────────────────────
    supplier_name    = Column(String, nullable=True)   # "Trade Name" from CSV
    invoice_value    = Column(Float,  nullable=True)   # Total invoice value (incl. tax)
    place_of_supply  = Column(String, nullable=True)   # e.g. "09-Uttar Pradesh"
    reverse_charge   = Column(String, nullable=True)   # "Y" or "N"

    # ── Aggregate tax fields ──────────────────────────────────────────────────
    taxable_value    = Column(Float, nullable=True)
    cgst             = Column(Float, nullable=True)
    sgst             = Column(Float, nullable=True)
    igst             = Column(Float, nullable=True)
    total_tax        = Column(Float, nullable=True)

    # ── Line-item detail ──────────────────────────────────────────────────────
    # JSON array — each element matches the LineItem dataclass in models/extraction.py
    # [{ "hsn_code": str, "description": str, "quantity": float, "unit": str,
    #    "taxable_value": float, "tax_rate": float, "cgst": float, "sgst": float, "igst": float }]
    line_items       = Column(JSON, nullable=True, default=list)

    # Convenience flat array of HSN codes (derived from line_items) for fast set comparison
    hsn_codes        = Column(JSON, nullable=True, default=list)

    # ── IMS state ─────────────────────────────────────────────────────────────
    ims_status       = Column(String, default="pending")  # pending/accepted/rejected/held

    # ── Provenance ────────────────────────────────────────────────────────────
    source_file      = Column(String, nullable=True)

    verdicts = relationship("Verdict", back_populates="gstr2b_record")
