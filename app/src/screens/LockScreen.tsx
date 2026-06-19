import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Fingerprint } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, gradients } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useLock } from '../data/contexts/lock-context';
import PinPad from '../components/PinPad';

export default function LockScreen() {
  const { t } = useI18n();
  const { verifyAndUnlock, tryBiometric, biometricEnabled, biometricAvailable } = useLock();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (biometricEnabled && biometricAvailable) {
      tryBiometric();
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      verifyAndUnlock(pin).then((ok) => {
        if (!ok) {
          setError(true);
          setTimeout(() => {
            setError(false);
            setPin('');
          }, 700);
        }
      });
    }
  }, [pin]);

  return (
    <LinearGradient colors={gradients.splash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.iconCard}>
            <ShieldCheck size={36} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t.lock.title}</Text>
          <Text style={styles.sub}>{error ? t.lock.wrongPin : t.lock.enterPin}</Text>
        </View>

        <View style={styles.padWrap}>
          <PinPad value={pin} onChange={setPin} error={error} />
        </View>

        {biometricEnabled && biometricAvailable ? (
          <TouchableOpacity style={styles.bioButton} onPress={tryBiometric} activeOpacity={0.8}>
            <Fingerprint size={20} color={colors.primary} />
            <Text style={styles.bioText}>{t.lock.useBiometric}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bioSpacer} />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl, paddingHorizontal: spacing.screenH },
  top: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  iconCard: {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: colors.accentMuted,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  sub: { ...typography.body, color: colors.inkSecondary },
  padWrap: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  bioButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  bioText: { ...typography.label, color: colors.primary, fontWeight: '600' },
  bioSpacer: { height: 48 },
});
