import React from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text } from '../components/AppText';
import { CheckCircle, FileSpreadsheet, AlertTriangle, FileText, ScanSearch } from 'lucide-react-native';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { RootStackParamList } from '../navigation/types';
import GradientButton from '../components/GradientButton';
import GradientHeader from '../components/GradientHeader';

function InvoiceFileCard({ name, uri, mimeType }: { name: string; uri: string; mimeType?: string }) {
  const { t } = useI18n();
  const isImage =
    (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(name)) &&
    !uri.startsWith('demo://');

  return (
    <View style={styles.invoiceCard}>
      {isImage ? (
        <Image source={{ uri }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <FileText size={24} color={colors.inkMuted} />
        </View>
      )}
      <View style={styles.invoiceCardContent}>
        <Text style={styles.invoiceCardName} numberOfLines={1}>{name}</Text>
        <View style={styles.recognitionBadge}>
          <ScanSearch size={13} color={colors.primary} />
          <Text style={styles.recognitionText}>{t.review.recognised}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ReviewScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.root}>
      <GradientHeader
        title={t.review.title}
        subtitle={lang === 'hi' ? 'पक्का करें और जाँच शुरू करें' : 'Confirm and start checking'}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* GSTR-2B summary card */}
        {session.gstr2bFile && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <FileSpreadsheet size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{t.review.gstr2bSummary} · May 2026</Text>
              <Text style={styles.summaryFilename} numberOfLines={1}>{session.gstr2bFile.name}</Text>
              <Text style={styles.summaryDetail}>
                {session.gstr2bEntries.length} {t.review.entriesDetected}
              </Text>
            </View>
            <CheckCircle size={22} color={colors.severity.resolved} />
          </View>
        )}

        {/* Invoice files */}
        <Text style={styles.sectionLabel}>
          {session.invoiceFiles.length} {lang === 'hi' ? 'invoices' : 'invoices'}
        </Text>
        {session.invoiceFiles.map((file) => (
          <InvoiceFileCard key={file.uri} name={file.name} uri={file.uri} mimeType={file.mimeType} />
        ))}

        {session.invoiceFiles.length === 0 && (
          <View style={styles.emptyInvoices}>
            <AlertTriangle size={20} color={colors.severity.pending} />
            <Text style={styles.emptyInvoicesText}>
              {lang === 'hi' ? 'कोई invoice नहीं' : 'No invoice files uploaded'}
            </Text>
          </View>
        )}

        <GradientButton
          label={t.review.confirm}
          onPress={() => navigation.navigate('Processing')}
          icon={<ScanSearch size={20} color={colors.surface} />}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.screenH, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  summaryIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center', alignItems: 'center',
  },
  summaryTitle: { ...typography.bodyBold, color: colors.ink },
  summaryFilename: { ...typography.caption, color: colors.inkSecondary, marginTop: 2 },
  summaryDetail: { ...typography.caption, color: colors.primary, marginTop: 2, fontWeight: '600' },

  sectionLabel: { ...typography.heading2, color: colors.ink, marginBottom: spacing.sm },
  invoiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    paddingRight: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  thumbnail: { width: 52, height: 52, borderRadius: radii.thumbnail, backgroundColor: colors.surfaceRaised },
  thumbnailPlaceholder: {
    width: 52, height: 52, borderRadius: radii.thumbnail,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center', alignItems: 'center',
  },
  invoiceCardContent: { flex: 1, gap: spacing.xs },
  invoiceCardName: { ...typography.bodyBold, color: colors.ink },
  recognitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.recognitionBg,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.badge,
  },
  recognitionText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  emptyInvoices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.pendingBg,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyInvoicesText: { ...typography.body, color: colors.severity.pending },
});
