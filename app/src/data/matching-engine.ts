import { Gstr2bEntry, Invoice, DiagnosisResult, Severity } from './types';

function normalizeInvoiceNumber(inv: string): string {
  return inv.replace(/[\s\-\/]/g, '').toUpperCase();
}

function matchByInvoiceNumber(
  invoice: Invoice,
  gstr2bEntries: Gstr2bEntry[],
): Gstr2bEntry | undefined {
  const normInv = normalizeInvoiceNumber(invoice.invoiceNumber);
  return gstr2bEntries.find(
    (entry) =>
      normalizeInvoiceNumber(entry.invoiceNumber) === normInv &&
      entry.gstin === invoice.supplierGstin,
  );
}

/** True if a GSTR-2B entry corresponds to the given invoice (same number + GSTIN). */
export function isSameInvoice(entry: Gstr2bEntry, invoice: Invoice): boolean {
  return (
    normalizeInvoiceNumber(entry.invoiceNumber) === normalizeInvoiceNumber(invoice.invoiceNumber) &&
    entry.gstin === invoice.supplierGstin
  );
}

/** Build a clean (correctly-filed) GSTR-2B entry from an invoice — used by the "Sync with portal" simulation. */
export function invoiceToCleanGstr2bEntry(inv: Invoice): Gstr2bEntry {
  return {
    gstin: inv.supplierGstin,
    supplierName: inv.supplierName,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    invoiceValue: inv.invoiceValue,
    taxableValue: inv.taxableValue,
    igst: inv.igst,
    cgst: inv.cgst,
    sgst: inv.sgst,
    placeOfSupply: '09-Uttar Pradesh',
    reverseCharge: 'N',
    items: inv.items.map((it) => ({
      hsnCode: it.hsnCode,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      taxableValue: it.taxableValue,
      taxRate: it.taxRate,
      cgst: it.cgst,
      sgst: it.sgst,
      igst: it.igst,
    })),
  };
}

/**
 * Find the best-matching entry line item for a given invoice line item.
 *
 * Strategy:
 * 1. If the invoice item has a non-empty HSN code that appears exactly once in
 *    the invoice (i.e. is unique), find the entry item with the same HSN code.
 * 2. Otherwise fall back to positional matching (original behaviour) so we never
 *    silently swallow a mismatch just because HSN is empty.
 */
function findMatchingEntryItem(
  invItem: Invoice['items'][number],
  invItems: Invoice['items'],
  entryItems: Gstr2bEntry['items'],
): Gstr2bEntry['items'][number] | undefined {
  const hsn = invItem.hsnCode?.trim();
  if (hsn) {
    const countInInvoice = invItems.filter((i) => i.hsnCode?.trim() === hsn).length;
    if (countInInvoice === 1) {
      const byHsn = entryItems.find((e) => e.hsnCode?.trim() === hsn);
      if (byHsn) return byHsn;
    }
  }
  // Fallback: positional (only if HSN is absent or non-unique within the invoice)
  const idx = invItems.indexOf(invItem);
  return entryItems[idx];
}

function checkHsnMismatch(invoice: Invoice, entry: Gstr2bEntry): boolean {
  if (invoice.items.length === 0 || entry.items.length === 0) return false;
  return invoice.items.some((invItem) => {
    const entryItem = findMatchingEntryItem(invItem, invoice.items, entry.items);
    return entryItem && invItem.hsnCode !== entryItem.hsnCode;
  });
}

function checkRateMismatch(invoice: Invoice, entry: Gstr2bEntry): boolean {
  if (invoice.items.length === 0 || entry.items.length === 0) return false;
  return invoice.items.some((invItem) => {
    const entryItem = findMatchingEntryItem(invItem, invoice.items, entry.items);
    return entryItem && invItem.taxRate !== entryItem.taxRate;
  });
}


function formatRupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

export function runDiagnosis(
  invoices: Invoice[],
  gstr2b: Gstr2bEntry[],
): DiagnosisResult[] {
  const results: DiagnosisResult[] = [];
  const matchedGstr2bIndices = new Set<number>();

  for (const invoice of invoices) {
    const entry = matchByInvoiceNumber(invoice, gstr2b);

    if (!entry) {
      // Missing transaction — supplier never filed
      const blockedItc = invoice.cgst + invoice.sgst + invoice.igst;
      results.push({
        id: `diag-${invoice.id}-missing`,
        severity: 'blocked',
        imsAction: 'NOT_ON_IMS_YET',
        amount: blockedItc,
        reason_hi: `${invoice.supplierName} ने यह invoice (${invoice.invoiceNumber}) अभी तक GST portal पर file नहीं की है।`,
        reason_en: `${invoice.supplierName} has not filed invoice ${invoice.invoiceNumber} on the GST portal yet.`,
        action_hi: `${invoice.supplierName} से कहें कि वो 14 तारीख से पहले यह invoice file करें।`,
        action_en: `Ask ${invoice.supplierName} to file this invoice before the 14th.`,
        supplierName: invoice.supplierName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        type: 'missing_transaction',
        invoiceId: invoice.id,
      });
      continue;
    }

    const gstr2bIdx = gstr2b.indexOf(entry);
    matchedGstr2bIndices.add(gstr2bIdx);

    // Check HSN mismatch (line-item level)
    const hsnMismatch = checkHsnMismatch(invoice, entry);
    if (hsnMismatch) {
      const invoiceHsn = invoice.items[0]?.hsnCode ?? '?';
      const entryHsn = entry.items[0]?.hsnCode ?? '?';
      const blockedItc = invoice.cgst + invoice.sgst + invoice.igst;

      results.push({
        id: `diag-${invoice.id}-hsn`,
        severity: 'blocked',
        imsAction: 'HOLD',
        amount: blockedItc,
        reason_hi: `${invoice.supplierName} ने गलत HSN कोड लगाया है — invoice में ${invoiceHsn} है लेकिन GSTR-2B में ${entryHsn} दिख रहा है।`,
        reason_en: `${invoice.supplierName} filed the wrong HSN code — invoice shows ${invoiceHsn} but GSTR-2B shows ${entryHsn}.`,
        action_hi: `${invoice.supplierName} को बोलें कि HSN कोड ${invoiceHsn} में सही करें और amended return file करें।`,
        action_en: `Ask ${invoice.supplierName} to correct the HSN code to ${invoiceHsn} and file an amended return.`,
        supplierName: invoice.supplierName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        type: 'hsn_mismatch',
        invoiceId: invoice.id,
        gstr2bEntry: entry,
      });
      continue;
    }

    // Check rate mismatch
    const rateMismatch = checkRateMismatch(invoice, entry);
    if (rateMismatch) {
      const invoiceRate = invoice.items[0]?.taxRate ?? 0;
      const entryRate = entry.items[0]?.taxRate ?? 0;
      const invoiceTax = invoice.cgst + invoice.sgst + invoice.igst;
      const entryTax = entry.cgst + entry.sgst + entry.igst;
      const difference = Math.abs(invoiceTax - entryTax);

      results.push({
        id: `diag-${invoice.id}-rate`,
        severity: 'pending',
        imsAction: 'HOLD',
        amount: difference,
        reason_hi: `Tax rate mismatch — invoice पर ${invoiceRate}% है, GSTR-2B में ${entryRate}% है। ${formatRupee(difference)} ITC पर असर पड़ रहा है।`,
        reason_en: `Tax rate mismatch — invoice shows ${invoiceRate}% but GSTR-2B shows ${entryRate}%. ${formatRupee(difference)} ITC is affected.`,
        action_hi: `${invoice.supplierName} से invoice verify करवाएं और सही rate confirm करें।`,
        action_en: `Verify the invoice with ${invoice.supplierName} and confirm the correct tax rate.`,
        supplierName: invoice.supplierName,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        type: 'rate_mismatch',
        invoiceId: invoice.id,
        gstr2bEntry: entry,
      });
      continue;
    }

    // Clean match
    const totalItc = invoice.cgst + invoice.sgst + invoice.igst;
    results.push({
      id: `diag-${invoice.id}-clean`,
      severity: 'resolved',
      imsAction: 'ACCEPT',
      amount: totalItc,
      reason_hi: `${invoice.supplierName} की invoice (${invoice.invoiceNumber}) सही match हो गई है।`,
      reason_en: `${invoice.supplierName}'s invoice ${invoice.invoiceNumber} matched correctly.`,
      action_hi: 'कोई action नहीं चाहिए।',
      action_en: 'No action needed.',
      supplierName: invoice.supplierName,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      type: 'clean_match',
      invoiceId: invoice.id,
      gstr2bEntry: entry,
    });
  }

  // Sort: blocked first, then pending, then resolved. Within each tier, by amount descending.
  const severityOrder: Record<Severity, number> = { blocked: 0, pending: 1, resolved: 2 };
  results.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.amount - a.amount;
  });

  return results;
}

export function computeSummary(results: DiagnosisResult[]) {
  const blockedResults  = results.filter((r) => r.severity === 'blocked');
  const pendingResults  = results.filter((r) => r.severity === 'pending');
  const resolvedResults = results.filter((r) => r.severity === 'resolved');

  // totalBlocked: only severity === 'blocked' (hard ITC loss — missing filing, HSN mismatch).
  // totalPending: severity === 'pending' (rate mismatch — recoverable with verification).
  // Keeping these distinct prevents overstating the trader's hard-blocked position.
  const totalBlocked  = blockedResults.reduce((sum, r) => sum + r.amount, 0);
  const totalPending  = pendingResults.reduce((sum, r) => sum + r.amount, 0);
  const issueCount    = blockedResults.length + pendingResults.length;
  const resolvedCount = resolvedResults.length;
  const totalResolved = resolvedResults.reduce((sum, r) => sum + r.amount, 0);

  return { totalBlocked, totalPending, issueCount, resolvedCount, totalResolved };
}

export function generateWhatsAppMessage(result: DiagnosisResult, lang: 'hi' | 'en'): string {
  if (lang === 'hi') {
    switch (result.type) {
      case 'missing_transaction':
        return `नमस्ते, मैंने देखा कि आपकी invoice ${result.invoiceNumber} GSTR-2B में नहीं आई है। क्या आप इसे इस महीने की 14 तारीख से पहले file कर सकते हैं? मेरी ${formatRupee(result.amount)} की ITC अटकी हुई है। धन्यवाद।`;
      case 'hsn_mismatch':
        return `नमस्ते, आपकी invoice ${result.invoiceNumber} में HSN कोड गलत file हुआ है। सही HSN कोड लगाकर amended return file कर दीजिए। मेरी ${formatRupee(result.amount)} की ITC इसकी वजह से अटकी है। धन्यवाद।`;
      case 'rate_mismatch':
        return `नमस्ते, invoice ${result.invoiceNumber} में tax rate में फ़र्क दिख रहा है। कृपया अपनी तरफ़ से verify करें। ${formatRupee(result.amount)} ITC पर असर है। धन्यवाद।`;
      default:
        return '';
    }
  }

  switch (result.type) {
    case 'missing_transaction':
      return `Hi, I noticed that invoice ${result.invoiceNumber} has not appeared in my GSTR-2B. Could you please file it before the 14th of this month? ${formatRupee(result.amount)} of my ITC is blocked because of this. Thank you.`;
    case 'hsn_mismatch':
      return `Hi, invoice ${result.invoiceNumber} was filed with an incorrect HSN code. Please file an amended return with the correct HSN code. ${formatRupee(result.amount)} of my ITC is blocked due to this. Thank you.`;
    case 'rate_mismatch':
      return `Hi, there's a tax rate difference on invoice ${result.invoiceNumber}. Could you please verify on your end? ${formatRupee(result.amount)} ITC is affected. Thank you.`;
    default:
      return '';
  }
}
