import { Platform } from 'react-native';

export const colors = {
  ink: '#1B2333',
  inkMuted: '#667085',
  paper: '#F7F4EE',
  paperRaised: '#FFFCF7',
  paperMuted: '#ECE8DF',
  indigo: '#4B5FDB',
  indigoDeep: '#3442A8',
  indigoTint: '#E9EBFF',
  gold: '#B87918',
  goldTint: '#FFF0D1',
  mint: '#267A66',
  mintTint: '#DDF3EC',
  danger: '#B34747',
  dangerTint: '#F9E3E1',
  night: '#111827',
  nightSurface: '#192235',
  nightRaised: '#222E43',
  nightMuted: '#2B3952',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radii = { sm: 12, md: 18, lg: 28, pill: 999 } as const;
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 3 },
    default: {},
  }),
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '800' as const },
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
    inkMuted: '#B7C0D4',
    paper: colors.night,
    paperRaised: colors.nightSurface,
    paperMuted: colors.nightRaised,
    indigoTint: '#2B3576',
    goldTint: '#4A3518',
    mintTint: '#1F493F',
    dangerTint: '#522D32',
  },
};
