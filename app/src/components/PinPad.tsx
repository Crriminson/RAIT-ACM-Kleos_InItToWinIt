import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Delete } from 'lucide-react-native';
import { Text } from './AppText';
import { colors, typography, spacing } from '../theme/tokens';
import { useI18n } from '../i18n/context';

interface Props {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  error?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PinPad({ value, onChange, maxLength = 4, error }: Props) {
  const { t } = useI18n();
  const press = (k: string) => {
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (k !== '' && value.length < maxLength) {
      onChange(value + k);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Dots */}
      <View
        style={styles.dots}
        accessibilityRole="text"
        accessibilityLabel={`${value.length} / ${maxLength}`}
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            importantForAccessibility="no"
            style={[
              styles.dot,
              i < value.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.key, k === '' && styles.keyEmpty]}
            activeOpacity={k === '' ? 1 : 0.6}
            disabled={k === ''}
            onPress={() => press(k)}
            accessibilityRole={k === '' ? 'none' : 'button'}
            accessibilityElementsHidden={k === ''}
            importantForAccessibility={k === '' ? 'no-hide-descendants' : 'yes'}
            accessibilityLabel={
              k === 'del' ? t.a11y.pinDelete : k === '' ? undefined : t.a11y.pinDigit.replace('{{d}}', k)
            }
          >
            {k === 'del' ? (
              <Delete size={24} color={colors.ink} />
            ) : (
              <Text style={styles.keyText}>{k}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xl },
  dots: { flexDirection: 'row', gap: spacing.md },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.border, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotError: { borderColor: colors.severity.blocked },
  grid: { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  key: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  keyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { ...typography.heading1, color: colors.ink, fontSize: 28 },
});
