import uuid
from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey
from db.session import Base
from sqlalchemy.orm import relationship

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    uploaded_at = Column(DateTime)
    source = Column(String)  # 'camera', 'upload', 'whatsapp_stub'
    raw_image_path = Column(String)
    ocr_raw_output = Column(JSON)  # raw OCR text
    extracted_fields = Column(JSON)  # structured extraction result
    extraction_status = Column(String)  # 'success', 'partial', 'failed'
    extraction_error = Column(String)
    
    verdicts = relationship("Verdict", back_populates="invoice")
