import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, palettes, radii, shadows, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';

export type IconName = keyof typeof Ionicons.glyphMap;

export function usePalette() {
  return palettes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function Screen({ children, scroll = true, bottomNav = false, contentStyle }: PropsWithChildren<{ scroll?: boolean; bottomNav?: boolean; contentStyle?: object }>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const inner = <View style={[styles.content, { maxWidth: width >= 900 ? 1180 : 760 }, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.paper }]} edges={['top', 'left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNav ? 96 + insets.bottom : spacing.xxxl }]} showsVerticalScrollIndicator={false}>{inner}</ScrollView> : inner}
      {bottomNav && <BottomNav />}
    </SafeAreaView>
  );
}

export function TopBar({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  const palette = usePalette();
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack ?? (() => router.back())} style={styles.iconButton}>
        <Ionicons name="arrow-back" size={22} color={palette.ink} />
      </Pressable>
      <Text style={[typography.title, { color: palette.ink }]}>{title}</Text>
      <View style={styles.topAction}>{action}</View>
    </View>
  );
}

export function BrandMark({ size = 46 }: { size?: number }) {
  const iconSize = Math.round(size * 0.5);
  const badgeSize = Math.max(12, Math.round(size * 0.28));
  return (
    <View
      style={[
        styles.brandMark,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: '#0B0F19',
          borderWidth: 1.5,
          borderColor: 'rgba(99, 102, 241, 0.4)',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        },
      ]}
    >
      <Ionicons name="bookmarks" size={iconSize} color="#818CF8" />
      <View
        style={{
          position: 'absolute',
          top: Math.round(size * 0.12),
          right: Math.round(size * 0.12),
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: '#F59E0B',
          borderWidth: 1.5,
          borderColor: '#0B0F19',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name="flash" size={Math.round(badgeSize * 0.6)} color="#FFFFFF" />
      </View>
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.sm }]}>{children}</Text>;
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const palette = usePalette();
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Text style={[typography.display, { color: palette.ink }]}>{title}</Text>
      {subtitle && <Text style={[typography.body, { color: palette.inkMuted, marginTop: spacing.sm, maxWidth: 620 }]}>{subtitle}</Text>}
    </View>
  );
}

export function Card({ children, style, color, onPress }: PropsWithChildren<{ style?: object; color?: string; onPress?: () => void }>) {
  const palette = usePalette();
  const content = <View style={[styles.card, shadows.card, { backgroundColor: color ?? palette.paperRaised, borderColor: palette.paperMuted }, style]}>{children}</View>;
  if (!onPress) return content;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.88, transform: [{ scale: 0.99 }] } : undefined}>{content}</Pressable>;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  fullWidth = false,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'reward';
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
}) {
  const palette = usePalette();
  const configs = {
    primary: { bg: palette.indigo, border: palette.indigoBorder, fg: palette.white, bbWidth: 3 },
    secondary: { bg: palette.indigoTint, border: '#C7D2FE', fg: palette.indigoDeep, bbWidth: 3 },
    success: { bg: palette.mint, border: palette.mintBorder, fg: palette.white, bbWidth: 3 },
    reward: { bg: palette.gold, border: palette.goldBorder, fg: palette.white, bbWidth: 3 },
    danger: { bg: palette.dangerTint, border: palette.dangerBorder, fg: palette.danger, bbWidth: 3 },
    ghost: { bg: 'transparent', border: palette.paperMuted, fg: palette.indigo, bbWidth: 1 },
  };
  const cfg = configs[variant] ?? configs.primary;

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          borderBottomWidth: cfg.bbWidth,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: pressed ? [{ translateY: 1 }] : undefined,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={cfg.fg} />}
      <Text style={[typography.body, { color: cfg.fg, fontWeight: '800' }]}>{children}</Text>
    </Pressable>
  );
}

export function ProgressBar({ progress, tone = 'primary' }: { progress: number; tone?: 'primary' | 'success' | 'fire' | 'reward' }) {
  const palette = usePalette();
  const fillColors = {
    primary: palette.indigo,
    success: palette.mint,
    fire: palette.fire,
    reward: palette.gold,
  };
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <View style={[styles.progressTrack, { backgroundColor: palette.paperMuted }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fillColors[tone] }]} />
    </View>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'reward' | 'danger' | 'primary' | 'fire' }) {
  const palette = usePalette();
  const bg = {
    neutral: palette.paperMuted,
    success: palette.mintTint,
    reward: palette.goldTint,
    danger: palette.dangerTint,
    primary: palette.indigoTint,
    fire: palette.fireTint,
  }[tone];
  const fg = {
    neutral: palette.inkMuted,
    success: palette.mint,
    reward: palette.gold,
    danger: palette.danger,
    primary: palette.indigoDeep,
    fire: palette.fire,
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[typography.label, { color: fg, fontSize: 11 }]}>{children}</Text>
    </View>
  );
}

export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const palette = usePalette();
  return <View style={styles.sectionHeading}><Text style={[typography.title, { color: palette.ink }]}>{title}</Text>{action && <Pressable onPress={onAction}><Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{action}</Text></Pressable>}</View>;
}

export function StatCard({ value, label, icon, tone = 'primary' }: { value: string; label: string; icon: IconName; tone?: 'primary' | 'success' | 'reward' | 'fire' }) {
  const palette = usePalette();
  const toneColor = { primary: palette.indigo, success: palette.mint, reward: palette.gold, fire: palette.fire }[tone];
  return (
    <Card style={styles.statCard}>
      <Ionicons name={icon} size={22} color={toneColor} />
      <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.md }]}>{value}</Text>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>{label}</Text>
    </Card>
  );
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  const palette = usePalette();
  return <Card style={styles.emptyState}><Ionicons name={icon} size={34} color={palette.indigo} /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>{title}</Text><Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.sm }]}>{message}</Text></Card>;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = usePalette();
  const { t } = useI18n();
  const items: Array<{ route: '/' | '/sets' | '/battle' | '/leaderboard' | '/settings'; label: string; icon: IconName }> = [
    { route: '/', label: t.nav.home, icon: 'home-outline' },
    { route: '/sets', label: t.nav.library, icon: 'library-outline' },
    { route: '/battle', label: t.nav.battle, icon: 'game-controller-outline' },
    { route: '/leaderboard', label: t.nav.rank, icon: 'trophy-outline' },
    { route: '/settings', label: t.nav.settings, icon: 'settings-outline' },
  ];
  return (
    <View style={[styles.bottomNav, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
      {items.map((item) => {
        const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
        return (
          <Pressable key={item.route} onPress={() => router.replace(item.route)} style={[styles.navItem, active ? { backgroundColor: palette.indigoTint, borderRadius: radii.sm } : undefined]}>
            <Ionicons name={active ? item.icon.replace('-outline', '') as IconName : item.icon} size={22} color={active ? palette.indigo : palette.inkMuted} />
            <Text style={[typography.label, { fontSize: 10, color: active ? palette.indigo : palette.inkMuted, marginTop: 3 }]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconTile({ icon, tint = 'primary' }: { icon: IconName; tint?: 'primary' | 'success' | 'reward' | 'danger' | 'fire' }) {
  const palette = usePalette();
  const bg = { primary: palette.indigoTint, success: palette.mintTint, reward: palette.goldTint, danger: palette.dangerTint, fire: palette.fireTint }[tint];
  const fg = { primary: palette.indigo, success: palette.mint, reward: palette.gold, danger: palette.danger, fire: palette.fire }[tint];
  return <View style={[styles.iconTile, { backgroundColor: bg }]}><Ionicons name={icon} size={22} color={fg} /></View>;
}

export const uiColors = { colors, spacing, radii, typography };

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: spacing.lg },
  content: { width: '100%', flexGrow: 1 },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topAction: { marginLeft: 'auto', minWidth: 36, alignItems: 'flex-end' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.md, borderWidth: 1, padding: spacing.lg },
  button: { minHeight: 50, borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  statCard: { flex: 1, minWidth: 150, padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
  bottomNav: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, minHeight: 72, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: spacing.sm, ...shadows.card },
  navItem: { minWidth: 54, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  iconTile: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  progressTrack: { height: 12, borderRadius: radii.pill, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: radii.pill },
});
