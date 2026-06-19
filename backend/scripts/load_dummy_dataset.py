"""
scripts/load_dummy_dataset.py

Load GSTR-2B records from a real GST-portal-format CSV into the SQLite DB.

Usage
-----
    # Default: loads backend/dummy_gstr2b.csv (the realistic demo scenario)
    cd backend
    python scripts/load_dummy_dataset.py

    # Or point at any test-csv/*.csv file:
    python scripts/load_dummy_dataset.py --csv ../test-csv/gstr2b-all-clean.csv

CSV format (real GST portal export, same as test-csv/*.csv):
    GSTIN of Supplier, Trade Name, Invoice Number, Invoice Date,
    Invoice Value, Taxable Value, IGST, CGST, SGST,
    Place of Supply, Reverse Charge,
    HSN Code, Description, Quantity, Unit,
    Item Taxable Value, Tax Rate, Item CGST, Item SGST, Item IGST

Multi-row entries (multiple line items per invoice) are grouped by
GSTIN + Invoice Number — exactly as app/src/data/parse-gstr2b-csv.ts does.

The script is idempotent: re-running it skips records that already exist.
"""
import argparse
import csv
import os
import sys
from datetime import datetime
from typing import Optional

# Allow running from anywhere inside the repo
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.session import SessionLocal, Base, engine
from models.gstr2b import GSTR2BRecord


# ---------------------------------------------------------------------------
# Date parsing helper
# ---------------------------------------------------------------------------

def _parse_date(raw: str):
    """DD-MM-YYYY → Python date."""
    raw = raw.strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{raw}'")


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------

def _float(val: str, default: float = 0.0) -> float:
    try:
        return float(val.strip()) if val.strip() else default
    except ValueError:
        return default


def load_csv(csv_path: str) -> None:
    """Parse *csv_path* and upsert GSTR2BRecord rows."""

    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    # Ensure tables exist (idempotent)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Group rows by (gstin, invoice_number) → collect line items
        entries: dict[str, dict] = {}
        order:   list[str]       = []  # preserve file order

        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            # Validate header
            required_cols = {
                "GSTIN of Supplier", "Invoice Number", "Invoice Date",
                "Taxable Value", "CGST", "SGST", "IGST",
            }
            missing = required_cols - set(reader.fieldnames or [])
            if missing:
                print(
                    f"ERROR: CSV is missing required columns: {missing}\n"
                    f"       Found columns: {reader.fieldnames}",
                    file=sys.stderr,
                )
                sys.exit(1)

            for row in reader:
                gstin          = row["GSTIN of Supplier"].strip()
                invoice_number = row["Invoice Number"].strip()

                if not gstin or not invoice_number:
                    continue  # skip blank rows

                key = f"{gstin}|{invoice_number}"

                line_item = {
                    "hsn_code":      row.get("HSN Code", "").strip(),
                    "description":   row.get("Description", "").strip(),
                    "quantity":      _float(row.get("Quantity", "")),
                    "unit":          row.get("Unit", "").strip(),
                    "taxable_value": _float(row.get("Item Taxable Value", "")),
                    "tax_rate":      _float(row.get("Tax Rate", "")),
                    "cgst":          _float(row.get("Item CGST", "")),
                    "sgst":          _float(row.get("Item SGST", "")),
                    "igst":          _float(row.get("Item IGST", "")),
                }

                if key not in entries:
                    order.append(key)
                    entries[key] = {
                        "gstin":          gstin,
                        "invoice_number": invoice_number,
                        "invoice_date":   _parse_date(row["Invoice Date"]),
                        "supplier_name":  row.get("Trade Name", "").strip(),
                        "invoice_value":  _float(row.get("Invoice Value", "")),
                        "taxable_value":  _float(row["Taxable Value"]),
                        "igst":           _float(row["IGST"]),
                        "cgst":           _float(row["CGST"]),
                        "sgst":           _float(row["SGST"]),
                        "place_of_supply": row.get("Place of Supply", "").strip(),
                        "reverse_charge": row.get("Reverse Charge", "N").strip(),
                        "line_items":     [],
                        "hsn_codes":      [],
                        "source_file":    os.path.basename(csv_path),
                    }

                entries[key]["line_items"].append(line_item)
                hsn = line_item["hsn_code"]
                if hsn and hsn not in entries[key]["hsn_codes"]:
                    entries[key]["hsn_codes"].append(hsn)

        # Upsert into DB
        added = 0
        skipped = 0

        for key in order:
            e = entries[key]
            existing = (
                db.query(GSTR2BRecord)
                .filter(
                    GSTR2BRecord.supplier_gstin == e["gstin"],
                    GSTR2BRecord.invoice_number == e["invoice_number"],
                )
                .first()
            )
            if existing:
                skipped += 1
                continue

            record = GSTR2BRecord(
                supplier_gstin   = e["gstin"],
                invoice_number   = e["invoice_number"],
                invoice_date     = e["invoice_date"],
                supplier_name    = e["supplier_name"],
                invoice_value    = e["invoice_value"],
                taxable_value    = e["taxable_value"],
                igst             = e["igst"],
                cgst             = e["cgst"],
                sgst             = e["sgst"],
                total_tax        = e["cgst"] + e["sgst"] + e["igst"],
                place_of_supply  = e["place_of_supply"],
                reverse_charge   = e["reverse_charge"],
                line_items       = e["line_items"],
                hsn_codes        = e["hsn_codes"],
                ims_status       = "pending",
                source_file      = e["source_file"],
            )
            db.add(record)
            added += 1

        db.commit()
        total = added + skipped
        print(
            f"Loaded '{os.path.basename(csv_path)}': "
            f"{total} entries processed — {added} added, {skipped} already existed."
        )

    finally:
        db.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Load GSTR-2B records from a real GST-portal CSV into the database."
    )
    default_csv = os.path.join(os.path.dirname(__file__), "..", "dummy_gstr2b.csv")
    parser.add_argument(
        "--csv",
        default=os.path.abspath(default_csv),
        help="Path to CSV file (default: backend/dummy_gstr2b.csv)",
    )
    args = parser.parse_args()
    load_csv(os.path.abspath(args.csv))
