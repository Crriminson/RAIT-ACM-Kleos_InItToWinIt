import Papa from 'papaparse';
import { Gstr2bEntry, Gstr2bLineItem } from './types';

interface CsvRow {
  'GSTIN of Supplier': string;
  'Trade Name': string;
  'Invoice Number': string;
  'Invoice Date': string;
  'Invoice Value': string;
  'Taxable Value': string;
  IGST: string;
  CGST: string;
  SGST: string;
  'Place of Supply': string;
  'Reverse Charge': string;
  'HSN Code': string;
  Description: string;
  Quantity: string;
  Unit: string;
  'Item Taxable Value': string;
  'Tax Rate': string;
  'Item CGST': string;
  'Item SGST': string;
  'Item IGST': string;
}

function parseDate(dateStr: string): string {
  // DD-MM-YYYY → YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length <= 2) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}

export function parseGstr2bCsv(csvText: string): Gstr2bEntry[] {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const entriesByKey = new Map<string, Gstr2bEntry>();

  for (const row of parsed.data) {
    const gstin = row['GSTIN of Supplier']?.trim();
    const invoiceNumber = row['Invoice Number']?.trim();
    if (!gstin || !invoiceNumber) continue;

    const key = `${gstin}|${invoiceNumber}`;

    const lineItem: Gstr2bLineItem = {
      hsnCode: row['HSN Code']?.trim() ?? '',
      description: row['Description']?.trim() ?? '',
      quantity: parseFloat(row['Quantity']) || 0,
      unit: row['Unit']?.trim() ?? '',
      taxableValue: parseFloat(row['Item Taxable Value']) || 0,
      taxRate: parseFloat(row['Tax Rate']) || 0,
      cgst: parseFloat(row['Item CGST']) || 0,
      sgst: parseFloat(row['Item SGST']) || 0,
      igst: parseFloat(row['Item IGST']) || 0,
    };

    const existing = entriesByKey.get(key);
    if (existing) {
      existing.items.push(lineItem);
    } else {
      entriesByKey.set(key, {
        gstin,
        supplierName: row['Trade Name']?.trim() ?? '',
        invoiceNumber,
        invoiceDate: parseDate(row['Invoice Date']?.trim() ?? ''),
        invoiceValue: parseFloat(row['Invoice Value']) || 0,
        taxableValue: parseFloat(row['Taxable Value']) || 0,
        igst: parseFloat(row['IGST']) || 0,
        cgst: parseFloat(row['CGST']) || 0,
        sgst: parseFloat(row['SGST']) || 0,
        placeOfSupply: row['Place of Supply']?.trim() ?? '',
        reverseCharge: row['Reverse Charge']?.trim() === 'Y' ? 'Y' : 'N',
        items: [lineItem],
      });
    }
  }

  return Array.from(entriesByKey.values());
}
