import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../components/AppText';
import { IndianRupee } from 'lucide-react-native';
import { colors, typography, spacing } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useSession } from '../data/contexts/session-context';
import DiagnosisScreen from './DiagnosisScreen';

export default function ReportsScreen() {
  const { t, lang } = useI18n();
  const session = useSession();

  if (session.phase !== 'results' || session.results.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.iconCircle}>
          <IndianRupee size={44} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>{t.diagnosis.title}</Text>
        <Text style={styles.emptyText}>
          {lang === 'hi'
            ? 'GSTR-2B और invoices अपलोड करें — आपकी ITC जाँच यहाँ दिखेगी।'
            : 'Upload your GSTR-2B and invoices to see your ITC diagnosis here.'}
        </Text>
      </View>
    );
  }

  return <DiagnosisScreen />;
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.recognitionBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...typography.heading1, color: colors.ink },
  emptyText: { ...typography.body, color: colors.inkMuted, textAlign: 'center' },
});
