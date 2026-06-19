import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, Lightbulb, FileText, WifiOff, AlertTriangle, ArrowRight } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { getAiAdvice, getTaxStrategies, AdvisoryData, Strategy, AiMethod } from '../api/ai';
import GradientHeader from '../components/GradientHeader';
import Markdown from '../components/Markdown';

export default function AiInsightsScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [advisory, setAdvisory] = useState<AdvisoryData | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [method, setMethod] = useState<AiMethod | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [adv, strat] = await Promise.all([
          getAiAdvice(session.results, session.invoices),
          getTaxStrategies({
            totalBlockedAmt: session.summary.totalBlocked,
            mismatchesCount: session.summary.issueCount,
            invoiceCount: session.invoices.length,
            lang,
          }),
        ]);
        if (!active) return;
        setAdvisory(adv.data);
        setStrategies(strat.strategies);
        setMethod(adv.method === 'gemini' && strat.method === 'gemini' ? 'gemini' : 'fallback');
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const adviceText = advisory ? (lang === 'hi' ? advisory.adviceHi : advisory.adviceEn) : '';

  return (
    <View style={styles.root}>
      <GradientHeader title={t.aiInsights.title} onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.centered}>
          <View style={styles.loadingIcon}>
            <Sparkles size={32} color={colors.primary} />
          </View>
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
          <Text style={styles.loadingText}>{t.aiInsights.loading}</Text>
        </View>
      ) : failed ? (
        <View style={styles.centered}>
          <WifiOff size={40} color={colors.inkMuted} />
          <Text style={styles.loadingText}>{t.aiInsights.error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {method === 'fallback' && (
            <View style={styles.offlineBanner}>
              <WifiOff size={14} color={colors.severity.pending} />
              <Text style={styles.offlineText}>{t.aiInsights.offlineNote}</Text>
            </View>
          )}

          {/* Early Warning Banner */}
          <TouchableOpacity 
            style={styles.earlyWarningBanner} 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('EarlyWarning' as never)}
          >
            <View style={styles.earlyWarningIcon}>
              <AlertTriangle size={20} color={colors.severity.blocked} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earlyWarningTitle}>
                {lang === 'hi' ? 'GSTR-2A अर्ली वार्निंग' : 'GSTR-2A Early Warning'}
              </Text>
              <Text style={styles.earlyWarningSub}>
                {lang === 'hi' 
                  ? 'पेंडिंग सप्लायर्स चेक करें जिनकी वजह से ITC ब्लॉक हो सकता है' 
                  : 'Check pending suppliers that could block your ITC'}
              </Text>
            </View>
            <ArrowRight size={20} color={colors.severity.blocked} />
          </TouchableOpacity>

          {/* Advisory */}
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.accentMuted }]}>
              <FileText size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{t.aiInsights.advisoryTitle}</Text>
          </View>
          <View style={styles.card}>
            {adviceText ? <Markdown>{adviceText}</Markdown> : null}
          </View>

          {/* Strategies */}
          <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.severity.pendingBg }]}>
              <Lightbulb size={18} color={colors.severity.pending} />
            </View>
            <Text style={styles.sectionTitle}>{t.aiInsights.strategiesTitle}</Text>
          </View>
          {strategies.map((s, i) => (
            <View key={i} style={styles.strategyCard}>
              <View style={styles.strategyNum}>
                <Text style={styles.strategyNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.strategyTitle}>{s.title}</Text>
                <Text style={styles.strategySub}>{s.subtitle}</Text>
                <Text style={styles.strategyDesc}>{s.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  loadingIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { ...typography.body, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm },

  content: { padding: spacing.screenH, paddingBottom: spacing.xl },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.severity.pendingBg,
    borderRadius: radii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  offlineText: { ...typography.caption, color: colors.severity.pending, fontWeight: '600' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { ...typography.heading2, color: colors.ink },

  earlyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFF0F0',
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.2)',
  },
  earlyWarningIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  earlyWarningTitle: { ...typography.bodyBold, color: colors.severity.blocked, marginBottom: 2 },
  earlyWarningSub: { ...typography.caption, color: colors.severity.blocked, opacity: 0.8 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.card,
  },
  strategyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  strategyNum: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  strategyNumText: { ...typography.bodyBold, color: colors.ink, fontWeight: '800' },
  strategyTitle: { ...typography.bodyBold, color: colors.ink },
  strategySub: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: 2, marginBottom: spacing.xs },
  strategyDesc: { ...typography.body, color: colors.inkSecondary, fontSize: 14 },
});
