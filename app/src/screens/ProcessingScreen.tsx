import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from '../components/AppText';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScanSearch, Lightbulb } from 'lucide-react-native';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import { RootStackParamList } from '../navigation/types';

const STATUS_HI = [
  'Invoices पढ़ी जा रही हैं...',
  'GSTR-2B से match हो रहा है...',
  'HSN codes check हो रहे हैं...',
  'ITC calculate हो रहा है...',
  'लगभग हो गया...',
];
const STATUS_EN = [
  'Reading invoices...',
  'Matching with GSTR-2B...',
  'Checking HSN codes...',
  'Calculating ITC impact...',
  'Almost done...',
];

// Short, true GST/ITC facts rotated while the scan runs — keeps the user
// engaged (and subtly educated) through the ~25s/invoice offline OCR wait.
const TIPS_EN = [
  'GSTR-2B locks on the 14th of each month — reconcile before then.',
  'ITC on an invoice missing from GSTR-2B stays blocked until your supplier files it.',
  'A wrong HSN code is one of the most common reasons ITC gets blocked.',
  'Pay suppliers within 180 days, or Rule 37 makes you reverse the credit.',
  'Under the new IMS, taking no action on an invoice counts as accepting it.',
  'GSTR-2B is a locked monthly snapshot — not a live feed.',
];
const TIPS_HI = [
  'GSTR-2B हर महीने की 14 तारीख को लॉक होता है — उससे पहले मिलान करें।',
  'जो बिल GSTR-2B में नहीं है, उसका ITC तब तक रुका रहता है जब तक सप्लायर फाइल न करे।',
  'गलत HSN कोड ITC रुकने का सबसे आम कारणों में से एक है।',
  'सप्लायर को 180 दिनों में भुगतान करें, वरना नियम 37 के तहत ITC वापस करना होगा।',
  'नए IMS में किसी बिल पर कोई कार्रवाई न करना उसे स्वीकार करना माना जाता है।',
  'GSTR-2B एक लॉक मासिक स्नैपशॉट है — कोई लाइव फीड नहीं।',
];

// Rough expectation used only to pace the animated %. The real result drives
// the actual floor; this just keeps the number moving between checkpoints.
const EST_MS_PER_INVOICE = 26000;
const COLD_BUFFER_MS = 8000;

export default function ProcessingScreen() {
  const { lang } = useI18n();
  const session = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const tipFade = useRef(new Animated.Value(1)).current;
  // Guard: ensure startProcessing is called exactly once per screen mount.
  const hasStarted = useRef(false);

  const [pct, setPct] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Latest progress, read inside the ticker without re-subscribing the interval.
  const startedAt = useRef(Date.now());
  const progressRef = useRef(session.processingProgress);
  progressRef.current = session.processingProgress;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [spin, pulse]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    // Always navigate to Results, even if processing throws — otherwise an
    // unexpected error would leave the user stranded on this screen forever.
    session
      .startProcessing()
      .catch((err) => console.warn('startProcessing failed, navigating anyway:', err))
      .finally(() => navigation.replace('Results'));
  }, []); // Empty dep array is intentional: we want mount-only semantics.

  // Smoothly travel the percentage: an eased time-based curve (asymptotes to
  // ~95%) lifted by the real completed-invoice floor, clamped monotonic.
  useEffect(() => {
    const id = setInterval(() => {
      const { current, total } = progressRef.current;
      const elapsed = Date.now() - startedAt.current;
      const expected = (total > 0 ? total : 1) * EST_MS_PER_INVOICE + COLD_BUFFER_MS;
      const tau = expected / 3;
      const timed = 95 * (1 - Math.exp(-elapsed / tau));
      const realFloor = total > 0 ? (current / total) * 100 : 0;
      const next = Math.min(100, Math.max(Math.min(timed, 95), realFloor));
      setPct((prev) => (next > prev ? next : prev)); // never go backwards
    }, 60);
    return () => clearInterval(id);
  }, []);

  // Rotate the tip every few seconds with a cross-fade.
  useEffect(() => {
    const tips = lang === 'hi' ? TIPS_HI : TIPS_EN;
    const id = setInterval(() => {
      Animated.timing(tipFade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setTipIndex((i) => (i + 1) % tips.length);
        Animated.timing(tipFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4500);
    return () => clearInterval(id);
  }, [lang, tipFade]);

  const messages = lang === 'hi' ? STATUS_HI : STATUS_EN;
  const tips = lang === 'hi' ? TIPS_HI : TIPS_EN;
  const display = Math.round(pct);
  const msgIndex = Math.min(Math.floor((pct / 100) * messages.length), messages.length - 1);
  const { current, total } = session.processingProgress;
  const scanning = Math.min(current + 1, total);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        {/* Spinning ring + pulsing icon */}
        <View style={styles.ringWrap}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          <Animated.View style={[styles.iconCard, { transform: [{ scale: pulse }] }]}>
            <ScanSearch size={40} color={colors.primary} />
          </Animated.View>
        </View>

        <Text style={styles.percent}>{display}%</Text>
        <Text style={styles.status}>{messages[msgIndex]}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${display}%` }]} />
        </View>
        {total > 0 && (
          <Text style={styles.count}>
            {lang === 'hi'
              ? `Invoice ${scanning} / ${total} स्कैन हो रही है`
              : `Scanning invoice ${scanning} of ${total}`}
          </Text>
        )}

        {/* Rotating GST tip — keeps the screen alive during the wait */}
        <Animated.View style={[styles.tipCard, { opacity: tipFade }]}>
          <View style={styles.tipHeader}>
            <Lightbulb size={15} color={colors.primary} />
            <Text style={styles.tipLabel}>{lang === 'hi' ? 'जानकारी' : 'Did you know'}</Text>
          </View>
          <Text style={styles.tipText}>{tips[tipIndex]}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  ringWrap: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  ring: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4,
    borderColor: colors.border,
    borderTopColor: colors.primary,
  },
  iconCard: {
    width: 90, height: 90, borderRadius: 26,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  percent: { fontSize: 44, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  status: { ...typography.heading2, color: colors.ink, textAlign: 'center' },
  progressBar: {
    width: '80%', height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden', marginTop: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  count: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.xs },
  tipCard: {
    marginTop: spacing.xl,
    width: '90%',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.card,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tipLabel: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipText: { ...typography.body, color: colors.inkSecondary, lineHeight: 21 },
});
