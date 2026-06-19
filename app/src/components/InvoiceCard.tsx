import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text } from './AppText';
import { FileText } from 'lucide-react-native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { Severity } from '../data/types';
import { useI18n } from '../i18n/context';

interface Props {
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  severity: Severity;
  imageUri?: string;
}

function formatRupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → "14 Jun"
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${day} ${months[monthIdx] ?? ''}`;
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

export default function InvoiceCard({
  supplierName,
  invoiceNumber,
  invoiceDate,
  amount,
  severity,
  imageUri,
}: Props) {
  const { t } = useI18n();

  const statusLabel =
    severity === 'blocked' ? (t.diagnosis.itcBlocked)
    : severity === 'pending' ? t.diagnosis.needsFollowUp
    : t.diagnosis.matched;

  return (
    <View style={styles.card}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <FileText size={22} color={colors.inkMuted} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.supplier} numberOfLines={1}>{supplierName}</Text>
        <Text style={styles.meta}>{invoiceNumber}</Text>
        <Text style={styles.meta}>
          {formatDate(invoiceDate)} · {formatRupee(amount)}
        </Text>
      </View>

      <View style={[styles.badge, { backgroundColor: severityBg(severity) }]}>
        <View style={[styles.badgeDot, { backgroundColor: severityColor(severity) }]} />
        <Text style={[styles.badgeLabel, { color: severityColor(severity) }]} numberOfLines={1}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.background,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  supplier: {
    ...typography.bodyBold,
    color: colors.ink,
  },
  meta: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.badge,
    gap: 5,
    maxWidth: 110,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeLabel: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
});
