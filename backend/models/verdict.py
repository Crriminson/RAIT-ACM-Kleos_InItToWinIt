import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from db.session import Base
from sqlalchemy.orm import relationship

class Verdict(Base):
    __tablename__ = "verdicts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id = Column(String, ForeignKey("invoices.id"))
    gstr2b_record_id = Column(String, ForeignKey("gstr2b_records.id"), nullable=True)
    created_at = Column(DateTime)
    action = Column(String, nullable=False)  # 'ACCEPT', 'REJECT', 'HOLD'
    reason_code = Column(String, nullable=False)
    reason_text_en = Column(String, nullable=False)
    reason_text_hi = Column(String)
    action_text_en = Column(String)
    action_text_hi = Column(String)
    tts_url_en = Column(String)
    tts_url_hi = Column(String)
    itc_impact_inr = Column(Float, nullable=False)
    confidence = Column(Float)
    match_status = Column(String)  # 'matched', 'unmatched', 'partial'
    is_recoverable = Column(String) # 'true'/'false'/'unknown'
    
    invoice = relationship("Invoice", back_populates="verdicts")
    gstr2b_record = relationship("GSTR2BRecord", back_populates="verdicts")
