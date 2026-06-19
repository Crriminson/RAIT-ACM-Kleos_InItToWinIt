import { AI_API_URL } from '../config';
import { Language } from '../i18n/strings';
import { Invoice, PosMismatchResult, BlockedCreditVerdict } from '../data/types';

export type AiMethod = 'gemini' | 'fallback';

export interface ExtractedInvoiceData {
  supplierName: string;
  supplierGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  totalTax: number;
  items: {
    description: string;
    hsnCode: string;
    taxableValue: number;
    taxRate: number;
    taxAmount: number;
  }[];
}

export interface AdvisoryData {
  adviceEn: string;
  adviceHi: string;
}

export interface Strategy {
  title: string;
  subtitle: string;
  description: string;
}

export interface CompareRow {
  aspect: string;
  invoiceAVal: string;
  invoiceBVal: string;
  status: string; // Match | Mismatch | Warning
}

export interface CompareData {
  summary: string;
  hasDiscrepancies: boolean;
  comparisonList: CompareRow[];
  auditObservations: string;
}

export interface InvoiceForCompare {
  supplierName: string;
  supplierGSTIN: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  totalTax: number;
  items: unknown[];
}

export interface EInvoiceAlertData {
  severity: 'approaching' | 'applies_now' | 'informational';
  headline_hi: string;
  headline_en: string;
  body_hi: string;
  body_en: string;
  action_label_hi: string;
  action_label_en: string;
  action_url: string;
  ca_nudge_hi: string;
  ca_nudge_en: string;
  disclaimer_hi: string;
  disclaimer_en: string;
}

export interface EInvoiceAlertResponse {
  method: AiMethod;
  data: {
    show_alert: boolean;
    alert: EInvoiceAlertData | null;
  };
}

// Offline OCR (PaddleOCR) runs ~24s/invoice on CPU, more on a cold first scan,
// so the per-request budget must comfortably exceed that. 45s was too tight and
// could abort a slow scan mid-flight.
const TIMEOUT_MS = 120000;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<{ ok: boolean; geminiConfigured: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${AI_API_URL}/api/health`, { signal: controller.signal });
    return await res.json();
  } catch {
    return { ok: false, geminiConfigured: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeInvoice(args: {
  base64Data: string;
  mimeType: string;
  fileName: string;
}): Promise<{ method: AiMethod; data: ExtractedInvoiceData }> {
  const r = await postJson<{ method: AiMethod; data: ExtractedInvoiceData }>(
    '/api/analyze-invoice',
    args,
  );
  return r;
}

export async function askGstDoubt(question: string, lang: Language): Promise<{ method: AiMethod; answer: string }> {
  return postJson('/api/gst-doubt', { question, lang });
}

export async function getAiAdvice(results: unknown[], invoices: unknown[]): Promise<{ method: AiMethod; data: AdvisoryData }> {
  return postJson('/api/ai-advice', { results, invoices });
}

export async function getTaxStrategies(args: {
  totalBlockedAmt: number;
  mismatchesCount: number;
  invoiceCount: number;
  lang: Language;
}): Promise<{ method: AiMethod; strategies: Strategy[] }> {
  return postJson('/api/tax-planning', args);
}

export async function compareInvoices(
  invoiceA: InvoiceForCompare,
  invoiceB: InvoiceForCompare,
  lang: Language,
): Promise<{ method: AiMethod; data: CompareData }> {
  return postJson('/api/compare-invoices', { invoiceA, invoiceB, lang });
}

export async function getEInvoiceAlert(args: {
  gstin: string;
  trader_name: string;
  reported_annual_turnover_inr: number | null;
  estimated_turnover_from_invoices_inr: number | null;
  invoice_count_this_month: number;
  ui_language: string;
  user_asked_about_einvoicing: boolean;
}): Promise<EInvoiceAlertResponse> {
  return postJson<EInvoiceAlertResponse>('/api/einvoice-alert', args);
}

export async function checkPosMismatchBatch(
  invoices: Invoice[],
  trader: { gstin: string; registered_state_code: string },
  lang: 'hi' | 'en' = 'hi',
): Promise<{ success: boolean; results?: PosMismatchResult[]; error?: string }> {
  try {
    const payloadInvoices = invoices.map(inv => {
      let tax_type = "UNKNOWN";
      if (inv.igst > 0 && inv.cgst === 0 && inv.sgst === 0) tax_type = "IGST";
      else if (inv.cgst > 0 && inv.sgst > 0 && inv.igst === 0) tax_type = "CGST_SGST";
      
      return {
        invoice_number: inv.invoiceNumber,
        invoice_date: inv.invoiceDate,
        supplier_name: inv.supplierName,
        supplier_gstin: inv.supplierGstin,
        place_of_supply_raw: inv.placeOfSupply || null,
        tax_type: tax_type,
        cgst_amount: inv.cgst,
        sgst_amount: inv.sgst,
        igst_amount: inv.igst,
        taxable_value: inv.taxableValue,
        total_itc_value: inv.cgst + inv.sgst + inv.igst
      };
    });

    const res = await fetch(`${AI_API_URL}/api/pos-mismatch-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoices: payloadInvoices,
        trader: trader,
        ui_language: lang
      }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function checkBlockedCredit(
  invoice: Invoice,
  trader: { gstin: string; business_description?: string },
  lang: Language,
): Promise<{ success: boolean; method: string; data?: BlockedCreditVerdict }> {
  const payload = {
    invoice: {
      invoice_number: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate,
      supplier_name: invoice.supplierName,
      supplier_gstin: invoice.supplierGstin || null,
      hsn_sac_codes: invoice.items.map(it => it.hsnCode).filter(Boolean),
      line_items: invoice.items.map(it => ({
        description: it.description,
        hsn_sac: it.hsnCode || null,
        amount: it.taxableValue
      })),
      total_itc_value: invoice.cgst + invoice.sgst + invoice.igst,
      ocr_raw_text: invoice.ocr_raw_text || ""
    },
    trader,
    ui_language: lang,
  };
  return postJson('/api/blocked-credit', payload);
}

