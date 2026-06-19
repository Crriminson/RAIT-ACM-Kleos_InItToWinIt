import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle, View } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, radii, elevation, gradients, spacing } from '../theme/tokens';

interface Props {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'brand' | 'blocked';
}

export default function GradientButton({
  label,
  onPress,
  disabled,
  icon,
  style,
  variant = 'brand',
}: Props) {
  if (disabled) {
    return (
      <View style={[styles.button, styles.disabled, style]}>
        <Text style={styles.disabledLabel}>{label}</Text>
      </View>
    );
  }

  const gradient = variant === 'blocked' ? gradients.blocked : gradients.brand;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.shadow, style]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        {icon}
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.button,
    ...elevation.primary,
  },
  button: {
    height: 54,
    borderRadius: radii.button,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    backgroundColor: '#E2E6EE',
    height: 54,
    borderRadius: radii.button,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledLabel: {
    ...typography.label,
    color: colors.inkMuted,
    fontSize: 16,
    fontWeight: '700',
  },
});
