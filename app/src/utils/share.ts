import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { DiagnosisResult } from '../data/types';
import { Language } from '../i18n/strings';

function formatRupee(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** Open WhatsApp with a pre-filled message; fall back to wa.me, then clipboard. */
export async function sendWhatsApp(message: string): Promise<'whatsapp' | 'web' | 'clipboard'> {
  const encoded = encodeURIComponent(message);
  try {
    const appUrl = `whatsapp://send?text=${encoded}`;
    const can = await Linking.canOpenURL(appUrl);
    if (can) {
      await Linking.openURL(appUrl);
      return 'whatsapp';
    }
  } catch {
    // fall through
  }
  try {
    await Linking.openURL(`https://wa.me/?text=${encoded}`);
    return 'web';
  } catch {
    await Clipboard.setStringAsync(message);
    return 'clipboard';
  }
}

// --- Web-only helpers (guarded by Platform.OS === 'web' at the call site) ---

/** Trigger a browser file download from in-memory content. */
function downloadFileWeb(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Render HTML into a hidden iframe and open the browser print dialog (Save as PDF). */
function printHtmlWeb(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }
  const win = iframe.contentWindow;
  const cleanup = () => setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* gone */ } }, 1000);
  win.onafterprint = cleanup;
  doc.open();
  doc.write(html);
  doc.close();
  // Give the browser a moment to lay out before printing.
  setTimeout(() => { win.focus(); win.print(); cleanup(); }, 350);
}

function csvCell(v: string | number): string {
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

export function buildReportCsv(results: DiagnosisResult[], lang: Language): string {
  const header = ['Supplier', 'Invoice No', 'Type', 'Severity', 'Amount (INR)', 'Reason', 'Action'];
  const rows = results.map((r) => [
    r.supplierName,
    r.invoiceNumber,
    r.type,
    r.severity,
    Math.round(r.amount),
    lang === 'hi' ? r.reason_hi : r.reason_en,
    lang === 'hi' ? r.action_hi : r.action_en,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

function cacheFileUri(name: string): string {
  const base = FileSystem.Paths.cache.uri;
  return base.endsWith('/') ? `${base}${name}` : `${base}/${name}`;
}

export async function exportCsv(
  results: DiagnosisResult[],
  lang: Language,
  period?: string,
): Promise<void> {
  const csv = buildReportCsv(results, lang);
  // Build filename from actual period, sanitised for filesystem safety.
  const safePeriod = (period || 'Report').replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `ITC-Report-${safePeriod}.csv`;

  if (Platform.OS === 'web') {
    downloadFileWeb(filename, csv, 'text/csv;charset=utf-8;');
    return;
  }

  const uri = cacheFileUri(filename);
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: 'utf8' as FileSystem.EncodingType });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'ITC Report (CSV)' });
  }
}

export function buildReportHtml(
  results: DiagnosisResult[],
  summary: { totalBlocked: number; totalPending: number; issueCount: number; resolvedCount: number; totalResolved: number },
  lang: Language,
  period?: string,
): string {
  const displayPeriod = period || 'May 2026';
  const sevColor = (s: string) => (s === 'blocked' ? '#D32F2F' : s === 'pending' ? '#E65100' : '#2E7D32');
  const title = lang === 'hi' ? `ITC जाँच रिपोर्ट — ${displayPeriod}` : `ITC Diagnosis Report — ${displayPeriod}`;
  const cards = results
    .map((r) => {
      const reason = lang === 'hi' ? r.reason_hi : r.reason_en;
      const action = lang === 'hi' ? r.action_hi : r.action_en;
      return `<div class="card" style="border-left:5px solid ${sevColor(r.severity)}">
        <div class="amt" style="color:${sevColor(r.severity)}">${formatRupee(r.amount)}</div>
        <div class="sup">${r.supplierName} · ${r.invoiceNumber}</div>
        <div class="reason">${reason}</div>
        ${r.severity !== 'resolved' ? `<div class="action">→ ${action}</div>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Roboto, sans-serif; padding: 32px; color: #0a0a0a; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .sum { background: #045EFE; color: #fff; padding: 18px 20px; border-radius: 14px; margin: 16px 0 24px; }
    .sum .big { font-size: 30px; font-weight: 800; }
    .card { border: 1px solid #E5E5E5; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; }
    .amt { font-size: 24px; font-weight: 800; }
    .sup { color: #888; font-size: 12px; margin-bottom: 6px; }
    .reason { font-size: 14px; }
    .action { font-size: 13px; color: #444; margin-top: 6px; }
    .foot { color: #999; font-size: 11px; margin-top: 24px; }
  </style></head><body>
    <h1>${title}</h1>
    <div class="sum">
      <div class="big">${formatRupee(summary.totalBlocked)} ${lang === 'hi' ? 'अटकी है' : 'blocked'}</div>
      <div>${summary.issueCount} ${lang === 'hi' ? 'समस्याएं' : 'issues'} · ${summary.resolvedCount} ${lang === 'hi' ? 'सही match' : 'matched'} (${formatRupee(summary.totalResolved)})</div>
    </div>
    ${cards}
    <div class="foot">Generated by CA in Your Pocket · KLEOS 2026</div>
  </body></html>`;
}

export async function exportPdf(
  results: DiagnosisResult[],
  summary: { totalBlocked: number; totalPending: number; issueCount: number; resolvedCount: number; totalResolved: number },
  lang: Language,
  period?: string,
): Promise<void> {
  const html = buildReportHtml(results, summary, lang, period);

  if (Platform.OS === 'web') {
    // No native print-to-file on web; open the browser print dialog so the
    // user can save the report as a PDF.
    printHtmlWeb(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'ITC Report (PDF)' });
  }
}

// CSV + PDF export now work on every platform (web via download / print dialog).
export const isExportSupported = true;
