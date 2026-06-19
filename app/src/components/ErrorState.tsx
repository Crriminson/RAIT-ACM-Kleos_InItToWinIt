import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { Text } from './AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';

interface Props {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}

/**
 * Full-screen, friendly degradation UI. Used by the app-wide ErrorBoundary and
 * available to any screen that needs a "couldn't load / something broke" state.
 * Deliberately self-contained (no app contexts beyond what the caller passes) so
 * it can render even when something upstream has failed.
 */
export default function ErrorState({ title, message, retryLabel, onRetry, icon }: Props) {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.content} accessible accessibilityRole="alert">
          <View style={styles.iconCircle}>
            {icon ?? <AlertTriangle size={40} color={colors.warning} strokeWidth={2} />}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {onRetry && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetry}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={retryLabel}
            >
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>{retryLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: spacing.screenH },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.severity.pendingBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.lg,
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...elevation.primary,
  },
  retryText: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
