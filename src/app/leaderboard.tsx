import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Badge, Button, Card, OnlineStatusDot, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { getEloTier } from '@/features/room-battle/domain/elo';
import { useI18n } from '@/core/i18n';
import { dependencies } from '@/composition/dependencies';
import type {
  BattleHistoryItem,
  FriendSearchCandidate,
  LeaderboardEntry,
  LeaderboardTimeframe,
  LeaderboardTopic,
} from '@/features/leaderboard/domain/repository';

const TIME_TABS: { key: LeaderboardTimeframe; label: string }[] = [
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'all', label: 'Mọi thời' },
];

const TOPIC_CHIPS: { key: LeaderboardTopic; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'math', label: 'Toán' },
  { key: 'physics', label: 'Lý' },
  { key: 'chemistry', label: 'Hóa' },
  { key: 'biology', label: 'Sinh' },
  { key: 'history', label: 'Sử' },
  { key: 'english', label: 'Anh' },
  { key: 'science', label: 'KHTN' },
];

const PAGE_SIZE = 8;

const PlayerRow = memo(function PlayerRow({
  player,
  showAddFriend,
  addingId,
  onAddFriend,
}: {
  player: LeaderboardEntry;
  showAddFriend?: boolean;
  addingId?: string | null;
  onAddFriend?: (id: string) => void;
}) {
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
        <Text style={{ fontWeight: '800', color: rankFg, fontSize: 13 }}>{player.rank}</Text>
      </View>

      {player.avatarUrl ? (
        <Image source={{ uri: player.avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: palette.indigoTint }]}>
          <Text style={styles.avatar}>{player.avatar}</Text>
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]} numberOfLines={1}>
          {player.isMe && !player.name.includes('(Bạn)') ? `${player.name} (Bạn)` : player.name}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
          {player.streak} {t.home.streakDays} · {player.gamesPlayed} trận
        </Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={[typography.title, { color: palette.indigo, fontSize: 14 }]} numberOfLines={1}>
          {player.scoreLabel}
        </Text>
        {showAddFriend && !player.isMe && !player.isFriend && onAddFriend ? (
          <Pressable
            accessibilityRole="button"
            disabled={addingId === player.id}
            onPress={() => onAddFriend(player.id)}
            style={[styles.miniAddBtn, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
          >
            <Ionicons name="person-add-outline" size={12} color={palette.indigoDeep} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigoDeep }}>
              {addingId === player.id ? '...' : 'Kết bạn'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
});

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Friend search & add state
  const [friendQuery, setFriendQuery] = useState('');
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [searchResults, setSearchResults] = useState<FriendSearchCandidate[]>([]);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [friendNotice, setFriendNotice] = useState('');

  const fetchEntries = useCallback(async () => {
    if (scope === 'friends') {
      return dependencies.leaderboard.fetchFriends({
        timeframe: timeFilter,
        currentUserId: user?.id,
        currentUserName: user?.displayName ?? undefined,
        localScore,
        localGamesPlayed,
        localStreak,
      });
    }
    return dependencies.leaderboard.fetchGlobal({
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
      const [res, hist] = await Promise.all([
        fetchEntries(),
        dependencies.leaderboard.fetchBattleHistory(8),
      ]);
      setEntries(res.entries);
      setBattleHistory(hist);
    } catch {
      setLoadError('Không thể tải bảng xếp hạng lúc này. Nhấn Thử lại để đồng bộ.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchEntries]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchEntries(), dependencies.leaderboard.fetchBattleHistory(8)])
      .then(([res, hist]) => {
        if (!active) return;
        setEntries(res.entries);
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

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState !== 'background') {
          void handleRefresh();
        }
      }, 30_000);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') void handleRefresh();
      });
      return () => {
        clearInterval(timer);
        listener.remove();
      };
    }, [handleRefresh])
  );

  const handleSearchFriends = useCallback(async () => {
    const clean = friendQuery.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      setFriendNotice('Nhập ít nhất 2 ký tự tên người chơi để tìm.');
      return;
    }
    setSearchingFriends(true);
    setFriendNotice('');
    try {
      const found = await dependencies.leaderboard.searchPlayers(clean);
      setSearchResults(found);
      if (found.length === 0) {
        setFriendNotice(`Không tìm thấy người chơi phù hợp với "${clean}".`);
      }
    } finally {
      setSearchingFriends(false);
    }
  }, [friendQuery]);

  const handleAddFriend = useCallback(
    async (friendId: string) => {
      if (!user) {
        router.push('/auth');
        return;
      }
      setAddingFriendId(friendId);
      setFriendNotice('');
      try {
        const ok = await dependencies.leaderboard.addFriend(friendId);
        if (ok) {
          setFriendNotice('Đã kết bạn thành công! Đang cập nhật bảng xếp hạng bạn bè...');
          setSearchResults((prev) => prev.filter((item) => item.id !== friendId));
          await handleRefresh();
        } else {
          setFriendNotice('Không thể kết bạn lúc này. Hãy thử lại.');
        }
      } finally {
        setAddingFriendId(null);
      }
    },
    [handleRefresh, router, user]
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(entries.length / PAGE_SIZE)), [entries.length]);
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [entries, safePage]
  );
  const myEntry = useMemo(() => entries.find((p) => p.isMe), [entries]);
  const keyExtractor = useCallback((item: LeaderboardEntry) => `${item.id}-${item.rank}`, []);
  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <PlayerRow
        player={item}
        showAddFriend={scope === 'friends' && Boolean(user)}
        addingId={addingFriendId}
        onAddFriend={(id) => void handleAddFriend(id)}
      />
    ),
    [scope, user, addingFriendId, handleAddFriend]
  );

  return (
    <Screen scroll={false} bottomNav>
      <FlatList
        data={loading ? [] : paged}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={palette.indigo} />
        }
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: spacing.lg, maxWidth: Math.min(width, 680), alignSelf: 'center', width: '100%' },
        ]}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {/* Clean Header with Minimal Green/Red Status Dot */}
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <Text style={[typography.label, { color: palette.indigo }]}>{t.leaderboard.badge}</Text>
                <OnlineStatusDot />
              </View>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                {t.leaderboard.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {t.leaderboard.sub}
              </Text>
            </View>

            {/* Global vs Friends Scope Switcher */}
            <View style={[styles.tabRow, { marginBottom: spacing.sm }]}>
              {([
                { key: 'global', label: 'Toàn cầu', icon: 'globe-outline' as const },
                { key: 'friends', label: 'Bạn bè & Đối thủ', icon: 'people-outline' as const },
              ] as const).map((sc) => (
                <Pressable
                  key={sc.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: scope === sc.key }}
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
                  <Ionicons name={sc.icon} size={15} color={scope === sc.key ? '#FFFFFF' : palette.inkMuted} />
                  <Text
                    style={[
                      typography.caption,
                      { color: scope === sc.key ? '#FFFFFF' : palette.ink, fontWeight: '800' },
                    ]}
                  >
                    {sc.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Search & Add Friend Bar inside Friends tab */}
            {scope === 'friends' && (
              <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
                <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.xs }]}>
                  TÌM & KẾT BẠN
                </Text>
                {user ? (
                  <>
                    <View style={styles.friendSearchRow}>
                      <TextInput
                        value={friendQuery}
                        onChangeText={setFriendQuery}
                        onSubmitEditing={() => void handleSearchFriends()}
                        placeholder="Nhập tên hiển thị (vd: khoaimichaelminh)..."
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.friendInput,
                          { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                        ]}
                      />
                      <Button
                        icon="search"
                        disabled={searchingFriends || friendQuery.trim().length < 2}
                        onPress={() => void handleSearchFriends()}
                      >
                        Tìm
                      </Button>
                    </View>
                    {!!friendNotice && (
                      <Text style={[typography.caption, { color: palette.indigo, marginTop: spacing.xs }]}>
                        {friendNotice}
                      </Text>
                    )}
                    {searchResults.length > 0 && (
                      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                        {searchResults.map((cand) => (
                          <View
                            key={cand.id}
                            style={[styles.searchResultRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]} numberOfLines={1}>
                                {cand.displayName}
                              </Text>
                              <Text style={[typography.caption, { color: palette.inkMuted }]}>
                                {cand.eloRating} ELO · {cand.totalScore.toLocaleString('vi-VN')} XP
                              </Text>
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              disabled={addingFriendId === cand.id}
                              onPress={() => void handleAddFriend(cand.id)}
                              style={[styles.addFriendBtn, { backgroundColor: palette.indigo }]}
                            >
                              <Ionicons name="person-add" size={14} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                                {addingFriendId === cand.id ? '...' : 'Kết bạn'}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <Button icon="log-in-outline" onPress={() => router.push('/auth')} fullWidth>
                    Đăng nhập để kết bạn & xem bảng xếp hạng bạn bè
                  </Button>
                )}
              </Card>
            )}

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

            {/* Time filter tabs */}
            <View style={styles.tabRow}>
              {TIME_TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: timeFilter === tab.key }}
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
                      { color: timeFilter === tab.key ? '#FFFFFF' : palette.inkMuted, fontWeight: '700' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Streak highlight card */}
            <Card color={palette.goldTint} style={styles.streakCard}>
              <View style={[styles.medal, { backgroundColor: palette.gold }]}>
                <Ionicons name="flame" size={24} color={palette.white} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.label, { color: palette.gold }]} numberOfLines={1}>
                  {t.leaderboard.streakTitle}
                </Text>
                <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]} numberOfLines={1}>
                  {localStreak > 0 ? `Chuỗi ${localStreak} ngày liên tiếp` : t.leaderboard.streakSub}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  {t.leaderboard.streakBonus}
                </Text>
              </View>
              <Badge tone="fire">{myEntry ? `#${myEntry.rank}` : t.leaderboard.rank1}</Badge>
            </Card>

            {/* My rank snapshot + ELO */}
            {myEntry ? (
              <Card onPress={() => router.push('/profile')} style={[styles.myRank, { borderColor: palette.indigo }]}>
                <Ionicons name="person-circle" size={20} color={palette.indigo} />
                <Text style={[typography.caption, { color: palette.indigo, flex: 1, fontWeight: '700' }]} numberOfLines={1}>
                  Hạng #{myEntry.rank} · {eloTier.badge} {eloRating} ELO · Xem hồ sơ
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
                  {myEntry.scoreLabel}
                </Text>
              </Card>
            ) : null}

            {/* Recent Personal Battle History */}
            {battleHistory.length > 0 && (
              <Card style={{ marginBottom: spacing.md, padding: spacing.md }}>
                <Text style={[typography.label, { color: palette.indigo, marginBottom: 8 }]}>
                  LỊCH SỬ TRẬN ĐẤU GẦN ĐÂY ({battleHistory.length})
                </Text>
                {battleHistory.slice(0, 3).map((item) => (
                  <View
                    key={item.matchId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
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

            {/* Topic filter chips (Global only) */}
            {scope === 'global' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {TOPIC_CHIPS.map((chip) => (
                  <Pressable
                    key={chip.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: topicFilter === chip.key }}
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
                        { color: topicFilter === chip.key ? '#FFFFFF' : palette.inkMuted, fontWeight: '700' },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={[typography.title, { color: palette.ink, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              {scope === 'friends' ? 'Bảng xếp hạng bạn bè & đối thủ' : t.leaderboard.topPlayers}
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <ActivityIndicator size="large" color={palette.indigo} />
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
                Đang tải bảng xếp hạng...
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="trophy-outline" size={34} color={palette.inkMuted} />
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
                accessibilityRole="button"
                accessibilityLabel="Trang trước"
                accessibilityState={{ disabled: safePage === 0 }}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                style={[styles.pageBtn, { opacity: safePage === 0 ? 0.4 : 1, backgroundColor: palette.paperMuted }]}
              >
                <Ionicons name="chevron-back" size={18} color={palette.ink} />
              </Pressable>
              {Array.from({ length: totalPages }, (_, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Trang ${i + 1}`}
                  accessibilityState={{ selected: safePage === i }}
                  onPress={() => setPage(i)}
                  style={[
                    styles.pageBtn,
                    { backgroundColor: safePage === i ? palette.indigo : palette.paperMuted },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: safePage === i ? '#FFFFFF' : palette.inkMuted, fontWeight: '700' },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trang sau"
                accessibilityState={{ disabled: safePage >= totalPages - 1 }}
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  friendSearchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  friendInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.md },
  medal: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  myRank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    padding: spacing.sm,
  },
  chipScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#6366F1' },
  avatar: { fontSize: 18 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  miniAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pagination: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  pageBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
