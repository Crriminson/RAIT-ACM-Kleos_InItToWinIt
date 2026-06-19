/**
 * Parity-critical unit tests for the TypeScript reconciliation engine.
 *
 * The matching/recommendation logic exists in two places — this TS engine
 * (src/data/matching-engine.ts) and the Python backend (backend/core/matcher.py).
 * They MUST agree on the same planted dataset. The expected outcomes below are
 * deliberately mirrored from backend/tests/test_matcher.py so drift between the
 * two implementations is caught here.
 *
 * Planted scenarios (mock-invoices.ts vs mock-gstr2b.ts):
 *   - Ramesh Traders     HSN 1006 (inv) vs 1905 (2B)  → HSN_MISMATCH,    ₹2,400 blocked
 *   - Sharma Supplies    absent from 2B               → MISSING_TXN,     ₹2,700 blocked
 *   - Gupta Electronics  18% (inv) vs 12% (2B)        → RATE_MISMATCH,   ₹720 delta
 *   - Delhi Spice Co.    PoS 09 (inv) vs 07 (2B)      → POS_MISMATCH,    ₹3,600 blocked
 *   - Patel / Kumar / Singh                          → CLEAN_MATCH,     ₹0 at risk
 *   - Royal Restaurant   clean match, s17(5) flagged  → CLEAN_MATCH (+ blocked-credit flag)
 */
import { describe, it, expect } from '@jest/globals';
import {
  runDiagnosis,
  computeSummary,
  isSameInvoice,
  invoiceToCleanGstr2bEntry,
  generateWhatsAppMessage,
} from '../data/matching-engine';
import { mockInvoices } from '../data/mock-invoices';
import { mockGstr2b } from '../data/mock-gstr2b';
import { Invoice, Gstr2bEntry, DiagnosisResult } from '../data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inv = (id: string) => mockInvoices.find((i) => i.id === id)!;

function diagnoseAll(): DiagnosisResult[] {
  return runDiagnosis(mockInvoices, mockGstr2b);
}

function resultFor(results: DiagnosisResult[], invoiceId: string): DiagnosisResult {
  const r = results.find((x) => x.invoiceId === invoiceId);
  if (!r) throw new Error(`No diagnosis result for ${invoiceId}`);
  return r;
}

// ---------------------------------------------------------------------------
// Planted-scenario diagnoses (the core parity contract)
// ---------------------------------------------------------------------------

describe('runDiagnosis — planted scenarios', () => {
  const results = diagnoseAll();

  it('produces exactly one diagnosis per invoice', () => {
    expect(results).toHaveLength(mockInvoices.length);
    const ids = new Set(results.map((r) => r.invoiceId));
    expect(ids.size).toBe(mockInvoices.length);
  });

  it('Ramesh Traders → HSN mismatch, ₹2,400 blocked, HOLD', () => {
    const r = resultFor(results, 'inv-001');
    expect(r.type).toBe('hsn_mismatch');
    expect(r.severity).toBe('blocked');
    expect(r.imsAction).toBe('HOLD');
    expect(r.amount).toBe(2400); // trader's own tax paid (1200 + 1200)
    expect(r.reason_en).toContain('HSN');
  });

  it('Sharma Supplies → missing transaction, ₹2,700 blocked, not yet on IMS', () => {
    const r = resultFor(results, 'inv-002');
    expect(r.type).toBe('missing_transaction');
    expect(r.severity).toBe('blocked');
    expect(r.imsAction).toBe('NOT_ON_IMS_YET');
    expect(r.amount).toBe(2700); // full tax blocked (1350 + 1350)
    expect(r.gstr2bEntry).toBeUndefined();
  });

  it('Gupta Electronics → rate mismatch, ₹720 delta, pending', () => {
    const r = resultFor(results, 'inv-003');
    expect(r.type).toBe('rate_mismatch');
    expect(r.severity).toBe('pending');
    expect(r.imsAction).toBe('HOLD');
    expect(r.amount).toBe(720); // |2160 invoice tax − 1440 in 2B|
  });

  it('Delhi Spice Co. → place-of-supply mismatch, ₹3,600 blocked', () => {
    const r = resultFor(results, 'inv-007');
    expect(r.type).toBe('pos_mismatch');
    expect(r.severity).toBe('blocked');
    expect(r.imsAction).toBe('HOLD');
    expect(r.amount).toBe(3600); // 1800 + 1800
  });

  it.each([
    ['inv-004', 'Patel Brothers'],
    ['inv-005', 'Kumar General Store'],
    ['inv-006', 'Singh Oil Mills'],
  ])('%s (%s) → clean match, ACCEPT', (id) => {
    const r = resultFor(results, id);
    expect(r.type).toBe('clean_match');
    expect(r.severity).toBe('resolved');
    expect(r.imsAction).toBe('ACCEPT');
  });

  it('Royal Restaurant → clean match but carries the Section 17(5) flag', () => {
    const r = resultFor(results, 'inv-008');
    expect(r.type).toBe('clean_match');
    expect(r.severity).toBe('resolved');
    expect(r.s17_5?.s17_5_flag).toBe('FLAGGED');
    expect(r.s17_5?.category_code).toBe('FOOD_BEVERAGE');
  });

  it('every result carries an is_recoverable boolean and a ₹ amount', () => {
    for (const r of results) {
      expect(typeof r.is_recoverable).toBe('boolean');
      expect(typeof r.amount).toBe('number');
      expect(r.amount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Result ordering — blocked first, then pending, then resolved; ₹ desc within
// ---------------------------------------------------------------------------

describe('runDiagnosis — ordering', () => {
  const results = diagnoseAll();

  it('sorts blocked → pending → resolved', () => {
    const rank = { blocked: 0, pending: 1, resolved: 2 } as const;
    const ranks = results.map((r) => rank[r.severity]);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it('puts the largest blocked ₹ amount first (Delhi Spice ₹3,600)', () => {
    expect(results[0].invoiceId).toBe('inv-007');
    expect(results[0].amount).toBe(3600);
  });

  it('orders amounts descending within the blocked tier', () => {
    const blocked = results.filter((r) => r.severity === 'blocked').map((r) => r.amount);
    expect(blocked).toEqual([...blocked].sort((a, b) => b - a));
  });
});

// ---------------------------------------------------------------------------
// computeSummary — the numbers the trader sees on the home / report screens
// ---------------------------------------------------------------------------

describe('computeSummary', () => {
  const summary = computeSummary(diagnoseAll());

  it('totals only hard-blocked ITC in totalBlocked (₹2,400 + ₹2,700 + ₹3,600)', () => {
    expect(summary.totalBlocked).toBe(8700);
  });

  it('keeps recoverable rate-mismatch ₹ separate in totalPending', () => {
    expect(summary.totalPending).toBe(720);
  });

  it('counts 4 issues and 4 resolved invoices', () => {
    expect(summary.issueCount).toBe(4);
    expect(summary.resolvedCount).toBe(4);
  });

  it('handles an empty result set without NaN', () => {
    const empty = computeSummary([]);
    expect(empty).toEqual({
      totalBlocked: 0,
      totalPending: 0,
      issueCount: 0,
      resolvedCount: 0,
      totalResolved: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Invoice-number normalisation — spaces / hyphens / slashes must not block a match
// ---------------------------------------------------------------------------

describe('invoice number normalisation', () => {
  it('matches despite added spaces and case differences', () => {
    const messy: Invoice = { ...inv('inv-001'), invoiceNumber: 'rt / 2026 - 0547' };
    const results = runDiagnosis([messy], mockGstr2b);
    // Still matches Ramesh's 2B row, so it is an HSN mismatch — NOT a missing txn.
    expect(results[0].type).toBe('hsn_mismatch');
    expect(results[0].gstr2bEntry).toBeDefined();
  });

  it('does not match a different supplier with the same invoice number', () => {
    const collision: Invoice = {
      ...inv('inv-004'),
      supplierGstin: '09ZZZZZ0000Z1Z9', // different GSTIN, same invoice number
    };
    const results = runDiagnosis([collision], mockGstr2b);
    expect(results[0].type).toBe('missing_transaction');
  });
});

// ---------------------------------------------------------------------------
// HSN line-item matching — by unique HSN, falling back to positional
// ---------------------------------------------------------------------------

describe('HSN line-item matching', () => {
  it('matches line items by unique HSN regardless of order (no false mismatch)', () => {
    const base = inv('inv-004');
    const twoLineInvoice: Invoice = {
      ...base,
      items: [
        { ...base.items[0], hsnCode: '0402' },
        { ...base.items[0], hsnCode: '1701', description: 'Sugar' },
      ],
    };
    const entry: Gstr2bEntry = {
      ...mockGstr2b.find((e) => e.invoiceNumber === base.invoiceNumber)!,
      items: [
        // reversed order vs the invoice
        { ...mockGstr2b[2].items[0], hsnCode: '1701' },
        { ...mockGstr2b[2].items[0], hsnCode: '0402' },
      ],
    };
    const results = runDiagnosis([twoLineInvoice], [entry]);
    expect(results[0].type).toBe('clean_match');
  });

  it('flags an HSN mismatch when codes genuinely differ', () => {
    const results = runDiagnosis([inv('inv-001')], mockGstr2b);
    expect(results[0].type).toBe('hsn_mismatch');
  });
});

// ---------------------------------------------------------------------------
// Place-of-supply detection edge cases
// ---------------------------------------------------------------------------

describe('place-of-supply mismatch', () => {
  const ramesh2b = mockGstr2b.find((e) => e.supplierName === 'Ramesh Traders')!;

  it('does not flag PoS when the invoice has no PoS field', () => {
    // inv-001 has no placeOfSupply → PoS check is skipped, falls through to HSN.
    const results = runDiagnosis([inv('inv-001')], mockGstr2b);
    expect(results[0].type).not.toBe('pos_mismatch');
  });

  it('compares the leading 2-digit state code, ignoring the state name', () => {
    const invoiceUP: Invoice = { ...inv('inv-001'), placeOfSupply: '09-UTTAR PRADESH' };
    const entryUP: Gstr2bEntry = { ...ramesh2b, placeOfSupply: '09-Uttar Pradesh', items: inv('inv-001').items as any };
    // Same state code 09 → no PoS mismatch (falls through to clean since items align).
    const results = runDiagnosis([invoiceUP], [entryUP]);
    expect(results[0].type).not.toBe('pos_mismatch');
  });
});

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

describe('isSameInvoice', () => {
  it('is true for the same supplier + normalised invoice number', () => {
    const entry = mockGstr2b.find((e) => e.supplierName === 'Ramesh Traders')!;
    expect(isSameInvoice(entry, inv('inv-001'))).toBe(true);
  });

  it('is false when the GSTIN differs', () => {
    const entry = mockGstr2b.find((e) => e.supplierName === 'Patel Brothers')!;
    expect(isSameInvoice(entry, inv('inv-001'))).toBe(false);
  });
});

describe('invoiceToCleanGstr2bEntry', () => {
  it('round-trips an invoice into a clean (matching) 2B entry', () => {
    const entry = invoiceToCleanGstr2bEntry(inv('inv-001'));
    const results = runDiagnosis([inv('inv-001')], [entry]);
    expect(results[0].type).toBe('clean_match');
    expect(results[0].severity).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// Supplier-fix WhatsApp message generation
// ---------------------------------------------------------------------------

describe('generateWhatsAppMessage', () => {
  const results = diagnoseAll();

  it('drafts an English message that names the invoice for each issue type', () => {
    for (const id of ['inv-001', 'inv-002', 'inv-003', 'inv-007']) {
      const r = resultFor(results, id);
      const msg = generateWhatsAppMessage(r, 'en');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).toContain(r.invoiceNumber);
    }
  });

  it('drafts a non-empty Hindi message for a missing transaction', () => {
    const r = resultFor(results, 'inv-002');
    const msg = generateWhatsAppMessage(r, 'hi');
    expect(msg).toContain(r.invoiceNumber);
    expect(msg).toContain('धन्यवाद');
  });

  it('prefers a pre-built supplier draft when present', () => {
    const r = resultFor(results, 'inv-001');
    const withDraft = { ...r, supplierMessageDraftEn: 'CUSTOM DRAFT' };
    expect(generateWhatsAppMessage(withDraft, 'en')).toBe('CUSTOM DRAFT');
  });

  it('returns an empty string for a clean match (no supplier action needed)', () => {
    const r = resultFor(results, 'inv-004');
    expect(generateWhatsAppMessage(r, 'en')).toBe('');
  });
});
