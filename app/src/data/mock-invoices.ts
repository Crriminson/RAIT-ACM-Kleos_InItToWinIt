import { Invoice } from './types';

// The trader's own invoices for May 2026.
// These are what the trader physically has — WhatsApp images, paper receipts, PDFs.
// Compared against GSTR-2B to find mismatches.

export const mockInvoices: Invoice[] = [
  // --- SCENARIO: Wrong HSN (Ramesh Traders) ---
  // Trader's actual invoice says Rice (HSN 1006) at 5%
  // But Ramesh filed it as Bakery products (HSN 1905) at 18% in GSTR-2B
  // ITC blocked: ₹2,400 (trader paid ₹2,400 tax but can't claim it because HSN doesn't match)
  {
    id: 'inv-001',
    supplierGstin: '09AAACR5055K1Z7',
    supplierName: 'Ramesh Traders',
    invoiceNumber: 'RT/2026/0547',
    invoiceDate: '2026-05-08',
    invoiceValue: 50400,
    taxableValue: 48000,
    igst: 0,
    cgst: 1200,
    sgst: 1200,
    items: [
      {
        hsnCode: '1006',
        description: 'Basmati rice',
        quantity: 200,
        unit: 'KGS',
        rate: 240,
        taxableValue: 48000,
        taxRate: 5,
        cgst: 1200,
        sgst: 1200,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Missing transaction (Sharma Supplies) ---
  // Trader has this invoice, but Sharma never filed it in their GSTR-1
  // So it does NOT appear in the trader's GSTR-2B at all
  // ITC blocked entirely: ₹2,700
  {
    id: 'inv-002',
    supplierGstin: '09BBBCS8888M1Z5',
    supplierName: 'Sharma Supplies',
    invoiceNumber: 'SS/26-27/0412',
    invoiceDate: '2026-05-12',
    invoiceValue: 17700,
    taxableValue: 15000,
    igst: 0,
    cgst: 1350,
    sgst: 1350,
    items: [
      {
        hsnCode: '3401',
        description: 'Soap bars & detergent powder',
        quantity: 150,
        unit: 'NOS',
        rate: 100,
        taxableValue: 15000,
        taxRate: 18,
        cgst: 1350,
        sgst: 1350,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Rate mismatch (Gupta Electronics) ---
  // Trader's invoice says 18% GST, but Gupta filed at 12% in GSTR-2B
  // ITC difference at risk: ₹720 (trader paid ₹2,160 tax but 2B only shows ₹1,440)
  {
    id: 'inv-003',
    supplierGstin: '09CCCPG7777N1Z3',
    supplierName: 'Gupta Electronics',
    invoiceNumber: 'GE/26-27/1034',
    invoiceDate: '2026-05-15',
    invoiceValue: 14160,
    taxableValue: 12000,
    igst: 0,
    cgst: 1080,
    sgst: 1080,
    items: [
      {
        hsnCode: '8528',
        description: 'LED Display Unit',
        quantity: 1,
        unit: 'NOS',
        rate: 12000,
        taxableValue: 12000,
        taxRate: 18,
        cgst: 1080,
        sgst: 1080,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Clean match (Patel Brothers) ---
  {
    id: 'inv-004',
    supplierGstin: '09DDDPP6666L1Z1',
    supplierName: 'Patel Brothers',
    invoiceNumber: 'PB/2026/3321',
    invoiceDate: '2026-05-03',
    invoiceValue: 33600,
    taxableValue: 32000,
    igst: 0,
    cgst: 800,
    sgst: 800,
    items: [
      {
        hsnCode: '0402',
        description: 'Milk powder & dairy products',
        quantity: 400,
        unit: 'KGS',
        rate: 80,
        taxableValue: 32000,
        taxRate: 5,
        cgst: 800,
        sgst: 800,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Clean match (Kumar General Store) ---
  {
    id: 'inv-005',
    supplierGstin: '09EEEKK5555P1Z9',
    supplierName: 'Kumar General Store',
    invoiceNumber: 'KGS/26/0088',
    invoiceDate: '2026-05-11',
    invoiceValue: 18900,
    taxableValue: 18000,
    igst: 0,
    cgst: 450,
    sgst: 450,
    items: [
      {
        hsnCode: '1701',
        description: 'Cane sugar',
        quantity: 600,
        unit: 'KGS',
        rate: 30,
        taxableValue: 18000,
        taxRate: 5,
        cgst: 450,
        sgst: 450,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Clean match (Singh Oil Mills) ---
  {
    id: 'inv-006',
    supplierGstin: '09FFFSS4444Q1Z7',
    supplierName: 'Singh Oil Mills',
    invoiceNumber: 'SOM/2026/0271',
    invoiceDate: '2026-05-19',
    invoiceValue: 26250,
    taxableValue: 25000,
    igst: 0,
    cgst: 625,
    sgst: 625,
    items: [
      {
        hsnCode: '1508',
        description: 'Groundnut oil',
        quantity: 250,
        unit: 'LTR',
        rate: 100,
        taxableValue: 25000,
        taxRate: 5,
        cgst: 625,
        sgst: 625,
        igst: 0,
      },
    ],
  },
];
