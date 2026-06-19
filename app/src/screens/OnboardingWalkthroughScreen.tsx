import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text } from '../components/AppText';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Upload,
  ScanLine,
  ReceiptText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react-native';
import { colors, typography, spacing, radii, elevation, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useProfile } from '../data/contexts/profile-context';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingWalkthrough'>;

// Icons are keyed by step index — copy lives in i18n (t.walkthrough.steps).
const STEP_ICONS = [Upload, ScanLine, ReceiptText, ShieldCheck];

export default function OnboardingWalkthroughScreen({ navigation }: Props) {
  const { t } = useI18n();
  const { profile } = useProfile();
  const steps = t.walkthrough.steps;

  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const isLast = index === steps.length - 1;
  const Icon = STEP_ICONS[index] ?? Upload;
  const step = steps[index];

  // Cross-fade the card content when moving between steps.
  const transitionTo = (nextIndex: number) => {
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setIndex(nextIndex);
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  };

  const finish = () => {
    // Same destination as the splash CTA: returning users go Home, new users set up.
    if (profile) navigation.replace('Main');
    else navigation.replace('GstinSetup', { mode: 'onboarding' });
  };

  const handleNext = () => (isLast ? finish() : transitionTo(index + 1));
  const handleBack = () => index > 0 && transitionTo(index - 1);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar: step counter + skip */}
        <View style={styles.topBar}>
          <Text style={styles.stepLabel}>
            {t.walkthrough.stepLabel
              .replace('{{n}}', String(index + 1))
              .replace('{{total}}', String(steps.length))}
          </Text>
          <TouchableOpacity
            onPress={finish}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t.walkthrough.skip}
          >
            <Text style={styles.skip}>{t.walkthrough.skip}</Text>
          </TouchableOpacity>
        </View>

        {/* Animated step content */}
        <Animated.View
          style={[styles.content, { opacity: fade }]}
          accessible
          accessibilityLabel={`${step.title}. ${step.body}`}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
            importantForAccessibility="no-hide-descendants"
          >
            <Icon size={48} color="#FFFFFF" strokeWidth={2} />
          </LinearGradient>

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        {/* Nav controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.backBtn, index === 0 && styles.backBtnHidden]}
            onPress={handleBack}
            disabled={index === 0}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.walkthrough.back}
            accessibilityElementsHidden={index === 0}
            importantForAccessibility={index === 0 ? 'no-hide-descendants' : 'yes'}
          >
            <ArrowLeft size={20} color={colors.inkSecondary} />
            <Text style={styles.backText}>{t.walkthrough.back}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t.walkthrough.getStarted : t.walkthrough.next}
          >
            <Text style={styles.nextText}>{isLast ? t.walkthrough.getStarted : t.walkthrough.next}</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: spacing.screenH },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  stepLabel: { ...typography.label, color: colors.inkMuted, fontWeight: '600' },
  skip: { ...typography.label, color: colors.primary, fontWeight: '700' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...elevation.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  backBtnHidden: { opacity: 0 },
  backText: { ...typography.label, color: colors.inkSecondary, fontWeight: '600', fontSize: 15 },
  nextBtn: {
    flex: 1,
    maxWidth: 220,
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 9999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation.primary,
  },
  nextText: { ...typography.label, color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
