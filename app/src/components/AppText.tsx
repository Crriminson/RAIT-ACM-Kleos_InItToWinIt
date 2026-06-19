import React, { useMemo } from 'react';
import { Text as RNText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { fonts, FontWeightKey } from '../theme/tokens';

const DEVANAGARI = /[ऀ-ॿ]/;

function weightKeyFromStyle(style: TextStyle | undefined): FontWeightKey {
  const family = typeof style?.fontFamily === 'string' ? style.fontFamily : '';
  if (family) {
    if (family.includes('ExtraBold') || family.includes('800')) return 'extrabold';
    if (family.includes('Bold') || family.includes('700')) return 'bold';
    if (family.includes('SemiBold') || family.includes('600')) return 'semibold';
    if (family.includes('Medium') || family.includes('500')) return 'medium';
    return 'regular';
  }
  const w = String(style?.fontWeight ?? '400');
  if (w === '800' || w === '900') return 'extrabold';
  if (w === '700' || w === 'bold') return 'bold';
  if (w === '600') return 'semibold';
  if (w === '500') return 'medium';
  return 'regular';
}

function containsDevanagari(children: React.ReactNode): boolean {
  if (typeof children === 'string') return DEVANAGARI.test(children);
  if (typeof children === 'number') return false;
  if (Array.isArray(children)) {
    return children.some((c) => typeof c === 'string' && DEVANAGARI.test(c));
  }
  return false;
}

/**
 * Drop-in replacement for react-native's Text that applies the project's
 * typeface system: Inter for Latin, Noto Sans Devanagari for Hindi, at the
 * weight implied by the style's fontWeight (or Inter fontFamily).
 */
export function Text({ style, children, ...rest }: TextProps) {
  const family = useMemo(() => {
    const flat = StyleSheet.flatten(style) as TextStyle | undefined;
    const key = weightKeyFromStyle(flat);
    return containsDevanagari(children) ? fonts.devanagari[key] : fonts.inter[key];
  }, [style, children]);

  return (
    <RNText {...rest} style={[style, { fontFamily: family, fontWeight: 'normal' }]}>
      {children}
    </RNText>
  );
}

export default Text;
