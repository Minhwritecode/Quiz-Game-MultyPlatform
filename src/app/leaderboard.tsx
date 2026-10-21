import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, BottomNav, Card, PageHeader, Screen, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';

const players: Array<[string, string]> = [['You', '1,240'], ['Linh Nguyen', '1,180'], ['Minh Tran', '960'], ['An Pham', '820']];

export default function LeaderboardScreen() {
  const palette = usePalette();
  return <Screen bottomNav><PageHeader eyebrow="STUDY CIRCLE" title="A little friendly pressure" subtitle="Points reward correct answers and calm speed—not guesswork." /><Card color={palette.goldTint} style={styles.streak}><View style={styles.medal}><Ionicons name="trophy" size={26} color={palette.white} /></View><View style={{ flex: 1 }}><Text style={[typography.caption, { color: palette.gold }]}>Your current streak</Text><Text style={[typography.title, { color: palette.gold, marginTop: 4 }]}>4 wins in a row</Text></View><Text style={[typography.title, { color: palette.gold }]}>+18%</Text></Card><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>Weekly leaderboard</Text>{players.map(([name, score], index) => <Card key={name} style={styles.player}><Text style={[typography.heading, { color: index === 0 ? palette.indigo : palette.inkMuted, width: 34 }]}>{index + 1}</Text><View style={styles.avatar}><Text style={{ color: palette.indigo, fontWeight: '800' }}>{name[0]}</Text></View><View style={{ flex: 1 }}><Text style={[typography.title, { color: palette.ink }]}>{name}</Text><Text style={[typography.caption, { color: palette.inkMuted }]}>This week</Text></View><Text style={[typography.title, { color: palette.ink }]}>{score}</Text></Card>)}</Screen>;
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  medal: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#D39A31', alignItems: 'center', justifyContent: 'center' },
  player: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E9EBFF', alignItems: 'center', justifyContent: 'center' },
});
