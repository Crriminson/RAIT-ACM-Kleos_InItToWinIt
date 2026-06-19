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

function labelColorFor(variant: 'brand' | 'blocked') {
  return variant === 'blocked' ? colors.severity.blockedDark : '#FFFFFF';
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
      <View
        style={[styles.button, styles.disabled, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: true }}
      >
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
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        {icon}
        <Text style={[styles.label, { color: labelColorFor(variant) }]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.full,
    ...elevation.primary,
  },
  button: {
    height: 56,
    borderRadius: radii.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    backgroundColor: colors.accentMuted,
    height: 56,
    borderRadius: radii.full,
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
