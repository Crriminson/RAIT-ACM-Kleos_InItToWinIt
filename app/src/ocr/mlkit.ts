/**
 * src/ocr/mlkit.ts — On-device OCR via Google ML Kit Text Recognition.
 *
 * Public API
 * ----------
 *   runOCR(imageUri: string): Promise<OcrResult>
 *
 * Returns the recognised text as a single string (lines joined with '\n').
 * On failure, returns { text: '', error: string } so callers can fall back
 * gracefully rather than crashing.
 *
 * ML Kit runs 100% on-device — no network call, no API key needed.
 * Typical latency: 200–800 ms on a mid-range Android device.
 */

import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';

export interface OcrResult {
  /** Recognised text, lines joined with '\n'. Empty string on failure. */
  text: string;
  /** Present only when OCR failed (so callers can log / fall back). */
  error?: string;
}

/**
 * Run ML Kit text recognition on a local image URI.
 *
 * @param imageUri  A local file URI (e.g. from expo-camera or expo-image-picker).
 *                  Must be a `file://` URI — remote HTTP URIs are not supported.
 * @returns OcrResult with the extracted text (never throws).
 */
export async function runOCR(imageUri: string): Promise<OcrResult> {
  try {
    const result = await TextRecognition.recognize(
      imageUri,
      TextRecognitionScript.LATIN, // Covers English + numerals used on GST invoices
    );

    // Flatten all blocks → lines → elements into a single string.
    // Preserving line breaks helps the backend extractor find label–value pairs.
    const lines: string[] = [];
    for (const block of result.blocks) {
      for (const line of block.lines) {
        const lineText = line.elements.map((el) => el.text).join(' ');
        if (lineText.trim()) lines.push(lineText.trim());
      }
    }

    const text = lines.join('\n');
    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { text: '', error: message };
  }
}

/**
 * Quick sanity check: does the recognised text look like it came from a
 * GST invoice? Used to decide whether to try the Gemini vision fallback.
 *
 * Heuristic: a valid invoice text should contain at least one of the
 * keywords that appear on virtually every Indian GST invoice.
 */
export function looksLikeInvoice(text: string): boolean {
  if (!text || text.length < 40) return false;
  const upper = text.toUpperCase();
  const keywords = ['GSTIN', 'INVOICE', 'CGST', 'SGST', 'IGST', 'HSN', 'GST'];
  return keywords.some((kw) => upper.includes(kw));
}
