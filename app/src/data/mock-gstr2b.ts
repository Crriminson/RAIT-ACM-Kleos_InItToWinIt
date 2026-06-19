import { Gstr2bEntry } from './types';

// GSTR-2B for period: May 2026
// Buyer GSTIN: 09AABCU9603R1ZX (our trader in Lucknow, UP)
// This represents what the GST portal shows — supplier-side filings only.
// Sharma Supplies (missing transaction scenario) is ABSENT from this list.

export const GSTR2B_PERIOD = '052026';
export const GSTR2B_BUYER_GSTIN = '09AABCU9603R1ZX';
export const GSTR2B_BUYER_NAME = 'Vijay Kirana Store';

export const mockGstr2b: Gstr2bEntry[] = [
  // --- SCENARIO: Wrong HSN code (Ramesh Traders) ---
  // Supplier filed HSN 1905 (Bakery products, 18%) instead of HSN 1006 (Rice, 5%)
  // The invoice itself says Rice at 5%, but in 2B it shows up as bakery at 18%
  // ITC blocked: ₹2,400 (the trader's actual tax paid)
  {
    gstin: '09AAACR5055K1Z7',
    supplierName: 'Ramesh Traders',
    invoiceNumber: 'RT/2026/0547',
    invoiceDate: '2026-05-08',
    invoiceValue: 50400,
    taxableValue: 48000,
    igst: 0,
    cgst: 4320,
    sgst: 4320,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: [
      {
        hsnCode: '1905',
        description: 'Bakery products',
        quantity: 200,
        unit: 'KGS',
        taxableValue: 48000,
        taxRate: 18,
        cgst: 4320,
        sgst: 4320,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Rate mismatch (Gupta Electronics) ---
  // Supplier filed 12% GST, but trader's invoice shows 18%
  // ITC difference at risk: ₹720
  {
    gstin: '09CCCPG7777N1Z3',
    supplierName: 'Gupta Electronics',
    invoiceNumber: 'GE/26-27/1034',
    invoiceDate: '2026-05-15',
    invoiceValue: 13440,
    taxableValue: 12000,
    igst: 0,
    cgst: 720,
    sgst: 720,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: [
      {
        hsnCode: '8528',
        description: 'LED Display Unit',
        quantity: 1,
        unit: 'NOS',
        taxableValue: 12000,
        taxRate: 12,
        cgst: 720,
        sgst: 720,
        igst: 0,
      },
    ],
  },

  // --- SCENARIO: Clean match (Patel Brothers) ---
  {
    gstin: '09DDDPP6666L1Z1',
    supplierName: 'Patel Brothers',
    invoiceNumber: 'PB/2026/3321',
    invoiceDate: '2026-05-03',
    invoiceValue: 33600,
    taxableValue: 32000,
    igst: 0,
    cgst: 800,
    sgst: 800,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: [
      {
        hsnCode: '0402',
        description: 'Milk powder & dairy products',
        quantity: 400,
        unit: 'KGS',
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
    gstin: '09EEEKK5555P1Z9',
    supplierName: 'Kumar General Store',
    invoiceNumber: 'KGS/26/0088',
    invoiceDate: '2026-05-11',
    invoiceValue: 18900,
    taxableValue: 18000,
    igst: 0,
    cgst: 450,
    sgst: 450,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: [
      {
        hsnCode: '1701',
        description: 'Cane sugar',
        quantity: 600,
        unit: 'KGS',
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
    gstin: '09FFFSS4444Q1Z7',
    supplierName: 'Singh Oil Mills',
    invoiceNumber: 'SOM/2026/0271',
    invoiceDate: '2026-05-19',
    invoiceValue: 26250,
    taxableValue: 25000,
    igst: 0,
    cgst: 625,
    sgst: 625,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: [
      {
        hsnCode: '1508',
        description: 'Groundnut oil',
        quantity: 250,
        unit: 'LTR',
        taxableValue: 25000,
        taxRate: 5,
        cgst: 625,
        sgst: 625,
        igst: 0,
      },
    ],
  },
];
