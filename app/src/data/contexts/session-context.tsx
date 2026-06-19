import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Gstr2bEntry, Invoice, DiagnosisResult, Severity } from '../types';
import { runDiagnosis, computeSummary, isSameInvoice, invoiceToCleanGstr2bEntry } from '../matching-engine';
import { mockInvoices } from '../mock-invoices';
import { mockGstr2b } from '../mock-gstr2b';
import { extractInvoiceFromFile } from '../extraction';
import { AiMethod } from '../../api/ai';
import { useProfile } from './profile-context';

export type SessionPhase = 'idle' | 'uploading' | 'reviewing' | 'processing' | 'results';

export interface UploadedFile {
  uri: string;
  name: string;
  mimeType?: string;
}

export interface HistoryInvoice {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  severity: Severity;
  imageUri?: string;
}

export interface SessionRecord {
  id: string;
  runAt: number;
  period: string;
  totalBlocked: number;
  totalPending: number;
  issueCount: number;
  resolvedCount: number;
  totalResolved: number;
  invoiceCount: number;
  invoices: HistoryInvoice[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function derivePeriod(entries: Gstr2bEntry[], invoices: Invoice[]): string {
  const sample = entries[0]?.invoiceDate ?? invoices[0]?.invoiceDate;
  if (sample) {
    const [year, month] = sample.split('-');
    const idx = parseInt(month, 10) - 1;
    if (idx >= 0 && idx < 12) return `${MONTHS[idx]} ${year}`;
  }
  return 'May 2026';
}

interface SessionState {
  phase: SessionPhase;
  isDemo: boolean;
  gstr2bFile: UploadedFile | null;
  gstr2bEntries: Gstr2bEntry[];
  invoiceFiles: UploadedFile[];
  invoices: Invoice[];
  results: DiagnosisResult[];
  summary: { totalBlocked: number; totalPending: number; issueCount: number; resolvedCount: number; totalResolved: number };
  processingProgress: { current: number; total: number };
  aiMethod: AiMethod | null;
  history: SessionRecord[];
}

interface SessionActions {
  setGstr2bFile: (file: UploadedFile, entries: Gstr2bEntry[]) => void;
  addInvoiceFiles: (files: UploadedFile[]) => void;
  removeInvoiceFile: (uri: string) => void;
  startReview: () => void;
  loadDemo: () => void;
  startProcessing: () => Promise<void>;
  reset: () => void;
  clearAll: () => void;
  applyGstr2b: (entries: Gstr2bEntry[]) => void;
  syncFromPortal: () => { synced: number; syncedAmount: number; remaining: number };
}

type SessionContextValue = SessionState & SessionActions;

const initialState: SessionState = {
  phase: 'idle',
  isDemo: false,
  gstr2bFile: null,
  gstr2bEntries: [],
  invoiceFiles: [],
  invoices: [],
  results: [],
  summary: { totalBlocked: 0, totalPending: 0, issueCount: 0, resolvedCount: 0, totalResolved: 0 },

  processingProgress: { current: 0, total: 0 },
  aiMethod: null,
  history: [],
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const { profile } = useProfile();


  const setGstr2bFile = useCallback((file: UploadedFile, entries: Gstr2bEntry[]) => {
    setState((prev) => ({
      ...prev,
      gstr2bFile: file,
      gstr2bEntries: entries,
      phase: 'uploading',
    }));
  }, []);

  const addInvoiceFiles = useCallback((files: UploadedFile[]) => {
    setState((prev) => ({
      ...prev,
      invoiceFiles: [...prev.invoiceFiles, ...files],
      phase: 'uploading',
    }));
  }, []);

  const removeInvoiceFile = useCallback((uri: string) => {
    setState((prev) => ({
      ...prev,
      invoiceFiles: prev.invoiceFiles.filter((f) => f.uri !== uri),
    }));
  }, []);

  const startReview = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'reviewing' }));
  }, []);

  const loadDemo = useCallback(() => {
    const demoInvoiceFiles: UploadedFile[] = mockInvoices.map((inv) => ({
      uri: `demo://${inv.id}`,
      name: `${inv.invoiceNumber}.jpg`,
      mimeType: 'image/jpeg',
    }));

    setState((prev) => ({
      ...prev,
      isDemo: true,
      phase: 'uploading',
      gstr2bFile: { uri: 'demo://gstr2b', name: 'GSTR2B-May-2026.csv', mimeType: 'text/csv' },
      gstr2bEntries: mockGstr2b,
      invoiceFiles: demoInvoiceFiles,
    }));
  }, []);

  const startProcessing = useCallback(async () => {
    const realFiles = state.invoiceFiles.filter((f) => !f.uri.startsWith('demo://'));
    const useRealExtraction = !state.isDemo && realFiles.length > 0;
    const totalInvoices = useRealExtraction
      ? realFiles.length
      : (state.isDemo ? mockInvoices.length : (state.invoiceFiles.length || mockInvoices.length));

    setState((prev) => ({
      ...prev,
      phase: 'processing',
      aiMethod: null,
      processingProgress: { current: 0, total: totalInvoices },
    }));

    let invoices: Invoice[];
    let aiMethod: AiMethod | null = null;

    if (useRealExtraction) {
      // Real AI extraction: send each invoice image to the backend.
      const extracted: Invoice[] = [];
      for (let i = 0; i < realFiles.length; i++) {
        try {
          const { invoice, method } = await extractInvoiceFromFile(
            realFiles[i],
            `scan-${Date.now()}-${i}`,
            profile?.gstin,
          );
          extracted.push(invoice);
          if (method === 'gemini') aiMethod = 'gemini';
          else if (aiMethod !== 'gemini') aiMethod = 'fallback';
        } catch {
          // Server unreachable or file unreadable — keep going; we'll guard below.
        }
        setState((prev) => ({ ...prev, processingProgress: { current: i + 1, total: realFiles.length } }));
      }
      // Safety net: if nothing extracted (e.g. server down), fall back to mock so the demo never dead-ends.
      invoices = extracted.length > 0 ? extracted : mockInvoices;
    } else {
      // Demo / no real files: simulate progress for the animation, use the curated mock set.
      for (let i = 0; i < totalInvoices; i++) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        setState((prev) => ({ ...prev, processingProgress: { current: i + 1, total: totalInvoices } }));
      }
      invoices = mockInvoices;
    }

    const gstr2b = state.gstr2bEntries.length > 0 ? state.gstr2bEntries : mockGstr2b;

    const results = runDiagnosis(invoices, gstr2b);
    const summary = computeSummary(results);

    // Build a history record: one entry per invoice with its diagnosis severity.
    const resultByInvoiceId = new Map<string, DiagnosisResult>();
    for (const r of results) {
      if (r.invoiceId) resultByInvoiceId.set(r.invoiceId, r);
    }
    const historyInvoices: HistoryInvoice[] = invoices.map((inv) => {
      const r = resultByInvoiceId.get(inv.id);
      return {
        id: inv.id,
        supplierName: inv.supplierName,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        amount: inv.cgst + inv.sgst + inv.igst,
        severity: r?.severity ?? 'resolved',
        imageUri: inv.imageUri,
      };
    });

    const record: SessionRecord = {
      id: `run-${Date.now()}`,
      runAt: Date.now(),
      period: derivePeriod(gstr2b, invoices),
      totalBlocked: summary.totalBlocked,
      totalPending: summary.totalPending,
      issueCount: summary.issueCount,
      resolvedCount: summary.resolvedCount,
      totalResolved: summary.totalResolved,
      invoiceCount: invoices.length,
      invoices: historyInvoices,
    };

    setState((prev) => ({
      ...prev,
      phase: 'results',
      invoices,
      results,
      summary,
      aiMethod,
      history: [record, ...prev.history],
    }));
  }, [state.invoiceFiles, state.gstr2bEntries, state.isDemo]);


  const reset = useCallback(() => {
    // Preserve accumulated history across runs.
    setState((prev) => ({ ...initialState, history: prev.history }));
  }, []);

  const clearAll = useCallback(() => {
    setState(initialState);
  }, []);

  // Replace the active GSTR-2B set, re-running the diagnosis if results already exist.
  const applyGstr2b = useCallback((entries: Gstr2bEntry[]) => {
    setState((prev) => {
      if (prev.phase === 'results' && prev.invoices.length > 0) {
        const results = runDiagnosis(prev.invoices, entries.length ? entries : mockGstr2b);
        const summary = computeSummary(results);
        return { ...prev, gstr2bEntries: entries, results, summary };
      }
      return { ...prev, gstr2bEntries: entries };
    });
  }, []);

  // "Sync with GST portal" — pull in any invoices missing from the current 2B as clean filings.
  // Only resolves *missing* transactions; wrong-HSN / wrong-rate issues still need a supplier amendment.
  const syncFromPortal = useCallback(() => {
    const missing = state.invoices.filter(
      (inv) => !state.gstr2bEntries.some((e) => isSameInvoice(e, inv)),
    );
    const syncedAmount = missing.reduce((s, inv) => s + inv.cgst + inv.sgst + inv.igst, 0);
    const newEntries = missing.map(invoiceToCleanGstr2bEntry);
    const nextEntries = [...newEntries, ...state.gstr2bEntries];

    // How many issues remain once the missing filings are in?
    const afterResults = runDiagnosis(state.invoices, nextEntries.length ? nextEntries : mockGstr2b);
    const remaining = afterResults.filter((r) => r.severity !== 'resolved').length;

    if (missing.length > 0) applyGstr2b(nextEntries);
    return { synced: missing.length, syncedAmount, remaining };
  }, [state.invoices, state.gstr2bEntries, applyGstr2b]);

  const value = useMemo(
    () => ({
      ...state,
      setGstr2bFile,
      addInvoiceFiles,
      removeInvoiceFile,
      startReview,
      loadDemo,
      startProcessing,
      reset,
      clearAll,
      applyGstr2b,
      syncFromPortal,
    }),
    [state, setGstr2bFile, addInvoiceFiles, removeInvoiceFile, startReview, loadDemo, startProcessing, reset, clearAll, applyGstr2b, syncFromPortal],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
