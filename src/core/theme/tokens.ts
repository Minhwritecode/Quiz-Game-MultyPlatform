import { Platform } from 'react-native';

export const colors = {
  ink: '#0F172A',
  inkMuted: '#475569',
  paper: '#F6F7FB',
  paperRaised: '#FFFFFF',
  paperMuted: '#E2E8F0',
  indigo: '#4F46E5',
  indigoDeep: '#3730A3',
  indigoTint: '#EEF2FF',
  indigoBorder: '#6366F1',
  gold: '#D97706',
  goldTint: '#FEF3C7',
  goldBorder: '#D97706',
  mint: '#059669',
  mintTint: '#D1FAE5',
  mintBorder: '#059669',
  danger: '#DC2626',
  dangerTint: '#FEE2E2',
  dangerBorder: '#DC2626',
  fire: '#EA580C',
  fireTint: '#FFEDD5',
  fireBorder: '#EA580C',
  night: '#060A24',
  nightSurface: '#0E1538',
  nightRaised: '#16204A',
  nightMuted: '#243063',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radii = { sm: 12, md: 18, lg: 24, pill: 999 } as const;
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#060A24', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 3 },
    default: { boxShadow: '0 6px 20px -2px rgba(6, 10, 36, 0.08)' },
  }),
  raised: Platform.select({
    ios: { shadowColor: '#4F46E5', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 6 },
    default: { boxShadow: '0 12px 28px -6px rgba(79, 70, 229, 0.22)' },
  }),
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.6 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.4 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  label: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 0.8 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
} as const;

export type ThemeMode = 'light' | 'dark';
export type Palette = { [Key in keyof typeof colors]: string };

export const palettes: Record<ThemeMode, Palette> = {
  light: colors,
  dark: {
    ...colors,
    ink: '#F8FAFC',
    inkMuted: '#94A3B8',
    paper: colors.night,
    paperRaised: colors.nightSurface,
    paperMuted: colors.nightMuted,
    indigo: '#6366F1',
    indigoDeep: '#E0E7FF',
    indigoTint: '#1B2252',
    indigoBorder: '#6366F1',
    gold: '#F59E0B',
    goldTint: '#3B2308',
    goldBorder: '#D97706',
    mint: '#10B981',
    mintTint: '#063D2F',
    mintBorder: '#10B981',
    danger: '#F87171',
    dangerTint: '#3F1219',
    dangerBorder: '#DC2626',
    fire: '#FB923C',
    fireTint: '#3E1A08',
    fireBorder: '#EA580C',
  },
};
