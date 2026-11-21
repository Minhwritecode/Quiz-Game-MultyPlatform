import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Badge, Card, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useI18n } from '@/core/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────
type TimeFilter = 'week' | 'month' | 'all';
type TopicFilter = 'all' | 'math' | 'physics' | 'chemistry' | 'biology' | 'history' | 'english' | 'science';

interface Player {
  rank: number;
  name: string;
  score: number;
  scoreLabel: string;
  streak: number;
  avatar: string;
  isMe: boolean;
  topic: TopicFilter;
}

// ─── Mock data (10 players) ───────────────────────────────────────────────────
const ALL_PLAYERS: Player[] = [
  { rank: 1, name: 'Linh Nguyễn', score: 14500, scoreLabel: '14,500 XP', streak: 12, avatar: '🏆', isMe: false, topic: 'math' },
  { rank: 2, name: 'Minh Trần', score: 12800, scoreLabel: '12,800 XP', streak: 9, avatar: '🥈', isMe: false, topic: 'physics' },
  { rank: 3, name: 'An Phạm', score: 11200, scoreLabel: '11,200 XP', streak: 7, avatar: '🥉', isMe: false, topic: 'chemistry' },
  { rank: 4, name: 'Hải Đăng', score: 9800, scoreLabel: '9,800 XP', streak: 5, avatar: '⭐', isMe: false, topic: 'biology' },
  { rank: 5, name: 'Thu Hà', score: 8500, scoreLabel: '8,500 XP', streak: 4, avatar: '⚡', isMe: false, topic: 'history' },
  { rank: 6, name: 'Duy Khang', score: 7200, scoreLabel: '7,200 XP', streak: 3, avatar: '🎯', isMe: false, topic: 'english' },
  { rank: 7, name: 'Ngọc Anh', score: 6100, scoreLabel: '6,100 XP', streak: 3, avatar: '🔥', isMe: false, topic: 'science' },
  { rank: 8, name: 'Thanh Long', score: 5300, scoreLabel: '5,300 XP', streak: 2, avatar: '💫', isMe: false, topic: 'math' },
  { rank: 9, name: 'Bảo Châu', score: 4200, scoreLabel: '4,200 XP', streak: 1, avatar: '🌟', isMe: false, topic: 'physics' },
  { rank: 10, name: 'Việt Anh', score: 3100, scoreLabel: '3,100 XP', streak: 1, avatar: '✨', isMe: false, topic: 'chemistry' },
];

const TIME_TABS: { key: TimeFilter; label: string }[] = [
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'all', label: 'Mọi thời' },
];

const TOPIC_CHIPS: { key: TopicFilter; label: string }[] = [
  { key: 'all', label: '🌐 Tất cả' },
  { key: 'math', label: '📐 Toán' },
  { key: 'physics', label: '⚡ Lý' },
  { key: 'chemistry', label: '🧪 Hóa' },
  { key: 'biology', label: '🌿 Sinh' },
  { key: 'history', label: '📜 Sử' },
  { key: 'english', label: '🇬🇧 Anh' },
  { key: 'science', label: '🔬 KHTN' },
];

const PAGE_SIZE = 5;

// ─── Player row ───────────────────────────────────────────────────────────────
function PlayerRow({ player }: { player: Player }) {
  const palette = usePalette();
  const { t } = useI18n();
  const isTop1 = player.rank === 1;
  const isTop2 = player.rank === 2;
  const isTop3 = player.rank === 3;
  let rankBg = palette.paperMuted;
  let rankFg = palette.inkMuted;
  if (isTop1) { rankBg = palette.goldTint; rankFg = palette.gold; }
  else if (isTop2) { rankBg = '#E2E8F0'; rankFg = '#475569'; }
  else if (isTop3) { rankBg = '#FFEDD5'; rankFg = '#C2410C'; }
  return (
    <Card
      style={[
        styles.playerCard,
        player.isMe ? { borderColor: palette.indigo, borderWidth: 2 } : undefined,
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: rankBg }]}>
        <Text style={{ fontWeight: '800', color: rankFg, fontSize: 14 }}>{player.rank}</Text>
      </View>
      <Text style={styles.avatar}>{player.avatar}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[typography.title, { color: palette.ink, fontSize: 15 }]}
          numberOfLines={1}
        >
          {player.isMe ? `${player.name} (Bạn)` : player.name}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
          🔥 {player.streak} {t.home.streakDays}
        </Text>
      </View>
      <Text style={[typography.title, { color: palette.indigo, fontSize: 14 }]} numberOfLines={1}>
        {player.scoreLabel}
      </Text>
    </Card>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LeaderboardScreen() {
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const [page, setPage] = useState(0);

  // Inject current user at rank 4 position when logged in
  const enriched = useMemo(() => {
    if (!user?.displayName) return ALL_PLAYERS;
    return ALL_PLAYERS.map((p, i) =>
      i === 3 ? { ...p, name: user.displayName ?? p.name, isMe: true } : p,
    );
  }, [user]);

  // Filter by topic (time filter only affects score label for mock)
  const filtered = useMemo(() => {
    const scoreMultiplier = timeFilter === 'week' ? 1 : timeFilter === 'month' ? 3.2 : 8.5;
    let list = enriched.filter((p) => topicFilter === 'all' || p.topic === topicFilter);
    return list.map((p) => ({
      ...p,
      scoreLabel: `${Math.round(p.score * scoreMultiplier).toLocaleString('vi-VN')} XP`,
    }));
  }, [enriched, topicFilter, timeFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Clamp page when filter changes
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  if (safePage !== page) setPage(safePage);

  const myEntry = filtered.find((p) => p.isMe);

  return (
    <Screen scroll={false} bottomNav>
      <FlatList
        data={paged}
        keyExtractor={(item) => String(item.rank)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: spacing.lg, maxWidth: Math.min(width, 680), alignSelf: 'center', width: '100%' },
        ]}
        renderItem={({ item }) => <PlayerRow player={item} />}
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <View style={styles.header}>
              <Text style={[typography.label, { color: palette.indigo }]}>{t.leaderboard.badge}</Text>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                {t.leaderboard.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {t.leaderboard.sub}
              </Text>
            </View>

            {/* ── Time filter tabs ── */}
            <View style={styles.tabRow}>
              {TIME_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => { setTimeFilter(tab.key); setPage(0); }}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: timeFilter === tab.key ? palette.indigo : palette.paperMuted,
                      borderColor: timeFilter === tab.key ? palette.indigo : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: timeFilter === tab.key ? '#fff' : palette.inkMuted, fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Streak highlight card ── */}
            <Card color={palette.goldTint} style={styles.streakCard}>
              <View style={[styles.medal, { backgroundColor: palette.gold }]}>
                <Ionicons name="flame" size={28} color={palette.white} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.label, { color: palette.gold }]} numberOfLines={1}>
                  {t.leaderboard.streakTitle}
                </Text>
                <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]} numberOfLines={1}>
                  {t.leaderboard.streakSub}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  {t.leaderboard.streakBonus}
                </Text>
              </View>
              <Badge tone="fire">{t.leaderboard.rank1}</Badge>
            </Card>

            {/* ── My rank snapshot ── */}
            {myEntry ? (
              <Card style={[styles.myRank, { borderColor: palette.indigo }]}>
                <Ionicons name="person-circle" size={20} color={palette.indigo} />
                <Text style={[typography.caption, { color: palette.indigo, flex: 1, fontWeight: '700' }]}>
                  Hạng của bạn: #{myEntry.rank}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>{myEntry.scoreLabel}</Text>
              </Card>
            ) : null}

            {/* ── Topic filter chips ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {TOPIC_CHIPS.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={() => { setTopicFilter(chip.key); setPage(0); }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: topicFilter === chip.key ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: topicFilter === chip.key ? '#fff' : palette.inkMuted, fontWeight: '600' },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text
              style={[
                typography.title,
                { color: palette.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
              ]}
            >
              {t.leaderboard.topPlayers}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <Text style={{ fontSize: 36 }}>🔍</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
              Chưa có dữ liệu cho bộ lọc này
            </Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                style={[styles.pageBtn, { opacity: page === 0 ? 0.4 : 1, backgroundColor: palette.paperMuted }]}
              >
                <Ionicons name="chevron-back" size={18} color={palette.ink} />
              </Pressable>
              {Array.from({ length: totalPages }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setPage(i)}
                  style={[
                    styles.pageBtn,
                    { backgroundColor: page === i ? palette.indigo : palette.paperMuted },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: page === i ? '#fff' : palette.inkMuted, fontWeight: '700' },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={[
                  styles.pageBtn,
                  { opacity: page >= totalPages - 1 ? 0.4 : 1, backgroundColor: palette.paperMuted },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={palette.ink} />
              </Pressable>
            </View>
          ) : (
            <View style={{ height: spacing.xxl }} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  header: { marginTop: spacing.sm, marginBottom: spacing.lg },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  medal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myRank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  chipScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { fontSize: 22 },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  pageBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
