import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../components/AppText';
import { IndianRupee, ChevronDown, ChevronUp, ScanSearch } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession, SessionRecord } from '../data/contexts/session-context';
import { RootStackParamList } from '../navigation/types';
import InvoiceCard from '../components/InvoiceCard';
import DiagnosisScreen from './DiagnosisScreen';

function formatRupee(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatRunTime(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]} · ${time}`;
}

function HistoryGroup({ record, lang }: { record: SessionRecord; lang: 'hi' | 'en' }) {
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
            <Text style={styles.groupBlocked}>{formatRupee(record.totalBlocked)}</Text>
          ) : (
            <Text style={styles.groupClean}>{lang === 'hi' ? 'सब ठीक' : 'All clear'}</Text>
          )}
          <Text style={styles.groupCount}>
            {record.invoiceCount} invoices · {record.issueCount} {lang === 'hi' ? 'समस्या' : 'issues'}
          </Text>
        </View>
        {expanded ? <ChevronUp size={18} color={colors.inkMuted} /> : <ChevronDown size={18} color={colors.inkMuted} />}
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

export default function ReportsScreen() {
  const { lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (session.phase === 'results' && session.results.length > 0) {
    return <DiagnosisScreen />;
  }

  const history = session.history;
  const totalSaved = history.reduce((sum, r) => sum + r.totalResolved, 0);
  const totalBlocked = history.reduce((sum, r) => sum + r.totalBlocked, 0);

  if (history.length === 0) {
    return (
      <View style={styles.emptyRoot}>
        <SafeAreaView edges={['top']} />
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <IndianRupee size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {lang === 'hi' ? 'अभी कोई रिपोर्ट नहीं' : 'No reports yet'}
          </Text>
          <Text style={styles.emptyText}>
            {lang === 'hi'
              ? 'Home tab से GSTR-2B और invoices अपलोड करें — ITC जाँच की रिपोर्ट यहाँ दिखेगी।'
              : 'Upload GSTR-2B and invoices from the Home tab — your ITC diagnosis reports will appear here.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Main' as any, { screen: 'Home' })}
          >
            <ScanSearch size={16} color="#FFFFFF" />
            <Text style={styles.emptyCtaText}>
              {lang === 'hi' ? 'जाँच शुरू करें' : 'Start a check'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {lang === 'hi' ? 'रिपोर्ट' : 'Reports'}
          </Text>
          <Text style={styles.headerSub}>
            {history.length} {lang === 'hi' ? 'जाँचें पूरी हुईं' : 'checks completed'}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>{formatRupee(totalSaved)}</Text>
            <Text style={styles.statLabel}>{lang === 'hi' ? 'ITC सुरक्षित' : 'ITC SAFE'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.error }]}>{formatRupee(totalBlocked)}</Text>
            <Text style={styles.statLabel}>{lang === 'hi' ? 'ITC अटकी' : 'ITC BLOCKED'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>
          {lang === 'hi' ? 'पिछली जाँचें' : 'PAST CHECKS'}
        </Text>
        {history.map((record) => (
          <HistoryGroup key={record.id} record={record} lang={lang} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyRoot: { flex: 1, backgroundColor: colors.background },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.ink },
  emptyText: { ...typography.body, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.full,
    marginTop: spacing.md,
  },
  emptyCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  headerSub: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  content: { padding: spacing.screenH, paddingTop: spacing.lg, paddingBottom: spacing.xl },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.inkMuted, letterSpacing: 1 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },

  group: { marginBottom: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeaderText: { flex: 1 },
  groupPeriod: { fontSize: 16, fontWeight: '600', color: colors.ink },
  groupMeta: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  groupSummary: { alignItems: 'flex-end', marginRight: spacing.xs },
  groupBlocked: { fontSize: 15, fontWeight: '700', color: colors.severity.blocked },
  groupClean: { fontSize: 15, fontWeight: '700', color: colors.severity.resolved },
  groupCount: { ...typography.caption, color: colors.inkMuted, marginTop: 2 },
  groupBody: { gap: spacing.sm, marginTop: spacing.sm },
});
