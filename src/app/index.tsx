import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, BottomNav, BrandMark, Button, Card, IconTile, PageHeader, Screen, SectionHeading, StatCard, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const sets = usePapyrusStore((state) => state.questionSets);
  const { width } = useWindowDimensions();
  return (
    <Screen bottomNav>
      <View style={styles.brandRow}><View style={styles.brandIdentity}><BrandMark size={42} /><View><Text style={[typography.title, { color: palette.ink }]}>Papyrus</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>From Ancient Scroll to AI Power.</Text></View></View><Pressable onPress={() => router.push('/settings')} style={styles.profileButton}><Ionicons name="person-circle-outline" size={32} color={palette.indigo} /></Pressable></View>
      <PageHeader eyebrow="YOUR STUDY COMPANION" title="Turn your notes into a challenge." subtitle="Scan, shape and play with questions made for the material you actually need to remember." />
      <Card color={palette.indigo} style={styles.heroCard}>
        <Badge tone="primary">OFFLINE-FIRST LEARNING</Badge>
        <Text style={[typography.heading, { color: palette.white, marginTop: spacing.lg, maxWidth: 520 }]}>Study with your material. Compete with your circle.</Text>
        <Text style={[typography.body, { color: '#E8EBFF', marginTop: spacing.sm, maxWidth: 560 }]}>Your source stays private on-device until you confirm what should become a quiz.</Text>
        <View style={styles.heroActions}><Button icon="add" onPress={() => router.push('/create/scan')} variant="secondary">Create a set</Button><Button icon="game-controller-outline" onPress={() => router.push('/battle')} variant="ghost">Start a battle</Button></View>
      </Card>
      <SectionHeading title="Your learning pulse" />
      <View style={[styles.stats, width >= 720 && styles.statsWide]}><StatCard value="7" label="sets ready to study" icon="book-outline" /><StatCard value="82%" label="average accuracy" icon="analytics-outline" tone="success" /><StatCard value="1,240" label="battle points" icon="trophy-outline" tone="reward" /></View>
      <SectionHeading title="Continue learning" action="View library" onAction={() => router.push('/sets')} />
      {sets.slice(0, 3).map((set) => <Card key={set.id} onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })} style={styles.setCard}><IconTile icon="book-outline" /><View style={styles.setCopy}><Text style={[typography.title, { color: palette.ink }]}>{set.title}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>{set.subject} · {set.questions.length} questions</Text></View><Badge tone={set.syncStatus === 'pending' ? 'reward' : 'success'}>{set.syncStatus === 'pending' ? 'Pending' : 'Synced'}</Badge><Ionicons name="chevron-forward" size={20} color={palette.inkMuted} /></Card>)}
      <SectionHeading title="Quick actions" />
      <View style={[styles.quickGrid, width >= 720 && styles.quickGridWide]}><Card onPress={() => router.push('/create/scan')} style={styles.quickCard}><IconTile icon="scan-outline" tint="success" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Scan material</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Create from paper or photos</Text></Card><Card onPress={() => router.push('/battle')} style={styles.quickCard}><IconTile icon="people-outline" tint="reward" /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>Join a battle</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>Challenge your study circle</Text></Card></View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroCard: { padding: spacing.xxl, borderWidth: 0, overflow: 'hidden' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsWide: { flexWrap: 'nowrap' },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  setCopy: { flex: 1 },
  quickGrid: { gap: spacing.sm },
  quickGridWide: { flexDirection: 'row' },
  quickCard: { flex: 1, minHeight: 150 },
});
