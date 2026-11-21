import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Badge, Button, Card, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { getEloTier } from '@/features/room-battle/domain/elo';
import { useI18n } from '@/core/i18n';
import {
  fetchFriendsLeaderboard,
  fetchGlobalLeaderboard,
  fetchMyBattleHistory,
  type BattleHistoryItem,
  type LeaderboardEntry,
  type LeaderboardTimeframe,
  type LeaderboardTopic,
} from '@/features/leaderboard/data/leaderboardRepository';

const TIME_TABS: { key: LeaderboardTimeframe; label: string }[] = [
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'all', label: 'Mọi thời' },
];

const TOPIC_CHIPS: { key: LeaderboardTopic; label: string }[] = [
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

function PlayerRow({ player }: { player: LeaderboardEntry }) {
  const palette = usePalette();
  const { t } = useI18n();
  const isTop1 = player.rank === 1;
  const isTop2 = player.rank === 2;
  const isTop3 = player.rank === 3;
  let rankBg = palette.paperMuted;
  let rankFg = palette.inkMuted;
  if (isTop1) {
    rankBg = palette.goldTint;
    rankFg = palette.gold;
  } else if (isTop2) {
    rankBg = '#E2E8F0';
    rankFg = '#475569';
  } else if (isTop3) {
    rankBg = '#FFEDD5';
    rankFg = '#C2410C';
  }
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
        <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]} numberOfLines={1}>
          {player.isMe && !player.name.includes('(Bạn)') ? `${player.name} (Bạn)` : player.name}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
          🔥 {player.streak} {t.home.streakDays} · {player.gamesPlayed} trận
        </Text>
      </View>
      <Text style={[typography.title, { color: palette.indigo, fontSize: 14 }]} numberOfLines={1}>
        {player.scoreLabel}
      </Text>
    </Card>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const localScore = usePapyrusStore((s) => s.totalScore);
  const localGamesPlayed = usePapyrusStore((s) => s.gamesPlayed);
  const eloRating = usePapyrusStore((s) => s.eloRating);
  const eloTier = getEloTier(eloRating);
  const localStreak = useStreakStore((s) => s.currentStreak);
  const { t } = useI18n();
  const { width } = useWindowDimensions();

  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [timeFilter, setTimeFilter] = useState<LeaderboardTimeframe>('week');
  const [topicFilter, setTopicFilter] = useState<LeaderboardTopic>('all');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [battleHistory, setBattleHistory] = useState<BattleHistoryItem[]>([]);
  const [source, setSource] = useState<'live' | 'offline'>('offline');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const fetchEntries = useCallback(async () => {
    if (scope === 'friends') {
      return fetchFriendsLeaderboard({
        timeframe: timeFilter,
        currentUserId: user?.id,
        currentUserName: user?.displayName ?? undefined,
        localScore,
        localGamesPlayed,
        localStreak,
      });
    }
    return fetchGlobalLeaderboard({
      timeframe: timeFilter,
      topic: topicFilter,
      currentUserId: user?.id,
      currentUserName: user?.displayName ?? undefined,
      localScore,
      localGamesPlayed,
      localStreak,
    });
  }, [scope, timeFilter, topicFilter, user?.id, user?.displayName, localScore, localGamesPlayed, localStreak]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoadError('');
    try {
      const [res, hist] = await Promise.all([fetchEntries(), fetchMyBattleHistory(8)]);
      setEntries(res.entries);
      setSource(res.source);
      setBattleHistory(hist);
    } catch {
      setLoadError('Không thể tải bảng xếp hạng lúc này. Nhấn Thử lại để đồng bộ.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchEntries]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchEntries(), fetchMyBattleHistory(8)])
      .then(([res, hist]) => {
        if (!active) return;
        setEntries(res.entries);
        setSource(res.source);
        setBattleHistory(hist);
        setLoadError('');
      })
      .catch(() => {
        if (active) setLoadError('Không thể tải bảng xếp hạng lúc này.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchEntries]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const myEntry = entries.find((p) => p.isMe);

  return (
    <Screen scroll={false} bottomNav>
      <FlatList
        data={loading ? [] : paged}
        keyExtractor={(item) => `${item.id}-${item.rank}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={palette.indigo} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: spacing.lg, maxWidth: Math.min(width, 680), alignSelf: 'center', width: '100%' },
        ]}
        renderItem={({ item }) => <PlayerRow player={item} />}
        ListHeaderComponent={
          <>
            {/* ── Header + Live/Offline Source Indicator ── */}
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <Text style={[typography.label, { color: palette.indigo }]}>{t.leaderboard.badge}</Text>
                <Badge tone={source === 'live' ? 'success' : 'neutral'}>
                  {source === 'live' ? '● Dữ liệu trực tuyến' : '● Đấu trường ngoại tuyến'}
                </Badge>
              </View>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                {t.leaderboard.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {t.leaderboard.sub}
              </Text>
            </View>

            {/* ── Global vs Friends Scope Switcher ── */}
            <View style={[styles.tabRow, { marginBottom: spacing.sm }]}>
              {([
                { key: 'global', label: '🌍 Toàn cầu' },
                { key: 'friends', label: '👥 Bạn bè' },
              ] as const).map((sc) => (
                <Pressable
                  key={sc.key}
                  onPress={() => {
                    setScope(sc.key);
                    setPage(0);
                  }}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: scope === sc.key ? palette.indigo : palette.paperRaised,
                      borderColor: scope === sc.key ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: scope === sc.key ? '#fff' : palette.ink, fontWeight: '800' },
                    ]}
                  >
                    {sc.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {loadError ? (
              <Card style={{ marginBottom: spacing.sm, borderColor: palette.danger, borderWidth: 1 }}>
                <Text style={[typography.caption, { color: palette.danger, marginBottom: spacing.xs }]}>
                  {loadError}
                </Text>
                <Button variant="secondary" icon="refresh" onPress={() => void handleRefresh()}>
                  Thử lại
                </Button>
              </Card>
            ) : null}

            {/* ── Time filter tabs ── */}
            <View style={styles.tabRow}>
              {TIME_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    setTimeFilter(tab.key);
                    setPage(0);
                  }}
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
                <Ionicons name="flame" size={26} color={palette.white} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.label, { color: palette.gold }]} numberOfLines={1}>
                  {t.leaderboard.streakTitle}
                </Text>
                <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]} numberOfLines={1}>
                  {localStreak > 0 ? `Chuỗi ${localStreak} ngày liên tiếp 🎯` : t.leaderboard.streakSub}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  {t.leaderboard.streakBonus}
                </Text>
              </View>
              <Badge tone="fire">{myEntry ? `#${myEntry.rank}` : t.leaderboard.rank1}</Badge>
            </Card>

            {/* ── My rank snapshot + ELO Rating + Link to Profile/History ── */}
            {myEntry ? (
              <Card onPress={() => router.push('/profile')} style={[styles.myRank, { borderColor: palette.indigo }]}>
                <Ionicons name="person-circle" size={20} color={palette.indigo} />
                <Text style={[typography.caption, { color: palette.indigo, flex: 1, fontWeight: '700' }]} numberOfLines={1}>
                  Hạng #{myEntry.rank} · {eloTier.badge} {eloRating} ELO · Xem hồ sơ →
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
                  {myEntry.scoreLabel}
                </Text>
              </Card>
            ) : null}

            {/* ── Recent Personal Battle History (Supabase RPC) ── */}
            {battleHistory.length > 0 && (
              <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', marginBottom: 6 }]}>
                  📜 LỊCH SỬ TRẬN ĐẤU GẦN ĐÂY ({battleHistory.length})
                </Text>
                {battleHistory.slice(0, 3).map((item) => (
                  <View
                    key={item.matchId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 5,
                      borderBottomWidth: 1,
                      borderBottomColor: palette.paperMuted,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]} numberOfLines={1}>
                        {item.label} vs {item.opponentOrPlayers}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                        {new Date(item.playedAt).toLocaleDateString('vi-VN')} · {item.myScore}đ
                      </Text>
                    </View>
                    <Badge tone={item.outcome === 'win' ? 'success' : item.outcome === 'forfeit' ? 'danger' : 'neutral'}>
                      {item.outcome === 'win'
                        ? `Thắng${item.eloDelta ? ` (+${item.eloDelta})` : ''}`
                        : item.outcome === 'forfeit'
                        ? 'Bỏ cuộc'
                        : item.outcome === 'draw'
                        ? 'Hòa'
                        : `Thua${item.eloDelta ? ` (${item.eloDelta})` : ''}`}
                    </Badge>
                  </View>
                ))}
              </Card>
            )}

            {/* ── Topic filter chips ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {TOPIC_CHIPS.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    setTopicFilter(chip.key);
                    setPage(0);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: topicFilter === chip.key ? palette.indigo : palette.paperMuted },
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

            <Text style={[typography.title, { color: palette.ink, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              {t.leaderboard.topPlayers}
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <ActivityIndicator size="large" color={palette.indigo} />
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
                Đang tải bảng xếp hạng từ máy chủ...
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={{ fontSize: 36 }}>🔍</Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
                Chưa có dữ liệu cho bộ lọc này
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                style={[styles.pageBtn, { opacity: safePage === 0 ? 0.4 : 1, backgroundColor: palette.paperMuted }]}
              >
                <Ionicons name="chevron-back" size={18} color={palette.ink} />
              </Pressable>
              {Array.from({ length: totalPages }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setPage(i)}
                  style={[
                    styles.pageBtn,
                    { backgroundColor: safePage === i ? palette.indigo : palette.paperMuted },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: safePage === i ? '#fff' : palette.inkMuted, fontWeight: '700' },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                style={[
                  styles.pageBtn,
                  { opacity: safePage >= totalPages - 1 ? 0.4 : 1, backgroundColor: palette.paperMuted },
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
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1.5 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.md },
  medal: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  myRank: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, borderWidth: 1.5, padding: spacing.sm },
  chipScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 22 },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  pageBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
