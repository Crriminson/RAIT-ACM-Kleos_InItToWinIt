import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '../components/AppText';
import { ShieldCheck } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '../theme/tokens';
import { useI18n } from '../i18n/context';
import { useProfile, isValidGstin } from '../data/contexts/profile-context';
import { RootStackParamList } from '../navigation/types';
import GradientButton from '../components/GradientButton';

export default function GstinSetupScreen() {
  const { t } = useI18n();
  const { profile, saveProfile } = useProfile();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GstinSetup'>>();
  const mode = route.params?.mode ?? 'onboarding';

  const [gstin, setGstin] = useState(profile?.gstin ?? '');
  const [shopName, setShopName] = useState(profile?.shopName ?? '');
  const [turnover, setTurnover] = useState<number | null>(profile?.turnover ?? null);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const TURNOVER_OPTIONS = [
    { label: t.onboarding.turnover1, value: 10000000 },
    { label: t.onboarding.turnover2, value: 30000000 },
    { label: t.onboarding.turnover3, value: 45000000 },
    { label: t.onboarding.turnover4, value: 60000000 },
  ];

  const finish = () => {
    if (mode === 'edit') {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  const handleSave = async () => {
    const normalized = gstin.trim().toUpperCase();
    if (!isValidGstin(normalized)) {
      setError(t.onboarding.invalidGstin);
      return;
    }
    await saveProfile({
      gstin: normalized,
      shopName: shopName.trim(),
      turnover: turnover,
    });
    finish();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconRing}>
            <ShieldCheck size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>{t.onboarding.title}</Text>
          <Text style={styles.subtitle}>{t.onboarding.subtitle}</Text>

          <Text style={styles.fieldLabel}>{t.onboarding.gstinLabel}</Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'gstin' && styles.inputFocused,
              error && styles.inputError,
            ]}
            value={gstin}
            onChangeText={(v) => {
              setGstin(v.toUpperCase());
              if (error) setError(null);
            }}
            placeholder={t.onboarding.gstinPlaceholder}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={15}
            onFocus={() => setFocusedField('gstin')}
            onBlur={() => setFocusedField(null)}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            {t.onboarding.shopLabel}
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === 'shop' && styles.inputFocused,
            ]}
            value={shopName}
            onChangeText={setShopName}
            placeholder={t.onboarding.shopPlaceholder}
            placeholderTextColor={colors.inkMuted}
            onFocus={() => setFocusedField('shop')}
            onBlur={() => setFocusedField(null)}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            {t.onboarding.turnoverLabel}
          </Text>
          <View style={styles.segmentedControl}>
            {TURNOVER_OPTIONS.map((opt) => {
              const isSelected = turnover === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segment, isSelected && styles.segmentSelected]}
                  onPress={() => setTurnover(opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <GradientButton label={t.onboarding.save} onPress={handleSave} />
          {mode === 'onboarding' && (
            <TouchableOpacity style={styles.skip} onPress={finish}>
              <Text style={styles.skipText}>{t.onboarding.skip}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.screenH,
    paddingTop: spacing.xl,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading1,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.inkSecondary,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.inkSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.severity.blocked,
  },
  errorText: {
    ...typography.caption,
    color: colors.severity.blocked,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.screenH,
    gap: spacing.sm,
  },
  segmentedControl: {
    gap: spacing.xs,
  },
  segment: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.button,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.primary,
  },
  segmentText: {
    ...typography.body,
    color: colors.inkSecondary,
  },
  segmentTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  skip: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.body,
    color: colors.inkMuted,
  },
});
