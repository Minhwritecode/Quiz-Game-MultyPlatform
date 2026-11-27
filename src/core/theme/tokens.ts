import { Platform } from 'react-native';

/**
 * Papyrus "Warm Paper & Egyptian Ink" Design Tokens
 * Designed for calm, glare-free long-form study and high readability (WCAG AA+).
 */
export const colors = {
  ink: '#181C25',
  inkMuted: '#575E6E',
  paper: '#F2ECDC',
  paperRaised: '#FFFDF8',
  paperMuted: '#DDD2B7',
  paperSoft: '#EAE1CB',

  // Primary Brand: Egyptian Lapis Blue (preserving existing `indigo` token key across app)
  indigo: '#1C3F94',
  indigoDeep: '#10265C',
  indigoTint: '#E4EBF9',
  indigoBorder: '#B8C8EB',
  onPrimary: '#FFFFFF',

  // Accent (used sparingly <=10%): Warm Amber Gold
  gold: '#9A5804',
  goldTint: '#FAF0DC',
  goldBorder: '#DFC18A',
  onGold: '#FFFFFF',

  // Semantic Correct / Success
  mint: '#15803D',
  mintTint: '#E3F5EA',
  mintBorder: '#9EDBB6',
  onMint: '#FFFFFF',

  // Semantic Error / Danger
  danger: '#B91C1C',
  dangerTint: '#FCE8E8',
  dangerBorder: '#EEB4B1',

  // Semantic Streak / Fire
  fire: '#C2410C',
  fireTint: '#FFF0E5',
  fireBorder: '#F7C29E',

  // Dark Mode Ink & Paper Surfaces
  night: '#0E121B',
  nightSurface: '#191F2E',
  nightRaised: '#232A3D',
  nightMuted: '#2E3750',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radii = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#181C25', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 2 },
    default: { boxShadow: '0 3px 12px -2px rgba(24, 28, 37, 0.08), 0 1px 0 rgba(154, 88, 4, 0.07)' },
  }),
  raised: Platform.select({
    ios: { shadowColor: '#181C25', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 3 },
    default: { boxShadow: '0 8px 24px -4px rgba(24, 28, 37, 0.11)' },
  }),
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 22, lineHeight: 29, fontWeight: '800' as const, letterSpacing: -0.35 },
  title: { fontSize: 16.5, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  label: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' as const, letterSpacing: 0.7 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
} as const;

export type ThemeMode = 'light' | 'dark';
export type Palette = { [Key in keyof typeof colors]: string };

export const palettes: Record<ThemeMode, Palette> = {
  light: colors,
  dark: {
    ...colors,
    ink: '#F3EFE0',
    inkMuted: '#9CA3B5',
    paper: colors.night,
    paperRaised: colors.nightSurface,
    paperMuted: colors.nightMuted,
    paperSoft: colors.nightRaised,

    indigo: '#7BA4FF',
    indigoDeep: '#DCE6FF',
    indigoTint: '#1D2847',
    indigoBorder: '#34477A',
    onPrimary: '#0D1B3E',

    gold: '#F5B73B',
    goldTint: '#34260B',
    goldBorder: '#705014',
    onGold: '#221604',

    mint: '#34D399',
    mintTint: '#0D3326',
    mintBorder: '#1E6148',
    onMint: '#08271C',

    danger: '#F87171',
    dangerTint: '#3B1519',
    dangerBorder: '#7A2730',

    fire: '#FB923C',
    fireTint: '#381B09',
    fireBorder: '#7A3B14',
  },
};
