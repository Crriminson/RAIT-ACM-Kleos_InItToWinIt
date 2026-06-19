import os
import sys

# Allow running from anywhere inside the repo
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.session import SessionLocal
from models.verdict import Verdict
from models.invoice import Invoice

def run_test():
    db = SessionLocal()
    try:
        verdicts = (
            db.query(Verdict, Invoice)
            .join(Invoice, Verdict.invoice_id == Invoice.id)
            .filter(Verdict.reason_code == "RECORD_NOT_FOUND")
            .all()
        )
        
        print(f"Found {len(verdicts)} unfiled invoices.")
        supplier_data = {}
        for verdict, invoice in verdicts:
            extracted = invoice.extracted_fields or {}
            gstin = extracted.get("supplier_gstin", "Unknown GSTIN")
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

        results = list(supplier_data.values())
        results.sort(key=lambda x: x["estimated_itc_at_risk"], reverse=True)
        
        for r in results:
            print(f"- {r['supplier_name']} ({r['supplier_gstin']}): {r['unfiled_count']} pending, Rs {r['estimated_itc_at_risk']:.2f} at risk")
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
