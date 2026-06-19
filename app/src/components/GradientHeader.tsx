import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, elevation, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';

type Variant = 'brand' | 'blocked' | 'pending' | 'resolved';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: Variant;
  right?: React.ReactNode;
}

function gradientFor(variant: Variant) {
  switch (variant) {
    case 'blocked': return gradients.blocked;
    case 'pending': return gradients.pending;
    case 'resolved': return gradients.resolved;
    default: return gradients.brand;
  }
}

function textColorFor(variant: Variant) {
  switch (variant) {
    case 'blocked': return colors.severity.blockedDark;
    case 'pending': return colors.severity.pendingDark;
    case 'resolved': return colors.severity.resolvedDark;
    default: return colors.surface;
  }
}

export default function GradientHeader({ title, subtitle, onBack, variant = 'brand', right }: Props) {
  const { t } = useI18n();
  const fg = textColorFor(variant);
  return (
    <LinearGradient
      colors={gradientFor(variant)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.row}>
          {onBack ? (
            <TouchableOpacity
              style={[styles.backButton, variant !== 'brand' && { backgroundColor: 'rgba(0,0,0,0.08)' }]}
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.a11y.back}
            >
              <ChevronLeft size={24} color={fg} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: fg }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, variant !== 'brand' && { color: fg, opacity: 0.7 }]} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {right ?? <View style={styles.backSpacer} />}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...elevation.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backSpacer: { width: 40, height: 40 },
  titleBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: colors.surface, letterSpacing: -0.2 },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
});
