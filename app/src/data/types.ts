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
  placeOfSupply?: string;
  ocr_raw_text?: string;
  s17_5?: BlockedCreditVerdict;
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
export type ImsAction = 'ACCEPT' | 'HOLD' | 'REJECT' | 'NOT_ON_IMS_YET' | 'VERIFY';

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
  type: 'missing_transaction' | 'pos_mismatch' | 'pos_mismatch_igst' | 'pos_mismatch_cgst_sgst' | 'pos_unreadable' | 'tax_unknown' | 'hsn_mismatch' | 'rate_mismatch' | 'clean_match';
  imsAction: ImsAction;
  is_recoverable?: boolean;
  invoiceId?: string;
  gstr2bEntry?: Gstr2bEntry;
  tts_url_hi?: string;
  tts_url_en?: string;
  supplierMessageDraftHi?: string;
  supplierMessageDraftEn?: string;
  s17_5?: BlockedCreditVerdict;
}

export interface PosMismatchResult {
  invoice_number: string;
  pos_status: 'resolved' | 'unreadable';
  supplier_state_code: string;
  pos_resolved: string | null;
  trader_state_code: string;
  expected_tax_type: 'IGST' | 'CGST_SGST' | 'CGST_UTGST' | 'UNKNOWN';
  actual_tax_type: 'IGST' | 'CGST_SGST' | 'UTGST' | 'UNKNOWN';
  mismatch_result: 'MATCH' | 'MISMATCH_NEEDS_IGST' | 'MISMATCH_NEEDS_CGST_SGST' | 'POS_UNREADABLE' | 'TAX_TYPE_UNKNOWN';
  itc_at_risk_inr: number;
  verdict: {
    ims_action: ImsAction | 'VERIFY';
    is_recoverable: boolean | null;
    headline_hi: string;
    headline_en: string;
    reason_hi: string;
    reason_en: string;
    action_instruction_hi: string;
    action_instruction_en: string;
    supplier_message_draft_hi: string | null;
    supplier_message_draft_en: string | null;
  };
}

export interface BlockedCreditVerdict {
  invoice_number: string;
  s17_5_flag: 'NONE' | 'FLAGGED';
  category: string | null;
  category_code: 'MOTOR_VEHICLE' | 'FOOD_BEVERAGE' | 'CLUB_MEMBERSHIP' | 'RENT_A_CAB' | 'INSURANCE' | 'WORKS_CONTRACT_CONSTRUCTION' | 'BEAUTY_HEALTH' | 'OTHER_BLOCKED' | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  carve_out_possible: boolean | null;
  carve_out_reason: string | null;
  total_itc_at_question_inr: number | null;
  verdict_copy: {
    caution_strip_hi: string | null;
    caution_strip_en: string | null;
    expanded_explanation_hi: string | null;
    expanded_explanation_en: string | null;
    ca_verify_prompt_hi: string | null;
    ca_verify_prompt_en: string | null;
  };
}
