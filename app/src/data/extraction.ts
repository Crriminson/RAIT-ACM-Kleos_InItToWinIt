import { Invoice } from './types';
import { analyzeInvoice, AiMethod, ExtractedInvoiceData } from '../api/ai';
import { readAssetBase64 } from '../utils/file-read';

interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

function guessMime(file: PickedFile): string {
  if (file.mimeType) return file.mimeType;
  const n = file.name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Map the AI's extracted shape into the app's Invoice type used by the matching engine. */
export function mapExtractedToInvoice(
  data: ExtractedInvoiceData,
  id: string,
  imageUri?: string,
  traderGstin?: string,
): Invoice {
  const totalTax = Number(data.totalTax) || 0;

  // Determine intra-state vs inter-state:
  // Same first-2-digit state code → intra-state → CGST + SGST.
  // Different (or unknown trader GSTIN) → inter-state → IGST only.
  const supplierState = (data.supplierGSTIN || '').slice(0, 2);
  const traderState   = (traderGstin    || '').slice(0, 2);
  const isIntraState  = supplierState.length === 2 && traderState.length === 2
                        && supplierState === traderState;

  const cgst = isIntraState ? totalTax / 2 : 0;
  const sgst = isIntraState ? totalTax / 2 : 0;
  const igst = isIntraState ? 0            : totalTax;

  return {
    id,
    supplierGstin: (data.supplierGSTIN || '').trim().toUpperCase(),
    supplierName: data.supplierName || 'Unknown supplier',
    invoiceNumber: data.invoiceNumber || '',
    invoiceDate: data.invoiceDate || '',
    invoiceValue: (Number(data.taxableValue) || 0) + totalTax,
    taxableValue: Number(data.taxableValue) || 0,
    igst,
    cgst,
    sgst,
    imageUri,
    items: (data.items || []).map((it) => {
      const taxAmount = Number(it.taxAmount) || 0;
      const itSupplierState = (data.supplierGSTIN || '').slice(0, 2);
      const itIntraState    = itSupplierState.length === 2 && traderState.length === 2
                              && itSupplierState === traderState;
      return {
        hsnCode: String(it.hsnCode || ''),
        description: it.description || '',
        quantity: 1,
        unit: 'NOS',
        rate: Number(it.taxableValue) || 0,
        taxableValue: Number(it.taxableValue) || 0,
        taxRate: Number(it.taxRate) || 0,
        cgst: itIntraState ? taxAmount / 2 : 0,
        sgst: itIntraState ? taxAmount / 2 : 0,
        igst: itIntraState ? 0             : taxAmount,
      };
    }),
  };
}

/**
 * Read an invoice file as base64, send it to the AI server for extraction,
 * and return it as an Invoice. Throws if the file can't be read or the
 * server is unreachable (caller decides how to handle).
 *
 * OCR pipeline:
 *   1. ML Kit (on-device, instant, no network) → ocrText sent to backend
 *   2. Backend extracts fields from ocrText (regex + spatial matching)
 *   3. If ML Kit text is empty/non-invoice → backend uses Gemini vision fallback
 *
 * @param traderGstin  The trader's own GSTIN (from ProfileContext). Used to
 *                     determine intra-state vs inter-state tax split.
 */
export async function extractInvoiceFromFile(
  file: PickedFile,
  id: string,
  traderGstin?: string,
): Promise<{ invoice: Invoice; method: AiMethod }> {
  const base64Data = await readAssetBase64({ uri: file.uri });

  // Step 1: Run ML Kit OCR on-device (fast, no network required)
  let ocrText: string | undefined;
  try {
    const { runOCR, looksLikeInvoice } = await import('../ocr/mlkit');
    const ocr = await runOCR(file.uri);
    if (ocr.text && looksLikeInvoice(ocr.text)) {
      ocrText = ocr.text;
    } else if (ocr.error) {
      console.warn('[OCR] ML Kit failed:', ocr.error);
    } else {
      console.warn('[OCR] ML Kit produced non-invoice text, passing to Gemini fallback');
    }
  } catch (err) {
    // ML Kit module not available (e.g. running in Expo Go) — skip silently.
    console.warn('[OCR] ML Kit unavailable, skipping on-device OCR:', err);
  }

  // Step 2: Send to backend — ocrText is used as primary; base64 for Gemini fallback
  const { data, method } = await analyzeInvoice({
    base64Data,
    mimeType: guessMime(file),
    fileName: file.name,
    ocrText,
  });

  return { invoice: mapExtractedToInvoice(data, id, file.uri, traderGstin), method };
}
