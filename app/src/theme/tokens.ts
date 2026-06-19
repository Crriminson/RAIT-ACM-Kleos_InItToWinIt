export const colors = {
  primary: '#045EFE',
  primaryDark: '#0341B8',
  primaryDeep: '#022A78',
  surface: '#FFFFFF',
  ink: '#0A0A0A',
  inkSecondary: '#444444',
  inkMuted: '#888888',
  border: '#E8EAEF',
  background: '#F4F6FA',

  severity: {
    blocked: '#D32F2F',
    blockedDark: '#A11616',
    blockedBg: '#FFF0F0',
    pending: '#E65100',
    pendingDark: '#B23D00',
    pendingBg: '#FFF8F0',
    resolved: '#2E7D32',
    resolvedDark: '#1B5E20',
    resolvedBg: '#F0FFF1',
  },

  recognitionBg: '#EBF2FF',
  unrecognisedBg: '#FFF8F0',
} as const;

// Font families per weight. AppText maps fontWeight → the right family,
// and swaps Inter → Noto Sans Devanagari for Hindi (Devanagari) strings.
export const fonts = {
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
  },
  devanagari: {
    regular: 'NotoSansDevanagari_400Regular',
    medium: 'NotoSansDevanagari_500Medium',
    semibold: 'NotoSansDevanagari_600SemiBold',
    bold: 'NotoSansDevanagari_700Bold',
    extrabold: 'NotoSansDevanagari_700Bold',
  },
} as const;

export type FontWeightKey = keyof typeof fonts.inter;

// Gradient color stops — consumed by expo-linear-gradient `colors` prop.
export const gradients = {
  brand: ['#0A6BFF', '#045EFE', '#0341B8'] as const,
  brandSoft: ['#1E78FF', '#045EFE'] as const,
  blocked: ['#E8453C', '#D32F2F', '#A11616'] as const,
  pending: ['#F57C2E', '#E65100', '#B23D00'] as const,
  resolved: ['#3DA042', '#2E7D32', '#1B5E20'] as const,
  splash: ['#0A6BFF', '#0450E0', '#022A78'] as const,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  heading1: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  heading2: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screenH: 20,
} as const;

export const radii = {
  card: 16,
  button: 12,
  badge: 20,
  input: 12,
  thumbnail: 8,
} as const;

export const elevation = {
  soft: {
    shadowColor: '#1A2B4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: '#1A2B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  modal: {
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  fab: {
    shadowColor: '#045EFE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#045EFE',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;
