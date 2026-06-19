import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GitCompare, Check, X, AlertTriangle, WifiOff } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { Invoice } from '../data/types';
import { compareInvoices, CompareData, InvoiceForCompare, AiMethod } from '../api/ai';
import GradientHeader from '../components/GradientHeader';

function toCompareShape(inv: Invoice): InvoiceForCompare {
  return {
    supplierName: inv.supplierName,
    supplierGSTIN: inv.supplierGstin,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    taxableValue: inv.taxableValue,
    totalTax: inv.cgst + inv.sgst + inv.igst,
    items: inv.items,
  };
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color = s.includes('mismatch') ? colors.severity.blocked : s.includes('warn') ? colors.severity.pending : colors.severity.resolved;
  const bg = s.includes('mismatch') ? colors.severity.blockedBg : s.includes('warn') ? colors.severity.pendingBg : colors.severity.resolvedBg;
  const Icon = s.includes('mismatch') ? X : s.includes('warn') ? AlertTriangle : Check;
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Icon size={11} color={color} />
      <Text style={[styles.statusText, { color }]}>{status}</Text>
    </View>
  );
}

export default function CompareScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation();

  const invoices = session.invoices;
  const [aIdx, setAIdx] = useState<number | null>(null);
  const [bIdx, setBIdx] = useState<number | null>(null);
  const [picking, setPicking] = useState<'a' | 'b' | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareData | null>(null);
  const [method, setMethod] = useState<AiMethod | null>(null);

  const canCompare = aIdx !== null && bIdx !== null && aIdx !== bIdx;

  const runCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await compareInvoices(toCompareShape(invoices[aIdx!]), toCompareShape(invoices[bIdx!]), lang);
      setResult(r.data);
      setMethod(r.method);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (invoices.length < 2) {
    return (
      <View style={styles.root}>
        <GradientHeader title={t.compare.title} onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <GitCompare size={44} color={colors.inkMuted} />
          <Text style={styles.emptyText}>{t.compare.needTwo}</Text>
        </View>
      </View>
    );
  }

  const Slot = ({ which, idx }: { which: 'a' | 'b'; idx: number | null }) => (
    <TouchableOpacity
      style={[styles.slot, picking === which && styles.slotActive]}
      activeOpacity={0.8}
      onPress={() => setPicking(picking === which ? null : which)}
    >
      <Text style={styles.slotLabel}>{which === 'a' ? 'A' : 'B'}</Text>
      {idx !== null ? (
        <View style={{ flex: 1 }}>
          <Text style={styles.slotSupplier} numberOfLines={1}>{invoices[idx].supplierName}</Text>
          <Text style={styles.slotMeta}>{invoices[idx].invoiceNumber}</Text>
        </View>
      ) : (
        <Text style={styles.slotPlaceholder}>{which === 'a' ? t.compare.pickA : t.compare.pickB}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <GradientHeader title={t.compare.title} subtitle={t.compare.subtitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Slot which="a" idx={aIdx} />
        <View style={styles.vsRow}>
          <GitCompare size={18} color={colors.primary} />
        </View>
        <Slot which="b" idx={bIdx} />

        {/* Picker list */}
        {picking && (
          <View style={styles.pickerCard}>
            {invoices.map((inv, i) => (
              <TouchableOpacity
                key={inv.id}
                style={styles.pickRow}
                onPress={() => {
                  if (picking === 'a') setAIdx(i);
                  else setBIdx(i);
                  setPicking(null);
                }}
              >
                <Text style={styles.pickSupplier}>{inv.supplierName}</Text>
                <Text style={styles.pickMeta}>{inv.invoiceNumber}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.compareBtn, !canCompare && styles.compareBtnDisabled]}
          onPress={runCompare}
          disabled={!canCompare || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <GitCompare size={18} color={colors.surface} />
          )}
          <Text style={styles.compareBtnText}>{loading ? t.compare.loading : t.compare.compareBtn}</Text>
        </TouchableOpacity>

        {result && (
          <View style={styles.resultBlock}>
            {method === 'fallback' && (
              <View style={styles.offlineBanner}>
                <WifiOff size={14} color={colors.severity.pending} />
                <Text style={styles.offlineText}>{t.compare.offlineNote}</Text>
              </View>
            )}
            <View style={[styles.summaryCard, { borderLeftColor: result.hasDiscrepancies ? colors.severity.blocked : colors.severity.resolved }]}>
              <Text style={[styles.summaryTag, { color: result.hasDiscrepancies ? colors.severity.blocked : colors.severity.resolved }]}>
                {result.hasDiscrepancies ? t.compare.discrepancies : t.compare.clean}
              </Text>
              <Text style={styles.summaryText}>{result.summary}</Text>
            </View>

            {result.comparisonList.map((row, i) => (
              <View key={i} style={styles.compareRow}>
                <Text style={styles.aspectLabel}>{row.aspect}</Text>
                <View style={styles.compareValues}>
                  <Text style={styles.compareVal}>{row.invoiceAVal}</Text>
                  <Text style={styles.compareVal} >{row.invoiceBVal}</Text>
                </View>
                <StatusPill status={row.status} />
              </View>
            ))}

            <Text style={styles.obsTitle}>{t.compare.observations}</Text>
            <View style={styles.obsCard}>
              <Text style={styles.obsText}>{result.auditObservations}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
  content: { padding: spacing.screenH, paddingBottom: spacing.xl },

  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...elevation.soft,
  },
  slotActive: { borderColor: colors.primary },
  slotLabel: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, color: colors.surface,
    textAlign: 'center', lineHeight: 32, fontWeight: '800', overflow: 'hidden',
  },
  slotSupplier: { ...typography.bodyBold, color: colors.ink },
  slotMeta: { ...typography.caption, color: colors.inkMuted },
  slotPlaceholder: { ...typography.body, color: colors.inkMuted, flex: 1 },
  vsRow: { alignItems: 'center', paddingVertical: spacing.sm },

  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
    ...elevation.soft,
  },
  pickRow: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickSupplier: { ...typography.bodyBold, color: colors.ink },
  pickMeta: { ...typography.caption, color: colors.inkMuted },

  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    height: 52,
    marginTop: spacing.lg,
    ...elevation.primary,
  },
  compareBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  compareBtnText: { ...typography.label, color: colors.surface, fontSize: 15, fontWeight: '700' },

  resultBlock: { marginTop: spacing.lg },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.severity.pendingBg, borderRadius: radii.button,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md,
  },
  offlineText: { ...typography.caption, color: colors.severity.pending, fontWeight: '600' },
  summaryCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, marginBottom: spacing.md, ...elevation.soft,
  },
  summaryTag: { ...typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  summaryText: { ...typography.body, color: colors.ink },
  compareRow: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.xs,
  },
  aspectLabel: { ...typography.caption, color: colors.inkMuted, fontWeight: '600' },
  compareValues: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  compareVal: { ...typography.body, color: colors.ink, flex: 1, fontSize: 14 },
  obsTitle: { ...typography.heading2, color: colors.ink, marginTop: spacing.sm, marginBottom: spacing.sm },
  obsCard: {
    backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...elevation.soft,
  },
  obsText: { ...typography.body, color: colors.inkSecondary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.badge },
  statusText: { ...typography.caption, fontWeight: '700', fontSize: 11 },
});
