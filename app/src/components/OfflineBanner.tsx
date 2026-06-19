import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { Text } from './AppText';
import { useI18n } from '../i18n/context';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { colors, typography, spacing } from '../theme/tokens';

/**
 * Slim, non-blocking banner pinned below the status bar. Appears only when the
 * AI backend is unreachable, so the trader understands why OCR/AI features are
 * paused instead of silently getting fallback data. Tapping it re-probes.
 */
export default function OfflineBanner() {
  const { t } = useI18n();
  const { online, checking, recheck } = useBackendHealth();

  // Hide until we've confirmed the server is actually unreachable.
  if (online !== false) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.85}
        onPress={recheck}
        accessibilityRole="button"
        accessibilityLabel={`${t.errors.offlineTitle}. ${t.errors.offlineBody}`}
        accessibilityHint={t.a11y.retryConnection}
      >
        <WifiOff size={16} color="#FFFFFF" />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t.errors.offlineTitle}</Text>
          <Text style={styles.body} numberOfLines={1}>{t.errors.offlineBody}</Text>
        </View>
        {checking ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.retry}>{t.errors.offlineRetry}</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.severity.blocked,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: 12,
  },
  textWrap: { flex: 1 },
  title: { ...typography.label, color: '#FFFFFF', fontWeight: '700' },
  body: { ...typography.caption, color: 'rgba(255,255,255,0.9)' },
  retry: {
    ...typography.label,
    color: '#FFFFFF',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
