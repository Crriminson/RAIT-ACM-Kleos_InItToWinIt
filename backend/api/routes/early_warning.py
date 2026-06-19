from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.deps import get_db
from models.verdict import Verdict
from models.invoice import Invoice
from models.gstr2b import GSTR2BRecord

router = APIRouter(prefix="/early-warning", tags=["early-warning"])

@router.get(
    "",
    summary="Get GSTR-2A early warning list",
    response_description="List of suppliers who have not filed their GST returns",
)
async def get_early_warning(
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Identifies suppliers who have not yet filed their GSTR-1 (which populates the trader's GSTR-2A/2B).
    It does this by finding invoices in the purchase register that were flagged with RECORD_NOT_FOUND.
    Returns estimated ITC at risk per supplier.
    """
    # Find verdicts where the reason code indicates the record is missing from GSTR-2B
    verdicts = (
        db.query(Verdict, Invoice)
        .join(Invoice, Verdict.invoice_id == Invoice.id)
        .filter(Verdict.reason_code == "RECORD_NOT_FOUND")
        .all()
    )

    supplier_data = {}

    for verdict, invoice in verdicts:
        # Extract supplier details from the raw parsed JSON
        extracted = invoice.extracted_fields or {}
        gstin = extracted.get("supplier_gstin", "Unknown GSTIN")
        
        # We might not have a reliable name extracted, so fallback nicely
        name = extracted.get("supplier_name", "")
        if not name:
            name = f"Supplier ({gstin[:5]}...)"

        if gstin not in supplier_data:
            supplier_data[gstin] = {
                "supplier_name": name,
                "supplier_gstin": gstin,
                "unfiled_count": 0,
                "estimated_itc_at_risk": 0.0,
            }

        supplier_data[gstin]["unfiled_count"] += 1
        supplier_data[gstin]["estimated_itc_at_risk"] += abs(float(verdict.itc_impact_inr or 0))

    # Convert to list and sort by highest risk
    results = list(supplier_data.values())
    results.sort(key=lambda x: x["estimated_itc_at_risk"], reverse=True)

    # Format the ITC to 2 decimal places for JSON output
    for r in results:
        r["estimated_itc_at_risk"] = round(r["estimated_itc_at_risk"], 2)

    return JSONResponse(
        status_code=200,
        content={"suppliers": results}
    )
