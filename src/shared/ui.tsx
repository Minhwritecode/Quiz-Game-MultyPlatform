import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, palettes, radii, shadows, spacing, typography } from '@/core/theme/tokens';

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
  const palette = usePalette();
  return (
    <View style={[styles.brandMark, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: palette.indigoTint }]}>
      <Ionicons name="library" size={size * 0.46} color={palette.indigo} />
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
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.86 } : undefined}>{content}</Pressable>;
}

export function Button({ children, onPress, variant = 'primary', icon, disabled = false }: { children: ReactNode; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean }) {
  const palette = usePalette();
  const backgrounds = { primary: palette.indigo, secondary: palette.indigoTint, ghost: 'transparent', danger: palette.dangerTint };
  const foregrounds = { primary: palette.white, secondary: palette.indigoDeep, ghost: palette.indigo, danger: palette.danger };
  return (
    <Pressable disabled={disabled} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: backgrounds[variant], borderColor: variant === 'ghost' ? palette.paperMuted : backgrounds[variant], opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }]}>
      {icon && <Ionicons name={icon} size={18} color={foregrounds[variant]} />}
      <Text style={[typography.body, { color: foregrounds[variant], fontWeight: '800' }]}>{children}</Text>
    </Pressable>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'reward' | 'danger' | 'primary' }) {
  const palette = usePalette();
  const bg = { neutral: palette.paperMuted, success: palette.mintTint, reward: palette.goldTint, danger: palette.dangerTint, primary: palette.indigoTint }[tone];
  const fg = { neutral: palette.inkMuted, success: palette.mint, reward: palette.gold, danger: palette.danger, primary: palette.indigoDeep }[tone];
  return <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[typography.label, { color: fg, fontSize: 10 }]}>{children}</Text></View>;
}

export function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const palette = usePalette();
  return <View style={styles.sectionHeading}><Text style={[typography.title, { color: palette.ink }]}>{title}</Text>{action && <Pressable onPress={onAction}><Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{action}</Text></Pressable>}</View>;
}

export function StatCard({ value, label, icon, tone = 'primary' }: { value: string; label: string; icon: IconName; tone?: 'primary' | 'success' | 'reward' }) {
  const palette = usePalette();
  const toneColor = { primary: palette.indigo, success: palette.mint, reward: palette.gold }[tone];
  return <Card style={styles.statCard}><Ionicons name={icon} size={22} color={toneColor} /><Text style={[typography.heading, { color: palette.ink, marginTop: spacing.md }]}>{value}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>{label}</Text></Card>;
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  const palette = usePalette();
  return <Card style={styles.emptyState}><Ionicons name={icon} size={34} color={palette.indigo} /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>{title}</Text><Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.sm }]}>{message}</Text></Card>;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = usePalette();
  const items: Array<{ route: '/' | '/sets' | '/battle' | '/leaderboard' | '/settings'; label: string; icon: IconName }> = [
    { route: '/', label: 'Home', icon: 'home-outline' },
    { route: '/sets', label: 'Library', icon: 'library-outline' },
    { route: '/battle', label: 'Battle', icon: 'game-controller-outline' },
    { route: '/leaderboard', label: 'Rank', icon: 'trophy-outline' },
    { route: '/settings', label: 'Settings', icon: 'settings-outline' },
  ];
  return <View style={[styles.bottomNav, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>{items.map((item) => { const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route); return <Pressable key={item.route} onPress={() => router.replace(item.route)} style={styles.navItem}><Ionicons name={active ? item.icon.replace('-outline', '') as IconName : item.icon} size={22} color={active ? palette.indigo : palette.inkMuted} /><Text style={[typography.label, { fontSize: 10, color: active ? palette.indigo : palette.inkMuted, marginTop: 3 }]}>{item.label}</Text></Pressable>; })}</View>;
}

export function IconTile({ icon, tint = 'primary' }: { icon: IconName; tint?: 'primary' | 'success' | 'reward' | 'danger' }) {
  const palette = usePalette();
  const bg = { primary: palette.indigoTint, success: palette.mintTint, reward: palette.goldTint, danger: palette.dangerTint }[tint];
  const fg = { primary: palette.indigo, success: palette.mint, reward: palette.gold, danger: palette.danger }[tint];
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
});
