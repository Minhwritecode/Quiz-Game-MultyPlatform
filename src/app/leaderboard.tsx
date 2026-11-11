import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Card, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useI18n } from '@/core/i18n';

export default function LeaderboardScreen() {
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const { language, t } = useI18n();

  const mockRankings = [
    { rank: 1, name: user?.displayName ? `${user.displayName}${t.leaderboard.youTag}` : (language === 'vi' ? 'Bạn (Learner)' : 'You (Learner)'), score: '1,450 XP', isMe: true, streak: 5, avatar: '🏆' },
    { rank: 2, name: 'Linh Nguyễn', score: '1,280 XP', isMe: false, streak: 4, avatar: '🥈' },
    { rank: 3, name: 'Minh Trần', score: '1,120 XP', isMe: false, streak: 3, avatar: '🥉' },
    { rank: 4, name: 'An Phạm', score: '980 XP', isMe: false, streak: 2, avatar: '⭐' },
    { rank: 5, name: 'Hải Đăng', score: '850 XP', isMe: false, streak: 1, avatar: '⚡' },
  ];

  return (
    <Screen bottomNav>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[typography.label, { color: palette.indigo }]}>{t.leaderboard.badge}</Text>
        <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
          {t.leaderboard.title}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
          {t.leaderboard.sub}
        </Text>
      </View>

      {/* Streak Highlight Card */}
      <Card color={palette.goldTint} style={styles.streakCard}>
        <View style={[styles.medal, { backgroundColor: palette.gold }]}>
          <Ionicons name="flame" size={28} color={palette.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: palette.gold }]}>{t.leaderboard.streakTitle}</Text>
          <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]}>
            {t.leaderboard.streakSub}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {t.leaderboard.streakBonus}
          </Text>
        </View>
        <Badge tone="fire">{t.leaderboard.rank1}</Badge>
      </Card>

      {/* Leaderboard List */}
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        {t.leaderboard.topPlayers}
      </Text>

      <View style={styles.rankingsList}>
        {mockRankings.map((player) => {
          const isTop1 = player.rank === 1;
          const isTop2 = player.rank === 2;
          const isTop3 = player.rank === 3;

          let rankBadgeBg = palette.paperMuted;
          let rankBadgeFg = palette.inkMuted;
          if (isTop1) {
            rankBadgeBg = palette.goldTint;
            rankBadgeFg = palette.gold;
          } else if (isTop2) {
            rankBadgeBg = '#E2E8F0';
            rankBadgeFg = '#475569';
          } else if (isTop3) {
            rankBadgeBg = '#FFEDD5';
            rankBadgeFg = '#C2410C';
          }

          return (
            <Card
              key={player.rank}
              style={[
                styles.playerCard,
                player.isMe ? { borderColor: palette.indigo, borderWidth: 2 } : undefined,
              ]}
            >
              <View style={[styles.rankBadge, { backgroundColor: rankBadgeBg }]}>
                <Text style={{ fontWeight: '800', color: rankBadgeFg, fontSize: 15 }}>
                  {player.rank}
                </Text>
              </View>

              <Text style={styles.avatar}>{player.avatar}</Text>

              <View style={{ flex: 1 }}>
                <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
                  {player.name}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 1 }]}>
                  🔥 {player.streak} {t.home.streakDays}
                </Text>
              </View>

              <Text style={[typography.title, { color: palette.indigo, fontSize: 15 }]}>
                {player.score}
              </Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.sm, marginBottom: spacing.lg },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  medal: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rankingsList: { gap: spacing.sm, marginBottom: spacing.xxl },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 24 },
});
