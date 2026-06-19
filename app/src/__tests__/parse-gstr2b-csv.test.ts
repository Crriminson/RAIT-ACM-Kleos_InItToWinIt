/**
 * Unit tests for the GSTR-2B CSV importer.
 *
 * The importer turns the portal's flat CSV export (one row per line item) into
 * the nested Gstr2bEntry[] the matching engine consumes — grouping line items
 * under their (GSTIN, invoice number) key and normalising the date format.
 */
import { describe, it, expect } from '@jest/globals';
import { parseGstr2bCsv } from '../data/parse-gstr2b-csv';

const HEADER =
  'GSTIN of Supplier,Trade Name,Invoice Number,Invoice Date,Invoice Value,Taxable Value,IGST,CGST,SGST,Place of Supply,Reverse Charge,HSN Code,Description,Quantity,Unit,Item Taxable Value,Tax Rate,Item CGST,Item SGST,Item IGST';

describe('parseGstr2bCsv', () => {
  it('parses a single-line invoice into one entry', () => {
    const csv = [
      HEADER,
      '09AAACR5055K1Z7,Ramesh Traders,RT/2026/0547,08-05-2026,50400,48000,0,4320,4320,09-Uttar Pradesh,N,1905,Bakery products,200,KGS,48000,18,4320,4320,0',
    ].join('\n');

    const entries = parseGstr2bCsv(csv);
    expect(entries).toHaveLength(1);

    const e = entries[0];
    expect(e.gstin).toBe('09AAACR5055K1Z7');
    expect(e.supplierName).toBe('Ramesh Traders');
    expect(e.invoiceNumber).toBe('RT/2026/0547');
    expect(e.cgst).toBe(4320);
    expect(e.reverseCharge).toBe('N');
    expect(e.items).toHaveLength(1);
    expect(e.items[0].hsnCode).toBe('1905');
    expect(e.items[0].taxRate).toBe(18);
  });

  it('converts DD-MM-YYYY dates to ISO YYYY-MM-DD', () => {
    const csv = [
      HEADER,
      '09AAACR5055K1Z7,Ramesh Traders,RT/2026/0547,08-05-2026,50400,48000,0,4320,4320,09-Uttar Pradesh,N,1905,Bakery,200,KGS,48000,18,4320,4320,0',
    ].join('\n');
    expect(parseGstr2bCsv(csv)[0].invoiceDate).toBe('2026-05-08');
  });

  it('groups multiple line items under one invoice', () => {
    const csv = [
      HEADER,
      '09DDDPP6666L1Z1,Patel Brothers,PB/2026/3321,03-05-2026,33600,32000,0,800,800,09-Uttar Pradesh,N,0402,Milk powder,400,KGS,16000,5,400,400,0',
      '09DDDPP6666L1Z1,Patel Brothers,PB/2026/3321,03-05-2026,33600,32000,0,800,800,09-Uttar Pradesh,N,1701,Sugar,200,KGS,16000,5,400,400,0',
    ].join('\n');

    const entries = parseGstr2bCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].items).toHaveLength(2);
    expect(entries[0].items.map((i) => i.hsnCode)).toEqual(['0402', '1701']);
  });

  it('keeps invoices from the same supplier with different numbers separate', () => {
    const csv = [
      HEADER,
      '09DDDPP6666L1Z1,Patel Brothers,PB/2026/3321,03-05-2026,33600,32000,0,800,800,09-Uttar Pradesh,N,0402,Milk,400,KGS,32000,5,800,800,0',
      '09DDDPP6666L1Z1,Patel Brothers,PB/2026/3322,04-05-2026,18900,18000,0,450,450,09-Uttar Pradesh,N,1701,Sugar,600,KGS,18000,5,450,450,0',
    ].join('\n');
    expect(parseGstr2bCsv(csv)).toHaveLength(2);
  });

  it('flags reverse-charge entries marked Y', () => {
    const csv = [
      HEADER,
      '09AAACR5055K1Z7,RCM Supplier,RC/2026/01,10-05-2026,1000,847,153,0,0,09-Uttar Pradesh,Y,9988,Service,1,NOS,847,18,0,0,153',
    ].join('\n');
    expect(parseGstr2bCsv(csv)[0].reverseCharge).toBe('Y');
  });

  it('skips rows missing a GSTIN or invoice number', () => {
    const csv = [
      HEADER,
      ',No GSTIN,INV1,01-05-2026,100,85,0,8,7,09-UP,N,1234,x,1,NOS,85,18,8,7,0',
      '09AAACR5055K1Z7,No Invoice Number,,01-05-2026,100,85,0,8,7,09-UP,N,1234,x,1,NOS,85,18,8,7,0',
    ].join('\n');
    expect(parseGstr2bCsv(csv)).toHaveLength(0);
  });

  it('tolerates whitespace-padded headers', () => {
    const paddedHeader = HEADER.split(',').map((h) => ` ${h} `).join(',');
    const csv = [
      paddedHeader,
      '09AAACR5055K1Z7,Ramesh Traders,RT/2026/0547,08-05-2026,50400,48000,0,4320,4320,09-Uttar Pradesh,N,1905,Bakery,200,KGS,48000,18,4320,4320,0',
    ].join('\n');
    const entries = parseGstr2bCsv(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].supplierName).toBe('Ramesh Traders');
  });

  it('returns an empty array for a header-only file', () => {
    expect(parseGstr2bCsv(HEADER)).toHaveLength(0);
  });
});
