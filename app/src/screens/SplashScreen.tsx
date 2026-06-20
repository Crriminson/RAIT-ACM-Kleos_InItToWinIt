import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text } from '../components/AppText';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IndianRupee, ArrowRight, HelpCircle, Globe } from 'lucide-react-native';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { Language } from '../i18n/strings';
import { useProfile } from '../data/contexts/profile-context';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }: Props) {
  const { t, lang, setLang, toggle } = useI18n();
  const { profile } = useProfile();

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const handleStart = () => {
    if (profile) navigation.replace('Main');
    else navigation.replace('GstinSetup', { mode: 'onboarding' });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
            <Text style={styles.brand}>CA IN YOUR POCKET</Text>

            <Text style={styles.headline}>{t.splash.headline}</Text>

            <Text style={styles.subheadline}>{t.splash.subheadline}</Text>

            {/* Value chip */}
            <View style={styles.valueChip}>
              <IndianRupee size={16} color={colors.primary} />
              <Text style={styles.valueChipText}>
                {lang === 'hi'
                  ? 'हर महीने ₹हज़ारों की ITC बचाएं'
                  : lang === 'mr'
                    ? 'दर महिन्याला ₹हजारो ITC वाचवा'
                    : 'Save thousands in ITC every month'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.bottom, { opacity: fade }]}>
          <TouchableOpacity
            style={styles.cta}
            activeOpacity={0.85}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={t.splash.cta}
          >
            <Text style={styles.ctaText}>{t.splash.cta}</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newUserCta}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('OnboardingWalkthrough')}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.newUser}
          >
            <HelpCircle size={16} color={colors.primary} />
            <Text style={styles.newUserText}>{t.splash.newUserCta}</Text>
          </TouchableOpacity>

          <View style={styles.langPillRow}>
            <Globe size={14} color={colors.inkMuted} />
            {([['hi', 'हिंदी'], ['en', 'English'], ['mr', 'मराठी']] as [Language, string][]).map(([code, label]) => (
              <TouchableOpacity
                key={code}
                onPress={() => setLang(code)}
                style={[styles.langPill, lang === code && styles.langPillActive]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={[styles.langPillText, lang === code && styles.langPillTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    paddingHorizontal: spacing.screenH,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    ...typography.label,
    color: colors.primary,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  headline: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    lineHeight: 52,
    marginBottom: spacing.sm,
  },
  subheadline: {
    ...typography.body,
    color: colors.inkSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.badge,
  },
  valueChipText: {
    ...typography.label,
    color: colors.ink,
    fontWeight: '600',
  },
  bottom: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  cta: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 9999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation.primary,
  },
  ctaText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  newUserCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  newUserText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  langPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  langPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkMuted,
  },
  langPillTextActive: {
    color: '#FFFFFF',
  },
});
