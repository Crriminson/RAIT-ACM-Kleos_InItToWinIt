export const colors = {
  primary: '#E8432A',
  primaryDark: '#C93820',
  primaryDeep: '#A12A15',
  surface: '#FDF9F3', // card
  surfaceRaised: '#FDF9F3', // card
  background: '#FAF6EE',
  ink: '#221E1A', // foreground
  inkSecondary: '#4A3F35', // secondary-foreground
  inkMuted: '#7A6E63', // muted-foreground
  border: '#E2D9CC',
  borderHover: '#D1C4B2',
  accentMuted: '#EDE7DA', // muted
  
  // Scrim behind bottom sheets / modals.
  overlay: 'rgba(34, 30, 26, 0.5)',

  severity: {
    blocked: '#7A2419',
    blockedDark: '#5E1B12',
    blockedBg: '#F5E2DC',
    pending: '#6B4020',
    pendingDark: '#4A2C15',
    pendingBg: '#F5EBD8',
    resolved: '#2A5C32',
    resolvedDark: '#1E4224',
    resolvedBg: '#E3EFDF',
  },

  recognitionBg: '#D4E4D8', // sage-blob
  unrecognisedBg: '#F5EBD8', // hold-bg
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
  brand: ['#E8432A', '#C93820'] as const,
  brandSoft: ['#F26751', '#E8432A'] as const,
  blocked: ['#E0B0A5', '#F5E2DC'] as const,
  pending: ['#E0C99A', '#F5EBD8'] as const,
  resolved: ['#B5D4B9', '#E3EFDF'] as const,
  splash: ['#FAF6EE', '#F0EAE0', '#EDE7DA'] as const,
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
  card: 16, // radius-2xl
  button: 12, // radius-xl
  badge: 20,
  input: 12,
  thumbnail: 8,
  md: 12,
  full: 9999,
} as const;

export const elevation = {
  soft: {
    shadowColor: '#221E1A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  card: {
    shadowColor: '#221E1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modal: {
    shadowColor: '#221E1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  fab: {
    shadowColor: '#E8432A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  primary: {
    shadowColor: '#E8432A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
