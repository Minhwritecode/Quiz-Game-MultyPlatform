import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Badge, BottomNav, BrandMark, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { signOut } from '@/features/auth/data/authRepository';
import { colors, spacing, typography } from '@/core/theme/tokens';

function PreferenceRow({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: React.ReactNode }) { const palette = usePalette(); return <View style={styles.row}><Ionicons name={icon} size={22} color={palette.inkMuted} /><View style={{ flex: 1 }}><Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>{title}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>{subtitle}</Text></View>{children}</View>; }

export default function SettingsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const haptics = usePapyrusStore((state) => state.haptics);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const toggleHaptics = usePapyrusStore((state) => state.toggleHaptics);
  const toggleReduceMotion = usePapyrusStore((state) => state.toggleReduceMotion);
  const handleSignOut = async () => { await signOut(); router.replace('/auth'); };
  return <Screen bottomNav><TopBar title="Settings" /><Card style={styles.profile}><BrandMark size={54} /><View style={{ flex: 1 }}><Text style={[typography.title, { color: palette.ink }]}>Guest learner</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>Offline mode · sign in to sync across devices</Text></View><Badge tone="neutral">GUEST</Badge></Card><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>Preferences</Text><Card style={styles.group}><PreferenceRow icon="moon-outline" title="Appearance" subtitle="Follow system light/dark mode"><Text style={[typography.caption, { color: palette.inkMuted }]}>System</Text></PreferenceRow><View style={[styles.separator, { backgroundColor: palette.paperMuted }]} /><PreferenceRow icon="language-outline" title="Language" subtitle="Question generation language"><Text style={[typography.caption, { color: palette.inkMuted }]}>English</Text></PreferenceRow><View style={[styles.separator, { backgroundColor: palette.paperMuted }]} /><PreferenceRow icon="sparkles-outline" title="Haptic feedback" subtitle="Confirm important actions"><Switch value={haptics} onValueChange={toggleHaptics} trackColor={{ false: palette.paperMuted, true: palette.indigo }} /></PreferenceRow><View style={[styles.separator, { backgroundColor: palette.paperMuted }]} /><PreferenceRow icon="options-outline" title="Reduce motion" subtitle="Prefer calmer transitions"><Switch value={reduceMotion} onValueChange={toggleReduceMotion} trackColor={{ false: palette.paperMuted, true: palette.indigo }} /></PreferenceRow></Card><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>Data & sync</Text><Card style={styles.group}><PreferenceRow icon="sync-outline" title="Sync status" subtitle="All local changes are safe"><Badge tone="success">READY</Badge></PreferenceRow><View style={[styles.separator, { backgroundColor: palette.paperMuted }]} /><Pressable style={styles.row} onPress={() => router.push('/sets')}><Ionicons name="server-outline" size={22} color={palette.inkMuted} /><View style={{ flex: 1 }}><Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>Manage local data</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>Review cached question sets</Text></View><Ionicons name="chevron-forward" size={20} color={palette.inkMuted} /></Pressable></Card><Card color={palette.indigoTint} style={styles.about}><Text style={[typography.title, { color: palette.indigo }]}>Papyrus</Text><Text style={[typography.caption, { color: palette.indigoDeep, marginTop: 4 }]}>From Ancient Scroll to AI Power.{`\n`}React Native base v0.2.0</Text></Card><Pressable onPress={handleSignOut} style={styles.signOut}><Ionicons name="log-out-outline" size={20} color={colors.danger} /><Text style={[typography.body, { color: colors.danger, fontWeight: '800' }]}>Sign out</Text></Pressable></Screen>;
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  group: { padding: 0, overflow: 'hidden' },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  separator: { height: 1, marginLeft: 58 },
  about: { marginTop: spacing.xl },
  signOut: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
});
