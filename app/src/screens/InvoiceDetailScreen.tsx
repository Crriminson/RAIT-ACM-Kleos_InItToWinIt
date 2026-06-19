import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Text } from '../components/AppText';
import * as Clipboard from 'expo-clipboard';
import { FileText, AlertTriangle, ArrowRight, MessageCircle, Clock } from 'lucide-react-native';

import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { generateWhatsAppMessage } from '../data/matching-engine';
import { ImsAction, Severity } from '../data/types';
import { RootStackParamList } from '../navigation/types';
import GradientHeader from '../components/GradientHeader';
import TaxBreakdownCard from '../components/TaxBreakdownCard';
import { sendWhatsApp } from '../utils/share';
import { useProfile } from '../data/contexts/profile-context';

function formatRupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function severityColor(s: Severity) {
  return s === 'blocked' ? colors.severity.blocked
    : s === 'pending' ? colors.severity.pending
    : colors.severity.resolved;
}

function severityBg(s: Severity) {
  return s === 'blocked' ? colors.severity.blockedBg
    : s === 'pending' ? colors.severity.pendingBg
    : colors.severity.resolvedBg;
}

// IMS Action badge (FEATURE-013) — same palette as DiagnosisScreen
const IMS_COLORS: Record<ImsAction, { bg: string; text: string }> = {
  ACCEPT:         { bg: '#E8F5E9', text: '#2E7D32' },
  HOLD:           { bg: '#FFF3E0', text: '#E65100' },
  NOT_ON_IMS_YET: { bg: '#ECEFF1', text: '#546E7A' },
};

function ActionBadge({ action }: { action: ImsAction }) {
  const { t } = useI18n();
  const { bg, text } = IMS_COLORS[action];
  const label =
    action === 'ACCEPT'           ? t.diagnosis.imsAccept
    : action === 'HOLD'           ? t.diagnosis.imsHold
    : t.diagnosis.imsNotYet;
  return (
    <View style={[detailStyles.imsBadge, { backgroundColor: bg }]}>
      {action === 'NOT_ON_IMS_YET' && <Clock size={14} color={text} />}
      <Text style={[detailStyles.imsBadgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

interface FieldRow {
  label: string;
  invoiceValue: string;
  gstr2bValue: string | null;
  mismatch: boolean;
}

export default function InvoiceDetailScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const route = useRoute<RouteProp<RootStackParamList, 'InvoiceDetail'>>();
  const navigation = useNavigation();
  const { profile } = useProfile();
  const buyerStateCode = (profile?.gstin ?? '09').slice(0, 2);
  const [copied, setCopied] = useState(false);

  const result = session.results.find((r) => r.id === route.params.resultId);
  const invoice = result?.invoiceId
    ? session.invoices.find((inv) => inv.id === result.invoiceId)
    : undefined;

  if (!result || !invoice) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingText}>Invoice details unavailable.</Text>
      </View>
    );
  }

  const headerVariant = result.severity === 'resolved' ? 'resolved' : result.severity;

  const entry = result.gstr2bEntry;
  const reason = lang === 'hi' ? result.reason_hi : result.reason_en;
  const action = lang === 'hi' ? result.action_hi : result.action_en;
  const accent = severityColor(result.severity);

  const invItem = invoice.items[0];
  const entryItem = entry?.items[0];
  const invTax = invoice.cgst + invoice.sgst + invoice.igst;
  const entryTax = entry ? entry.cgst + entry.sgst + entry.igst : 0;

  const fields: FieldRow[] = [
    {
      label: t.detail.fieldInvoiceNo,
      invoiceValue: invoice.invoiceNumber,
      gstr2bValue: entry?.invoiceNumber ?? null,
      mismatch: false,
    },
    {
      label: t.detail.fieldGstin,
      invoiceValue: invoice.supplierGstin,
      gstr2bValue: entry?.gstin ?? null,
      mismatch: entry ? invoice.supplierGstin !== entry.gstin : false,
    },
    {
      label: t.detail.fieldHsn,
      invoiceValue: invItem?.hsnCode ?? '—',
      gstr2bValue: entryItem?.hsnCode ?? null,
      mismatch: result.type === 'hsn_mismatch',
    },
    {
      label: t.detail.fieldTaxRate,
      invoiceValue: invItem ? `${invItem.taxRate}%` : '—',
      gstr2bValue: entryItem ? `${entryItem.taxRate}%` : null,
      mismatch: result.type === 'rate_mismatch',
    },
    {
      label: t.detail.fieldTaxable,
      invoiceValue: formatRupee(invoice.taxableValue),
      gstr2bValue: entry ? formatRupee(entry.taxableValue) : null,
      mismatch: entry ? invoice.taxableValue !== entry.taxableValue : false,
    },
    {
      label: t.detail.fieldTaxAmount,
      invoiceValue: formatRupee(invTax),
      gstr2bValue: entry ? formatRupee(entryTax) : null,
      mismatch: entry ? invTax !== entryTax : false,
    },
  ];

  const handleCopy = async () => {
    const how = await sendWhatsApp(generateWhatsAppMessage(result, lang));
    if (how === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.root}>
      <GradientHeader
        title={invoice.supplierName}
        subtitle={invoice.invoiceNumber}
        variant={headerVariant}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero amount */}
        <View style={[styles.heroCard, { backgroundColor: severityBg(result.severity), borderLeftColor: accent }]}>
          <Text style={[styles.amount, { color: accent }]}>{formatRupee(result.amount)}</Text>
          <Text style={styles.reason}>{reason}</Text>
        </View>

      {/* IMS Action badge (FEATURE-013) */}
      <ActionBadge action={result.imsAction} />

      {/* Advisory disclaimer (FEATURE-012) */}
      <View style={detailStyles.disclaimerBanner}>
        <AlertTriangle size={13} color={colors.inkMuted} />
        <Text style={detailStyles.disclaimerText}>{t.diagnosis.disclaimer}</Text>
      </View>

      {/* What to do */}
      {result.severity !== 'resolved' && (
        <View style={styles.actionCard}>
          <Text style={styles.sectionLabel}>{t.detail.whatToDo}</Text>
          <Text style={styles.actionText}>{action}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopy} activeOpacity={0.85}>
            <MessageCircle size={18} color={colors.surface} />
            <Text style={styles.copyButtonText}>
              {copied ? t.detail.copied : t.detail.copyMessage}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Comparison */}
      <Text style={styles.comparisonHeading}>{t.detail.comparison}</Text>

      {!entry && (
        <View style={styles.notFoundBanner}>
          <AlertTriangle size={18} color={colors.severity.blocked} />
          <Text style={styles.notFoundText}>{t.detail.notInGstr2b}</Text>
        </View>
      )}

      <View style={styles.compareHeaderRow}>
        <Text style={styles.compareColLabel}>{t.detail.yourInvoice}</Text>
        <View style={{ width: 24 }} />
        <Text style={[styles.compareColLabel, styles.compareColRight]}>{t.detail.inGstr2b}</Text>
      </View>

      <View style={styles.compareCard}>
        {fields.map((f, idx) => (
          <View
            key={f.label}
            style={[
              styles.fieldRow,
              idx < fields.length - 1 && styles.fieldRowBorder,
              f.mismatch && styles.fieldRowMismatch,
            ]}
          >
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <View style={styles.fieldValues}>
              <Text style={[styles.fieldValue, f.mismatch && styles.fieldValueMismatch]}>
                {f.invoiceValue}
              </Text>
              <ArrowRight size={14} color={f.mismatch ? accent : colors.inkMuted} />
              <Text
                style={[
                  styles.fieldValue,
                  styles.fieldValueRight,
                  f.mismatch && styles.fieldValueMismatch,
                ]}
              >
                {f.gstr2bValue ?? '—'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Tax computation */}
      <TaxBreakdownCard invoice={invoice} buyerStateCode={buyerStateCode} />

      {/* Source document */}
      <Text style={styles.comparisonHeading}>{t.detail.sourceDocument}</Text>
      <View style={styles.sourceCard}>
        {invoice.imageUri ? (
          <Image source={{ uri: invoice.imageUri }} style={styles.sourceImage} resizeMode="contain" />
        ) : (
          <View style={styles.sourcePlaceholder}>
            <FileText size={32} color={colors.inkMuted} />
            <Text style={styles.sourcePlaceholderText}>{t.detail.noImage}</Text>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screenH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  missingText: {
    ...typography.body,
    color: colors.inkMuted,
  },
  heroCard: {
    borderRadius: radii.card,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    marginBottom: spacing.md,
    ...elevation.card,
  },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  reason: {
    ...typography.body,
    color: colors.ink,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  actionText: {
    ...typography.body,
    color: colors.inkSecondary,
    marginBottom: spacing.md,
  },
  copyButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.primary,
  },
  copyButtonText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  comparisonHeading: {
    ...typography.heading2,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.blockedBg,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notFoundText: {
    ...typography.body,
    color: colors.severity.blocked,
    flex: 1,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  compareColLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    fontWeight: '600',
    flex: 1,
  },
  compareColRight: {
    textAlign: 'right',
  },
  compareCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...elevation.card,
  },
  fieldRow: {
    padding: spacing.md,
  },
  fieldRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fieldRowMismatch: {
    backgroundColor: colors.severity.blockedBg,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  fieldValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldValue: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
  fieldValueRight: {
    textAlign: 'right',
  },
  fieldValueMismatch: {
    fontWeight: '700',
    color: colors.ink,
  },
  sourceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
  sourceImage: {
    width: '100%',
    height: 280,
    backgroundColor: colors.background,
  },
  sourcePlaceholder: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourcePlaceholderText: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});

// Extra styles for the new elements added in this file
const detailStyles = StyleSheet.create({
  imsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.badge,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  imsBadgeText: { ...typography.caption, fontWeight: '700', fontSize: 12 },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  disclaimerText: { ...typography.caption, color: colors.inkMuted, flex: 1, fontSize: 11 },
});
