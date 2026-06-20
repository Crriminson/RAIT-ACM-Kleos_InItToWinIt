import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  SafeAreaView
} from 'react-native';
import { Text } from '../components/AppText';
import * as Clipboard from 'expo-clipboard';
import { FileText, ArrowLeft, ArrowRight, MessageCircle, ZoomIn, Check, Pause, X } from 'lucide-react-native';

import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { generateWhatsAppMessage } from '../data/matching-engine';
import { Severity } from '../data/types';
import { RootStackParamList } from '../navigation/types';
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

function severityLabel(s: Severity, lang: 'hi' | 'en' | 'mr') {
  return s === 'blocked' ? (lang === 'hi' ? 'अस्वीकार' : 'Reject')
    : s === 'pending' ? (lang === 'hi' ? 'होल्ड' : 'Hold')
    : (lang === 'hi' ? 'स्वीकार' : 'Accept');
}

export default function InvoiceDetailScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const route = useRoute<RouteProp<RootStackParamList, 'InvoiceDetail'>>();
  const navigation = useNavigation();
  const { profile } = useProfile();
  const buyerStateCode = (profile?.gstin ?? '09').slice(0, 2);

  const [overrideStatus, setOverrideStatus] = useState<Severity | null>(null);
  const [showImageFull, setShowImageFull] = useState(false);

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

  const status = overrideStatus ?? result.severity;
  const accent = severityColor(status);
  const bg = severityBg(status);

  const entry = result.gstr2bEntry;
  const reason = lang === 'hi' ? result.reason_hi : result.reason_en;
  
  const invItem = invoice.items[0];
  const entryItem = entry?.items[0];
  const invTax = invoice.cgst + invoice.sgst + invoice.igst;
  const entryTax = entry ? entry.cgst + entry.sgst + entry.igst : 0;

  const fields = [
    {
      label: 'GSTIN',
      labelHi: 'GSTIN',
      invoiceValue: invoice.supplierGstin,
      gstr2bValue: entry?.gstin ?? null,
      mismatch: entry ? invoice.supplierGstin !== entry.gstin : false,
    },
    {
      label: 'Taxable Value',
      labelHi: 'कर योग्य मूल्य',
      invoiceValue: formatRupee(invoice.taxableValue),
      gstr2bValue: entry ? formatRupee(entry.taxableValue) : null,
      mismatch: entry ? invoice.taxableValue !== entry.taxableValue : false,
    },
    {
      label: 'Tax Amount',
      labelHi: 'कर राशि',
      invoiceValue: formatRupee(invTax),
      gstr2bValue: entry ? formatRupee(entryTax) : null,
      mismatch: entry ? invTax !== entryTax : false,
    },
    {
      label: 'Invoice Date',
      labelHi: 'तारीख',
      invoiceValue: invoice.invoiceDate,
      gstr2bValue: entry?.invoiceDate ?? null,
      mismatch: entry ? invoice.invoiceDate !== entry.invoiceDate : false,
    },
  ];

  const hasMismatch = fields.some(f => f.mismatch);

  return (
    <View style={styles.root}>
      {/* Back header */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerSub}>{invoice.invoiceNumber}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{invoice.supplierName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: accent }]}>
            <Text style={[styles.statusBadgeText, { color: accent }]}>{severityLabel(status, lang)}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status reasoning banner */}
        <View style={[styles.reasonBanner, { backgroundColor: bg, borderColor: accent }]}>
          <Text style={[styles.reasonText, { color: accent }]}>{reason}</Text>
        </View>

        {/* Amount summary */}
        <View style={styles.amountRow}>
          <View style={styles.amountBox}>
            <Text style={styles.amountBoxLabel}>{lang === 'hi' ? 'इनवॉइस राशि' : 'Invoice Amount'}</Text>
            <Text style={styles.amountBoxValue}>{formatRupee(invoice.invoiceValue)}</Text>
          </View>
          <View style={[styles.amountBox, { backgroundColor: bg, borderColor: accent }]}>
            <Text style={[styles.amountBoxLabel, { color: accent }]}>{lang === 'hi' ? 'ITC राशि' : 'ITC Amount'}</Text>
            <Text style={[styles.amountBoxValue, { color: accent }]}>{formatRupee(result.amount)}</Text>
          </View>
        </View>

        {/* Compare block */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>{lang === 'hi' ? 'इनवॉइस vs GSTR-2B' : 'Invoice vs GSTR-2B'}</Text>
          {hasMismatch && (
            <View style={styles.mismatchBadge}>
              <Text style={styles.mismatchBadgeText}>{lang === 'hi' ? 'मिसमैच' : 'Mismatch found'}</Text>
            </View>
          )}
        </View>

        <View style={styles.compareTable}>
          <View style={styles.compareTableHeader}>
            <Text style={[styles.compareColName, { flex: 1 }]}>{lang === 'hi' ? 'फ़ील्ड' : 'Field'}</Text>
            <Text style={[styles.compareColName, { flex: 1, textAlign: 'center' }]}>{lang === 'hi' ? 'आपका इनवॉइस' : 'Your Invoice'}</Text>
            <Text style={[styles.compareColName, { flex: 1, textAlign: 'center' }]}>GSTR-2B</Text>
          </View>
          {fields.map((f, idx) => (
            <View key={f.label} style={[styles.compareTableRow, idx < fields.length - 1 && styles.compareTableRowBorder, f.mismatch && styles.compareTableRowMismatch]}>
              <Text style={[styles.compareTableCell, { flex: 1, color: colors.inkMuted }]}>{lang === 'hi' ? f.labelHi : f.label}</Text>
              <Text style={[styles.compareTableCell, { flex: 1, textAlign: 'center' }, f.mismatch && styles.compareTableCellMismatch]}>{f.invoiceValue}</Text>
              <Text style={[styles.compareTableCell, { flex: 1, textAlign: 'center', color: f.mismatch ? colors.severity.blocked : colors.inkMuted }]}>{f.gstr2bValue ?? '—'}</Text>
            </View>
          ))}
        </View>
        {hasMismatch && (
          <Text style={styles.mismatchHint}>
            {lang === 'hi' ? '* रेखांकित मान GSTR-2B से मेल नहीं खाते' : '* Underlined values do not match GSTR-2B'}
          </Text>
        )}

        {/* Scanned invoice thumbnail */}
        <Text style={[styles.sectionHeading, { marginTop: spacing.xl }]}>{lang === 'hi' ? 'स्कैन की गई इनवॉइस' : 'Scanned Invoice'}</Text>
        <TouchableOpacity style={styles.thumbCard} activeOpacity={0.8} onPress={() => setShowImageFull(true)}>
          <View style={styles.thumbIconWrap}>
            <FileText size={24} color={colors.inkMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.thumbTitle}>{invoice.invoiceNumber}</Text>
            <Text style={styles.thumbSub}>{invoice.supplierName}</Text>
            <Text style={styles.thumbSub}>{invoice.invoiceDate}</Text>
          </View>
          <View style={styles.thumbAction}>
            <ZoomIn size={16} color={colors.inkMuted} />
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* Fixed bottom controls */}
      <View style={styles.bottomControls}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity style={[styles.segmentBtn, status === 'resolved' ? {backgroundColor: colors.severity.resolvedBg} : {}]} onPress={() => setOverrideStatus('resolved')}>
            <Text style={[styles.segmentBtnText, status === 'resolved' ? {color: colors.severity.resolved} : {}]}>{lang === 'hi' ? 'स्वीकार' : 'Accept'}</Text>
          </TouchableOpacity>
          <View style={styles.segmentDivider} />
          <TouchableOpacity style={[styles.segmentBtn, status === 'pending' ? {backgroundColor: colors.severity.pendingBg} : {}]} onPress={() => setOverrideStatus('pending')}>
            <Text style={[styles.segmentBtnText, status === 'pending' ? {color: colors.severity.pending} : {}]}>{lang === 'hi' ? 'होल्ड' : 'Hold'}</Text>
          </TouchableOpacity>
          <View style={styles.segmentDivider} />
          <TouchableOpacity style={[styles.segmentBtn, status === 'blocked' ? {backgroundColor: colors.severity.blockedBg} : {}]} onPress={() => setOverrideStatus('blocked')}>
            <Text style={[styles.segmentBtnText, status === 'blocked' ? {color: colors.severity.blocked} : {}]}>{lang === 'hi' ? 'अस्वीकार' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.askCaBtn} onPress={() => (navigation as any).navigate('AskCa')}>
          <MessageCircle size={16} color={colors.ink} />
          <Text style={styles.askCaBtnText}>{lang === 'hi' ? 'इस बारे में CA से पूछें' : 'Ask your CA about this'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showImageFull} transparent animationType="fade" onRequestClose={() => setShowImageFull(false)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowImageFull(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowImageFull(false)}>
              <X size={20} color={colors.inkMuted} />
            </TouchableOpacity>
            {invoice.imageUri ? (
              <Image source={{ uri: invoice.imageUri }} style={styles.modalImage} resizeMode="contain" />
            ) : (
              <View style={styles.modalPlaceholder}>
                <FileText size={64} color={colors.inkMuted} />
              </View>
            )}
            <Text style={styles.modalTitle}>{invoice.invoiceNumber}</Text>
            <Text style={styles.modalSub}>{invoice.supplierName} · {invoice.invoiceDate}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowImageFull(false)}>
              <Text style={styles.modalBtnText}>{lang === 'hi' ? 'बंद करें' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerSub: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 160,
  },
  reasonBanner: {
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  amountBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    ...elevation.soft,
  },
  amountBoxLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  amountBoxValue: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.ink,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mismatchBadge: {
    backgroundColor: colors.severity.blockedBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  mismatchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.severity.blocked,
  },
  compareTable: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...elevation.soft,
  },
  compareTableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compareColName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  compareTableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  compareTableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compareTableRowMismatch: {
    backgroundColor: colors.severity.blockedBg,
  },
  compareTableCell: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '500',
  },
  compareTableCellMismatch: {
    color: colors.severity.blocked,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  mismatchHint: {
    fontSize: 10,
    color: colors.severity.blocked,
    marginTop: spacing.xs,
  },
  thumbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...elevation.soft,
  },
  thumbIconWrap: {
    width: 60,
    height: 76,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  thumbSub: {
    fontSize: 12,
    color: colors.inkMuted,
  },
  thumbAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    ...elevation.card,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  segmentBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  segmentDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  askCaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingVertical: 12,
  },
  askCaBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  missingText: {
    fontSize: 16,
    color: colors.inkMuted,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(34,30,26,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalPlaceholder: {
    width: '100%',
    height: 240,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalImage: {
    width: '100%',
    height: 240,
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  modalSub: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  modalBtn: {
    backgroundColor: colors.ink,
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  modalBtnText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
});
