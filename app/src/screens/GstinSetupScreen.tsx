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
  const [error, setError] = useState<string | null>(null);

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
    await saveProfile({ gstin: normalized, shopName: shopName.trim() });
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
            style={[styles.input, error && styles.inputError]}
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
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
            {t.onboarding.shopLabel}
          </Text>
          <TextInput
            style={styles.input}
            value={shopName}
            onChangeText={setShopName}
            placeholder={t.onboarding.shopPlaceholder}
            placeholderTextColor={colors.inkMuted}
          />
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.recognitionBg,
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
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
  cta: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radii.button,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    ...typography.label,
    color: colors.surface,
    fontSize: 15,
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
