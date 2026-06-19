export interface Gstr2bEntry {
  gstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  placeOfSupply: string;
  reverseCharge: 'Y' | 'N';
  items: Gstr2bLineItem[];
}

export interface Gstr2bLineItem {
  hsnCode: string;
  description: string;
  quantity: number;
  unit: string;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface Invoice {
  id: string;
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  items: InvoiceLineItem[];
  imageUri?: string;
}

export interface InvoiceLineItem {
  hsnCode: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxableValue: number;
  taxRate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

export type Severity = 'blocked' | 'pending' | 'resolved';

/**
 * IMS (Invoice Management System) portal action.
 * - ACCEPT: invoice matched cleanly — trader can claim ITC.
 * - HOLD: invoice exists but has a discrepancy — supplier must amend before ITC flows.
 * - NOT_ON_IMS_YET: supplier hasn't filed yet, so there is no IMS entry for the trader
 *   to act on. The trader should follow up with the supplier, not look for a portal button.
 */
export type ImsAction = 'ACCEPT' | 'HOLD' | 'NOT_ON_IMS_YET';

export interface DiagnosisResult {
  id: string;
  severity: Severity;
  amount: number;
  reason_hi: string;
  reason_en: string;
  action_hi: string;
  action_en: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  type: 'missing_transaction' | 'hsn_mismatch' | 'rate_mismatch' | 'clean_match';
  imsAction: ImsAction;
  invoiceId?: string;
  gstr2bEntry?: Gstr2bEntry;
}
