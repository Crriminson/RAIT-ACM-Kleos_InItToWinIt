import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShieldCheck, Fingerprint } from 'lucide-react-native';
import { Text } from '../components/AppText';
import { colors, typography, spacing, radii, elevation } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useLock } from '../data/contexts/lock-context';
import { confirmAction } from '../utils/dialog';
import GradientHeader from '../components/GradientHeader';
import PinPad from '../components/PinPad';

type Step = 'idle' | 'set' | 'confirm';

export default function LockSetupScreen() {
  const { t } = useI18n();
  const lock = useLock();
  const navigation = useNavigation();

  const [step, setStep] = useState<Step>('idle');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [wantBiometric, setWantBiometric] = useState(lock.biometricAvailable);

  const handlePinChange = (next: string) => {
    setPin(next);
    if (next.length === 4) {
      if (step === 'set') {
        setFirstPin(next);
        setPin('');
        setStep('confirm');
      } else if (step === 'confirm') {
        if (next === firstPin) {
          lock.enableLock(next, wantBiometric && lock.biometricAvailable).then(() => {
            setStep('idle');
            setPin('');
            setFirstPin('');
          });
        } else {
          setError(true);
          setTimeout(() => {
            setError(false);
            setPin('');
            setFirstPin('');
            setStep('set');
          }, 800);
        }
      }
    }
  };

  const handleDisable = () => {
    confirmAction(t.lock.disable, t.lock.appLockSub, () => lock.disableLock(), {
      confirmLabel: t.lock.disable,
      destructive: true,
    });
  };

  if (step !== 'idle') {
    return (
      <View style={styles.root}>
        <GradientHeader title={t.lock.setupTitle} onBack={() => { setStep('idle'); setPin(''); }} />
        <View style={styles.pinSetup}>
          <Text style={styles.pinPrompt}>
            {step === 'set' ? t.lock.setPin : error ? t.lock.pinMismatch : t.lock.confirmPin}
          </Text>
          <PinPad value={pin} onChange={handlePinChange} error={error} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GradientHeader title={t.lock.appLock} onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.iconChip}>
            <ShieldCheck size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{t.lock.appLock}</Text>
          <Text style={styles.heroSub}>{t.lock.appLockSub}</Text>
          <Text style={styles.note}>{t.lock.protectNote}</Text>
        </View>

        {lock.enabled ? (
          <>
            <View style={styles.row}>
              <View style={styles.rowIcon}><Fingerprint size={20} color={colors.primary} /></View>
              <Text style={styles.rowLabel}>{t.lock.biometricToggle}</Text>
              <Switch
                value={lock.biometricEnabled}
                disabled={!lock.biometricAvailable}
                onValueChange={(on) => lock.setBiometricEnabled(on)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            <TouchableOpacity style={styles.disableBtn} onPress={handleDisable} activeOpacity={0.85}>
              <Text style={styles.disableText}>{t.lock.disable}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {lock.biometricAvailable && (
              <View style={styles.row}>
                <View style={styles.rowIcon}><Fingerprint size={20} color={colors.primary} /></View>
                <Text style={styles.rowLabel}>{t.lock.biometricToggle}</Text>
                <Switch
                  value={wantBiometric}
                  onValueChange={setWantBiometric}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                />
              </View>
            )}
            <TouchableOpacity style={styles.enableBtn} onPress={() => setStep('set')} activeOpacity={0.85}>
              <ShieldCheck size={18} color={colors.surface} />
              <Text style={styles.enableText}>{t.lock.enable}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenH },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
    ...elevation.soft,
  },
  iconChip: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.recognitionBg,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  heroTitle: { ...typography.heading1, color: colors.ink },
  heroSub: { ...typography.body, color: colors.inkSecondary, textAlign: 'center', marginTop: spacing.xs },
  note: { ...typography.caption, color: colors.inkMuted, marginTop: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, ...elevation.soft,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.recognitionBg, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { ...typography.bodyBold, color: colors.ink, flex: 1 },
  enableBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radii.button, height: 52, ...elevation.primary,
  },
  enableText: { ...typography.label, color: colors.surface, fontSize: 15, fontWeight: '700' },
  disableBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(211,47,47,0.4)', borderRadius: radii.button, height: 52,
  },
  disableText: { ...typography.label, color: colors.severity.blocked, fontWeight: '600' },
  pinSetup: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.lg },
  pinPrompt: { ...typography.heading2, color: colors.ink, textAlign: 'center' },
});
