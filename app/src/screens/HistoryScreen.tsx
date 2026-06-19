import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from '../components/AppText';
import { Clock, Upload, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession, SessionRecord } from '../data/contexts/session-context';
import InvoiceCard from '../components/InvoiceCard';
import GradientHeader from '../components/GradientHeader';

function formatRupee(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

function formatRunTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} · ${time}`;
}

function HistoryGroup({ record, lang }: { record: SessionRecord; lang: 'hi' | 'en' }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.group}>
      <TouchableOpacity
        style={styles.groupHeader}
        activeOpacity={0.7}
        onPress={() => setExpanded((e) => !e)}
      >
        <View style={styles.groupHeaderText}>
          <Text style={styles.groupPeriod}>{record.period}</Text>
          <Text style={styles.groupMeta}>{formatRunTime(record.runAt)}</Text>
        </View>

        <View style={styles.groupSummary}>
          {record.issueCount > 0 ? (
            <Text style={styles.groupBlocked}>
              {formatRupee(record.totalBlocked)} {t.diagnosis.blocked}
            </Text>
          ) : (
            <Text style={styles.groupClean}>
              {lang === 'hi' ? 'सब ठीक' : 'All clear'}
            </Text>
          )}
          <Text style={styles.groupCount}>
            {record.invoiceCount} {lang === 'hi' ? 'invoices' : 'invoices'} ·{' '}
            {record.issueCount} {t.diagnosis.issues}
          </Text>
        </View>

        {expanded ? (
          <ChevronUp size={20} color={colors.inkMuted} />
        ) : (
          <ChevronDown size={20} color={colors.inkMuted} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.groupBody}>
          {record.invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              supplierName={inv.supplierName}
              invoiceNumber={inv.invoiceNumber}
              invoiceDate={inv.invoiceDate}
              amount={inv.amount}
              severity={inv.severity}
              imageUri={inv.imageUri}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation<any>();

  if (session.history.length === 0) {
    return (
      <View style={styles.safeArea}>
        <GradientHeader title={t.history.title} onBack={() => navigation.goBack()} />
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Clock size={44} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>{t.history.empty}</Text>
          <TouchableOpacity
            style={styles.uploadCta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          >
            <Upload size={16} color={colors.ink} />
            <Text style={styles.uploadCtaText}>{t.history.uploadCta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <GradientHeader
        title={t.history.title}
        subtitle={`${session.history.length} ${lang === 'hi' ? 'जाँच' : 'checks'}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {session.history.map((record) => (
          <HistoryGroup key={record.id} record={record} lang={lang} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenH,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.inkMuted,
  },
  uploadCta: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.button,
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  uploadCtaText: {
    ...typography.label,
    color: colors.ink,
  },
  group: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  groupHeaderText: {
    flex: 1,
  },
  groupPeriod: {
    ...typography.heading2,
    color: colors.ink,
  },
  groupMeta: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  groupSummary: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  groupBlocked: {
    ...typography.bodyBold,
    color: colors.severity.blocked,
  },
  groupClean: {
    ...typography.bodyBold,
    color: colors.severity.resolved,
  },
  groupCount: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  groupBody: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
