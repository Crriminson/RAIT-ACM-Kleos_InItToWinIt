import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text } from '../components/AppText';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanSearch, IndianRupee, ArrowRight } from 'lucide-react-native';
import { colors, typography, spacing, radii, gradients, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useProfile } from '../data/contexts/profile-context';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }: Props) {
  const { t, toggle } = useI18n();
  const { profile } = useProfile();

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const iconScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [fade, rise, iconScale]);

  const handleStart = () => {
    if (profile) navigation.replace('Main');
    else navigation.replace('GstinSetup', { mode: 'onboarding' });
  };

  return (
    <LinearGradient colors={gradients.splash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      {/* Decorative floating circles */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <View style={styles.iconCard}>
              <ScanSearch size={44} color={colors.surface} />
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
            <Text style={styles.brand}>CA IN YOUR POCKET</Text>
            <Text style={styles.headline}>{t.splash.headline}</Text>
            <Text style={styles.subheadline}>{t.splash.subheadline}</Text>

            {/* Value chip */}
            <View style={styles.valueChip}>
              <IndianRupee size={16} color="#FFD23F" />
              <Text style={styles.valueChipText}>
                {t.splash.headline === 'अपना GST खुद समझें'
                  ? 'हर महीने ₹हज़ारों की ITC बचाएं'
                  : 'Save thousands in ITC every month'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.bottom, { opacity: fade }]}>
          <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={handleStart}>
            <Text style={styles.ctaText}>{t.splash.cta}</Text>
            <ArrowRight size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggle} style={styles.langToggle}>
            <Text style={styles.langToggleText}>{t.splash.switchLang}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.screenH },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  blob1: { width: width * 0.9, height: width * 0.9, top: -width * 0.35, right: -width * 0.3 },
  blob2: { width: width * 0.7, height: width * 0.7, bottom: -width * 0.2, left: -width * 0.25 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCard: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brand: {
    ...typography.label,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.surface,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: spacing.sm,
  },
  subheadline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.badge,
  },
  valueChipText: {
    ...typography.label,
    color: colors.surface,
    fontWeight: '600',
  },
  bottom: { paddingBottom: spacing.lg, gap: spacing.sm },
  cta: {
    backgroundColor: colors.surface,
    height: 56,
    borderRadius: radii.button,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    ...elevation.modal,
  },
  ctaText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  langToggle: { alignItems: 'center', paddingVertical: spacing.sm },
  langToggleText: { ...typography.body, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
});
