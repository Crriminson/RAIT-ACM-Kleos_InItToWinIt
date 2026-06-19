import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Animated,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Text } from '../components/AppText';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CheckCircle,
  RotateCcw,
  Share2,
  XCircle,
  AlertTriangle,
  FileSearch,
  MessageCircle,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Database,
  GitCompare,
  ThumbsDown,
  Clock,
  FileText,
  Download,
  Volume2,
  VolumeX,
  CalendarClock,
} from 'lucide-react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, elevation, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { DiagnosisResult, ImsAction, Severity } from '../data/types';
import { generateWhatsAppMessage } from '../data/matching-engine';
import { useSession } from '../data/contexts/session-context';
import { RootStackParamList } from '../navigation/types';
import AnimatedCard from '../components/AnimatedCard';
import ItcHealthCard from '../components/ItcHealthCard';
import { sendWhatsApp, exportCsv, exportPdf } from '../utils/share';
import { speak, stopSpeaking } from '../utils/speech';
import { section16Deadline } from '../utils/gst-deadlines';

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

function SeverityIcon({ severity, size = 22 }: { severity: Severity; size?: number }) {
  const color = severityColor(severity);
  if (severity === 'blocked') return <XCircle size={size} color={color} />;
  if (severity === 'pending') return <AlertTriangle size={size} color={color} />;
  return <CheckCircle size={size} color={color} />;
}

function PulseRing({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.8, duration: 1400, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[styles.pulseRing, { borderColor: color, transform: [{ scale }], opacity }]}
    />
  );
}

// ── IMS Action Badge (FEATURE-013) ──────────────────────────────────────────
const IMS_COLORS: Record<ImsAction, { bg: string; text: string }> = {
  ACCEPT:       { bg: '#E8F5E9', text: '#2E7D32' },
  HOLD:         { bg: '#FFF3E0', text: '#E65100' },
  NOT_ON_IMS_YET: { bg: '#ECEFF1', text: '#546E7A' },
};

function ActionBadge({ action, lang }: { action: ImsAction; lang: 'hi' | 'en' }) {
  const { t } = useI18n();
  const { bg, text } = IMS_COLORS[action];
  const label =
    action === 'ACCEPT'         ? t.diagnosis.imsAccept
    : action === 'HOLD'         ? t.diagnosis.imsHold
    : t.diagnosis.imsNotYet;

  return (
    <View style={[styles.imsBadge, { backgroundColor: bg, minHeight: 44, justifyContent: 'center' }]}>
      {action === 'NOT_ON_IMS_YET' && <Clock size={14} color={text} />}
      <Text style={[styles.imsBadgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

// ── "I disagree" affordance (FEATURE-011) ───────────────────────────────────
function DisagreeButton({ resultId, lang }: { resultId: string; lang: 'hi' | 'en' }) {
  const { t } = useI18n();
  const [agreed, setAgreed] = useState<'idle' | 'noted'>('idle');

  const handleDisagree = async () => {
    setAgreed('noted');
    try {
      await AsyncStorage.setItem(`@kleos/feedback/${resultId}`, JSON.stringify({ disagreed: true, at: Date.now() }));
    } catch {
      // Non-fatal — feedback is best-effort
    }
    setTimeout(() => setAgreed('idle'), 2000);
  };

  return (
    <TouchableOpacity
      style={styles.disagreeButton}
      onPress={handleDisagree}
      activeOpacity={0.7}
      accessibilityLabel={t.diagnosis.disagree}
    >
      <ThumbsDown size={14} color={colors.inkMuted} />
      <Text style={styles.disagreeText}>
        {agreed === 'noted' ? t.diagnosis.disagreed : t.diagnosis.disagree}
      </Text>
    </TouchableOpacity>
  );
}

// ── Issue card ───────────────────────────────────────────────────────────────
function IssueCard({ result, lang }: { result: DiagnosisResult; lang: 'hi' | 'en' }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const reason = lang === 'hi' ? result.reason_hi : result.reason_en;
  const action = lang === 'hi' ? result.action_hi : result.action_en;
  const color = severityColor(result.severity);
  const badgeLabel =
    result.severity === 'blocked' ? t.diagnosis.itcBlocked
    : result.severity === 'pending' ? t.diagnosis.needsFollowUp
    : t.diagnosis.matched;

  // Section 16(4) ITC claim deadline for this invoice.
  const deadline = section16Deadline(result.invoiceDate);

  const [voiceMissing, setVoiceMissing] = useState(false);

  // Stop speech if the card unmounts (e.g. user leaves the screen mid-read).
  useEffect(() => () => stopSpeaking(), []);

  // What the 🔊 button reads aloud — amount + plain-language reason + action.
  // Built for both languages so we can fall back to English audio on devices
  // (e.g. MIUI) that have no Hindi voice installed.
  const buildSpoken = (l: 'hi' | 'en'): string => {
    const amt = formatRupee(result.amount);
    const phrase =
      l === 'hi'
        ? result.severity === 'blocked'
          ? `${amt} की ITC अटकी है।`
          : result.severity === 'pending'
            ? `${amt} की ITC follow-up में है।`
            : `${amt} की ITC सही है।`
        : result.severity === 'blocked'
          ? `${amt} of ITC is blocked.`
          : result.severity === 'pending'
            ? `${amt} of ITC needs follow-up.`
            : `${amt} of ITC is fine.`;
    const r = l === 'hi' ? result.reason_hi : result.reason_en;
    const a = l === 'hi' ? result.action_hi : result.action_en;
    return `${phrase} ${r}${result.severity !== 'resolved' ? ' ' + a : ''}`;
  };

  const handleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setVoiceMissing(false);
    speak(
      buildSpoken(lang),
      lang,
      {
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
        // No Hindi voice on this device — we read the English version instead.
        onUnavailable: () => setVoiceMissing(true),
      },
      lang === 'hi' ? { text: buildSpoken('en'), lang: 'en' } : undefined,
    );
  };

  const handleWhatsApp = async () => {
    const how = await sendWhatsApp(generateWhatsAppMessage(result, lang));
    if (how === 'clipboard') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* Header row: icon chip + badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconChip, { backgroundColor: severityBg(result.severity) }]}>
          {result.severity === 'blocked' && <PulseRing color={color} />}
          <SeverityIcon severity={result.severity} />
        </View>
        <View style={styles.cardHeaderText}>
          <View style={[styles.badge, { backgroundColor: severityBg(result.severity) }]}>
            <Text style={[styles.badgeLabel, { color }]}>{badgeLabel}</Text>
          </View>
          <Text style={styles.supplierLine} numberOfLines={1}>
            {result.supplierName} · {result.invoiceNumber}
          </Text>
        </View>
        {/* 🔊 Read aloud (TTS) — Hindi/English, for low-literacy users */}
        <TouchableOpacity
          style={[styles.speakButton, speaking && styles.speakButtonActive]}
          onPress={handleSpeak}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={lang === 'hi' ? 'पढ़कर सुनाएं' : 'Read aloud'}
        >
          {speaking ? <VolumeX size={18} color={colors.surface} /> : <Volume2 size={18} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {/* IMS Action badge (FEATURE-013) */}
      <ActionBadge action={result.imsAction} lang={lang} />

      {/* Amount */}
      <Text style={[styles.amount, { color }]}>{formatRupee(result.amount)}</Text>

      {/* Reason */}
      <Text style={styles.reason}>{reason}</Text>

      {/* Section 16(4) ITC claim-deadline countdown */}
      {deadline && (
        <View style={styles.deadlineRow}>
          <CalendarClock size={13} color={deadline.expired ? colors.severity.blocked : colors.inkMuted} />
          <Text style={[styles.deadlineText, deadline.expired && { color: colors.severity.blocked }]}>
            {deadline.expired
              ? (lang === 'hi'
                  ? `ITC claim की समय सीमा निकल गई (${deadline.label})`
                  : `ITC claim deadline passed (${deadline.label})`)
              : (lang === 'hi'
                  ? `${deadline.label} तक ITC claim करें · ${deadline.daysLeft} दिन बाकी`
                  : `Claim ITC by ${deadline.label} · ${deadline.daysLeft} days left`)}
          </Text>
        </View>
      )}

      {/* Hindi voice not installed on this device — explain the English fallback */}
      {voiceMissing && (
        <Text style={styles.voiceHint}>
          {lang === 'hi'
            ? 'इस फ़ोन में Hindi आवाज़ नहीं है — अंग्रेज़ी में सुनाया। फ़ोन की Text-to-speech settings में Hindi voice install करें।'
            : "No Hindi voice on this device — played in English. Install Hindi in your phone's text-to-speech settings."}
        </Text>
      )}

      {/* Action box */}
      {result.severity !== 'resolved' && (
        <View style={[styles.actionBox, { backgroundColor: severityBg(result.severity) }]}>
          <ArrowRight size={16} color={color} style={{ marginTop: 2 }} />
          <Text style={styles.actionText}>{action}</Text>
        </View>
      )}

      {/* Buttons */}
      {result.severity !== 'resolved' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => navigation.navigate('InvoiceDetail', { resultId: result.id })}
          >
            <FileSearch size={16} color={colors.primary} />
            <Text style={styles.ghostButtonText}>{t.diagnosis.viewInvoice}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsApp}>
            <MessageCircle size={16} color={colors.surface} />
            <Text style={styles.solidButtonText}>
              {copied ? t.diagnosis.copied : (lang === 'hi' ? 'WhatsApp भेजें' : 'WhatsApp')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* "I disagree" affordance (FEATURE-011) — shown for all non-resolved results */}
      {result.severity !== 'resolved' && (
        <DisagreeButton resultId={result.id} lang={lang} />
      )}
    </View>
  );
}

export default function DiagnosisScreen() {
  const { t, lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation();

  const [exportVisible, setExportVisible] = useState(false);

  const results = session.results;
  const summary = session.summary;
  // Derive period from most recent history record (set by session after processing)
  const period = session.history[0]?.period ?? (lang === 'hi' ? 'यह महीना' : 'This month');

  const blockedCount = results.filter((r) => r.severity === 'blocked').length;
  const pendingCount = results.filter((r) => r.severity === 'pending').length;

  const handleNewCheck = () => {
    session.reset();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  };

  const handleShare = async () => {
    const blocked = results.filter((r) => r.severity === 'blocked');
    const pending = results.filter((r) => r.severity === 'pending');
    const resolved = results.filter((r) => r.severity === 'resolved');

    const lines = [
      lang === 'hi' ? `📋 ITC जाँच रिपोर्ट — ${period}` : `📋 ITC Diagnosis Report — ${period}`,
      '',
      `${formatRupee(summary.totalBlocked)} ${lang === 'hi' ? 'ITC अटकी है' : 'ITC blocked'}`,
      summary.totalPending > 0
        ? `${formatRupee(summary.totalPending)} ${lang === 'hi' ? 'follow-up में' : 'needs follow-up'}`
        : '',
      `${summary.issueCount} ${lang === 'hi' ? 'समस्याएं' : 'issues'} · ${summary.resolvedCount} ${lang === 'hi' ? 'सही match' : 'matched'}`,
      '',
    ].filter((l) => l !== undefined);
    for (const r of [...blocked, ...pending]) {
      lines.push(`🔴 ${formatRupee(r.amount)} — ${lang === 'hi' ? r.reason_hi : r.reason_en}`);
    }
    if (resolved.length > 0) {
      lines.push('');
      lines.push(`✅ ${resolved.length} ${lang === 'hi' ? 'invoices सही match हुईं' : 'invoices matched'} (${formatRupee(summary.totalResolved)})`);
    }
    lines.push('', '— CA in Your Pocket');
    const text = lines.join('\n');

    if (Platform.OS === 'web') await Clipboard.setStringAsync(text);
    else await Share.share({ message: text });
  };

  // Cross-platform export picker: a Modal renders identically on web and native,
  // unlike Alert.alert (which is a no-op on web). Each option closes the sheet
  // then runs its export; errors are swallowed so a failed share never crashes.
  const runExport = (fn: () => void | Promise<void>) => {
    setExportVisible(false);
    Promise.resolve()
      .then(fn)
      .catch(() => { /* best-effort export */ });
  };

  const handleExportMenu = () => setExportVisible(true);

  if (results.length === 0) {
    return (
      <View style={styles.allClear}>
        <View style={styles.allClearIcon}>
          <CheckCircle size={56} color={colors.severity.resolved} />
        </View>
        <Text style={styles.allClearTitle}>{t.diagnosis.allClear}</Text>
        <Text style={styles.allClearSub}>{t.diagnosis.allClearSub}</Text>
      </View>
    );
  }

  const headerGradient =
    blockedCount > 0 ? gradients.blocked
    : pendingCount > 0 ? gradients.pending
    : gradients.resolved;

  return (
    <View style={styles.container}>
      {/* Gradient hero summary */}
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.heroRow}>
            <Text style={styles.heroLabel}>
              {lang === 'hi' ? 'इस महीने अटकी ITC' : 'ITC blocked this month'}
            </Text>
            <TouchableOpacity onPress={handleExportMenu} style={styles.shareButton}>
              <Share2 size={18} color={colors.surface} />
            </TouchableOpacity>
          </View>

          {/* BUG-001: show blocked and pending separately */}
          <Text style={styles.heroAmount}>{formatRupee(summary.totalBlocked)}</Text>
          {summary.totalPending > 0 && (
            <Text style={styles.heroPending}>
              {lang === 'hi'
                ? `+ ${formatRupee(summary.totalPending)} follow-up में`
                : `+ ${formatRupee(summary.totalPending)} needs follow-up`}
            </Text>
          )}

          {/* Breakdown pills */}
          <View style={styles.pillRow}>
            {blockedCount > 0 && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {blockedCount} {lang === 'hi' ? 'अटकी' : 'blocked'}
                </Text>
              </View>
            )}
            {pendingCount > 0 && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {pendingCount} {lang === 'hi' ? 'follow-up' : 'follow-up'}
                </Text>
              </View>
            )}
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {summary.resolvedCount} {lang === 'hi' ? 'सही' : 'matched'}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ITC health score + breakdown */}
        <ItcHealthCard
          totalBlocked={summary.totalBlocked}
          totalMatched={summary.totalResolved}
          issueCount={summary.issueCount}
          resolvedCount={summary.resolvedCount}
        />

        {/* AI advisory entry */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => (navigation as any).navigate('AiInsights')}
          style={styles.aiButtonShadow}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiButton}
          >
            <View style={styles.aiButtonIcon}>
              <Sparkles size={20} color={colors.surface} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiButtonTitle}>{t.aiInsights.openButton}</Text>
              <Text style={styles.aiButtonSub}>
                {lang === 'hi' ? 'सलाह + टैक्स बचत रणनीतियाँ' : 'Advisory + tax-saving strategies'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.surface} />
          </LinearGradient>
        </TouchableOpacity>

        {/* GST Portal + Compare entries */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('Portal2B')}
          >
            <Database size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>{t.portal.title}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.8}
            onPress={() => (navigation as any).navigate('Compare')}
          >
            <GitCompare size={18} color={colors.primary} />
            <Text style={styles.actionButtonText}>{t.compare.title}</Text>
          </TouchableOpacity>
        </View>

        {results.map((result, idx) => (
          <AnimatedCard key={result.id} index={idx}>
            <IssueCard result={result} lang={lang} />
          </AnimatedCard>
        ))}

        <TouchableOpacity style={styles.newCheckButton} onPress={handleNewCheck} activeOpacity={0.8}>
          <RotateCcw size={16} color={colors.primary} />
          <Text style={styles.newCheckText}>{lang === 'hi' ? 'नई जाँच करें' : 'New Check'}</Text>
        </TouchableOpacity>

        {/* FEATURE-012: Advisory disclaimer — non-negotiable, unconditional */}
        <View style={styles.disclaimerBanner}>
          <AlertTriangle size={14} color={colors.inkMuted} />
          <Text style={styles.disclaimerText}>{t.diagnosis.disclaimer}</Text>
        </View>
      </ScrollView>

      {/* Export picker — works on web and native (unlike Alert.alert on web) */}
      <Modal
        visible={exportVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportVisible(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExportVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {lang === 'hi' ? 'रिपोर्ट एक्सपोर्ट करें' : 'Export report'}
            </Text>

            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={() => runExport(handleShare)}>
              <View style={styles.sheetIcon}><Share2 size={20} color={colors.primary} /></View>
              <Text style={styles.sheetRowText}>
                {Platform.OS === 'web'
                  ? (lang === 'hi' ? 'टेक्स्ट कॉपी करें' : 'Copy report text')
                  : (lang === 'hi' ? 'टेक्स्ट शेयर करें' : 'Share as text')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={() => runExport(() => exportCsv(results, lang, period))}>
              <View style={styles.sheetIcon}><Download size={20} color={colors.primary} /></View>
              <Text style={styles.sheetRowText}>
                {Platform.OS === 'web'
                  ? (lang === 'hi' ? 'CSV डाउनलोड करें' : 'Download CSV')
                  : (lang === 'hi' ? 'CSV एक्सपोर्ट करें' : 'Export CSV')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} activeOpacity={0.7} onPress={() => runExport(() => exportPdf(results, summary, lang, period))}>
              <View style={styles.sheetIcon}><FileText size={20} color={colors.primary} /></View>
              <Text style={styles.sheetRowText}>
                {Platform.OS === 'web'
                  ? (lang === 'hi' ? 'PDF के रूप में सेव करें' : 'Save as PDF')
                  : (lang === 'hi' ? 'PDF एक्सपोर्ट करें' : 'Export PDF')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetCancel} activeOpacity={0.7} onPress={() => setExportVisible(false)}>
              <Text style={styles.sheetCancelText}>{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Export sheet (Modal)
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl,
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.heading2, color: colors.ink, marginBottom: spacing.sm },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
  },
  sheetIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.recognitionBg, justifyContent: 'center', alignItems: 'center',
  },
  sheetRowText: { ...typography.bodyBold, color: colors.ink },
  sheetCancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  sheetCancelText: { ...typography.label, color: colors.inkSecondary, fontWeight: '600' },

  // All clear
  allClear: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenH,
  },
  allClearIcon: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: colors.severity.resolvedBg,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  allClearTitle: { ...typography.heading1, color: colors.severity.resolved },
  allClearSub: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },

  // Hero
  hero: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...elevation.card,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  heroLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  shareButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroAmount: {
    fontSize: 46,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -1,
    marginTop: spacing.xs,
  },
  heroPending: {
    ...typography.label,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.badge,
  },
  pillText: { ...typography.caption, color: colors.surface, fontWeight: '600' },

  // List
  list: { flex: 1 },
  listContent: { padding: spacing.screenH, gap: spacing.md, paddingBottom: spacing.xl },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...elevation.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  iconChip: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 14,
    borderWidth: 2,
  },
  cardHeaderText: { flex: 1, gap: 3 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.badge,
  },
  badgeLabel: { ...typography.caption, fontWeight: '700' },
  supplierLine: { ...typography.caption, color: colors.inkMuted },
  amount: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginBottom: spacing.xs },
  reason: { ...typography.body, color: colors.ink, marginBottom: spacing.sm },
  speakButton: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.recognitionBg,
    justifyContent: 'center', alignItems: 'center',
  },
  speakButtonActive: { backgroundColor: colors.primary },
  deadlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm,
  },
  deadlineText: { ...typography.caption, color: colors.inkMuted },
  voiceHint: {
    ...typography.caption,
    color: colors.severity.pending,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  actionBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.input,
    marginBottom: spacing.md,
  },
  actionText: { ...typography.body, color: colors.inkSecondary, flex: 1, fontSize: 14 },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  ghostButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 11,
  },
  ghostButtonText: { ...typography.label, color: colors.primary, fontWeight: '600' },
  solidButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 11,
    ...elevation.primary,
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    borderRadius: radii.button,
    paddingVertical: 11,
  },
  solidButtonText: { ...typography.label, color: colors.surface, fontWeight: '600' },

  // IMS badge (FEATURE-013)
  imsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.badge,
    marginBottom: spacing.sm,
  },
  imsBadgeText: { ...typography.caption, fontWeight: '700', fontSize: 12 },

  // "I disagree" (FEATURE-011)
  disagreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  disagreeText: { ...typography.caption, color: colors.inkMuted, fontSize: 12 },

  newCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.recognitionBg,
    borderRadius: radii.button,
    paddingVertical: 15,
    marginTop: spacing.sm,
  },
  newCheckText: { ...typography.label, color: colors.primary, fontWeight: '700' },

  // Disclaimer banner (FEATURE-012)
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  disclaimerText: { ...typography.caption, color: colors.inkMuted, flex: 1, fontSize: 11 },

  aiButtonShadow: { borderRadius: radii.card, ...elevation.primary },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  aiButtonIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  aiButtonTitle: { ...typography.bodyBold, color: colors.surface, fontSize: 16 },
  aiButtonSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.soft,
  },
  actionButtonText: { ...typography.label, color: colors.ink, fontWeight: '600' },
});
