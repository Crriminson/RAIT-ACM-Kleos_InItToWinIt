import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Calculator, Split } from 'lucide-react-native';
import { Text } from './AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { Invoice } from '../data/types';

function formatRupee(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export default function TaxBreakdownCard({
  invoice,
  buyerStateCode,
}: {
  invoice: Invoice;
  buyerStateCode: string;
}) {
  const { t } = useI18n();

  const supplierState = (invoice.supplierGstin || '').slice(0, 2) || '00';
  const intrastate = supplierState === buyerStateCode;
  const totalTax = invoice.cgst + invoice.sgst + invoice.igst;
  const firstRate = invoice.items[0]?.taxRate ?? 0;

  const ruleText = (intrastate ? t.detail.intrastate : t.detail.interstate)
    .replace('{{s}}', supplierState)
    .replace('{{b}}', buyerStateCode);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconChip}>
          <Calculator size={18} color={colors.primary} />
        </View>
        <Text style={styles.title}>{t.detail.taxBreakdown}</Text>
      </View>

      {/* Line items */}
      {invoice.items.map((it, i) => {
        const itemTax = it.cgst + it.sgst + it.igst;
        return (
          <View key={i} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{it.description}</Text>
              <Text style={styles.itemMeta}>HSN {it.hsnCode || '—'} · {it.taxRate}%</Text>
            </View>
            <View style={styles.itemAmounts}>
              <Text style={styles.itemTaxable}>{formatRupee(it.taxableValue)}</Text>
              <Text style={styles.itemTax}>+{formatRupee(itemTax)} tax</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.divider} />

      {/* CGST/SGST/IGST split */}
      <View style={styles.splitRow}>
        {intrastate ? (
          <>
            <View style={styles.splitChip}>
              <Text style={styles.splitLabel}>CGST {firstRate / 2}%</Text>
              <Text style={styles.splitValue}>{formatRupee(invoice.cgst)}</Text>
            </View>
            <View style={styles.splitChip}>
              <Text style={styles.splitLabel}>SGST {firstRate / 2}%</Text>
              <Text style={styles.splitValue}>{formatRupee(invoice.sgst)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.splitChip}>
            <Text style={styles.splitLabel}>IGST {firstRate}%</Text>
            <Text style={styles.splitValue}>{formatRupee(totalTax)}</Text>
          </View>
        )}
      </View>

      {/* Rule explanation */}
      <View style={styles.ruleBox}>
        <Split size={16} color={colors.inkMuted} style={{ marginTop: 2 }} />
        <Text style={styles.ruleText}>{ruleText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...elevation.soft,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  iconChip: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.recognitionBg, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.heading2, color: colors.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  itemName: { ...typography.body, color: colors.ink, fontSize: 14 },
  itemMeta: { ...typography.caption, color: colors.inkMuted },
  itemAmounts: { alignItems: 'flex-end' },
  itemTaxable: { ...typography.bodyBold, color: colors.ink, fontSize: 14 },
  itemTax: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  splitRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  splitChip: {
    flex: 1,
    backgroundColor: colors.recognitionBg,
    borderRadius: radii.input,
    padding: spacing.sm,
    alignItems: 'center',
  },
  splitLabel: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  splitValue: { ...typography.bodyBold, color: colors.ink, marginTop: 2 },
  ruleBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.input,
    padding: spacing.sm,
  },
  ruleText: { ...typography.body, color: colors.inkSecondary, flex: 1, fontSize: 13 },
});
