import { Platform } from 'react-native';

export const colors = {
  ink: '#0F172A',
  inkMuted: '#64748B',
  paper: '#F8FAFC',
  paperRaised: '#FFFFFF',
  paperMuted: '#E2E8F0',
  indigo: '#4F46E5',
  indigoDeep: '#3730A3',
  indigoTint: '#EEF2FF',
  indigoBorder: '#3730A3',
  gold: '#D97706',
  goldTint: '#FEF3C7',
  goldBorder: '#B45309',
  mint: '#059669',
  mintTint: '#D1FAE5',
  mintBorder: '#047857',
  danger: '#DC2626',
  dangerTint: '#FEE2E2',
  dangerBorder: '#B91C1C',
  fire: '#EA580C',
  fireTint: '#FFEDD5',
  fireBorder: '#C2410C',
  night: '#0B0F19',
  nightSurface: '#151D2F',
  nightRaised: '#1E293B',
  nightMuted: '#334155',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radii = { sm: 14, md: 20, lg: 28, pill: 999 } as const;
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 4px 14px 0 rgba(15, 23, 42, 0.05)' },
  }),
  raised: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 4 },
    default: { boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)' },
  }),
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.3 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 0.8 },
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
    paperMuted: colors.nightRaised,
    indigoTint: '#1E1B4B',
    indigoBorder: '#4338CA',
    goldTint: '#451A03',
    goldBorder: '#92400E',
    mintTint: '#064E3B',
    mintBorder: '#065F46',
    dangerTint: '#450A0A',
    dangerBorder: '#991B1B',
    fireTint: '#431407',
    fireBorder: '#9A3412',
  },
};
