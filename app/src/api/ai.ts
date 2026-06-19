import { AI_API_URL } from '../config';
import { Language } from '../i18n/strings';

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
