import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { PapyrusPageSkeleton } from '@/shared/PapyrusLoader';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useCommunityStore } from '../state/useCommunityStore';
import { dependencies } from '@/composition/dependencies';
import {
  fetchSuggestedScholarsForFriends,
  formatScholarCode,
  getOnlineScholarCandidates,
  subscribeOnlineScholars,
} from '@/composition/platform';
import type { FriendSearchCandidate } from '@/features/leaderboard/domain/repository';

/**
 * Dedicated Social Network Friends Discovery & Directory Hub
 * (Cleanly separated from the Competitive Ranking Leaderboard!)
 */
export const FriendsDiscoveryHub = memo(function FriendsDiscoveryHub({
  onOpenDirectChat,
}: {
  onOpenDirectChat?: (peer: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const followingIds = useCommunityStore((s) => s.followingAuthorIds);
  const toggleFollow = useCommunityStore((s) => s.toggleFollowAuthor);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [tab, setTab] = useState<'discover' | 'connected' | 'online'>('discover');
  const [suggested, setSuggested] = useState<FriendSearchCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<FriendSearchCandidate[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const syncPresence = () => {
      const list = getOnlineScholarCandidates(user?.id);
      setOnlineIds(new Set(list.map((i) => i.id)));
    };
    syncPresence();
    return subscribeOnlineScholars(syncPresence);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setLoadingSuggestions(true);
    void fetchSuggestedScholarsForFriends(user?.id)
      .then((items) => {
        if (active) setSuggested(items);
      })
      .finally(() => {
        if (active) setLoadingSuggestions(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const runSearch = useCallback(async () => {
    const clean = query.trim();
    if (clean.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setNotice('');
    try {
      const res = await dependencies.leaderboard.searchPlayers(clean);
      setSearchResults(res);
      if (res.length === 0) {
        setNotice(`Chưa tìm thấy học giả khớp với "${clean}". Hãy thử tìm theo Mã PAPY-XXXXXX hoặc sao chép Link mời bên dưới!`);
      }
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleConnectFriend = async (peer: FriendSearchCandidate) => {
    setAddingId(peer.id);
    setNotice('');
    try {
      const isAlreadyConnected = followingIds.includes(peer.id);
      toggleFollow(peer.id);
      if (!isAlreadyConnected && user) {
        await dependencies.leaderboard.addFriend(peer.id).catch(() => undefined);
        setNotice(`✅ Đã kết bạn với ${peer.displayName}! Giờ hai bạn có thể nhắn tin 1-1 ngay.`);
      } else if (isAlreadyConnected) {
        setNotice(`Đã hủy theo dõi ${peer.displayName}.`);
      }
    } finally {
      setAddingId(null);
    }
  };

  const shareInviteLink = async () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://papyrus-lyart-five.vercel.app';
    const url = `${origin}/friends?addFriend=${user.id}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice(`✅ Đã sao chép Link Kết Bạn (${formatScholarCode(user.id)}) vào bộ nhớ tạm!`);
      return;
    }
    await Share.share({
      message: `Kết bạn học tập với ${user.displayName} trên Papyrus (${formatScholarCode(user.id)}): ${url}`,
    }).catch(() => undefined);
  };

  const baseList = query.trim().length >= 2 ? searchResults : suggested;

  const displayedList = useMemo(() => {
    if (query.trim().length >= 2) return baseList;
    if (tab === 'connected') {
      return baseList.filter((item) => followingIds.includes(item.id));
    }
    if (tab === 'online') {
      return baseList.filter((item) => onlineIds.has(item.id));
    }
    return baseList;
  }, [baseList, followingIds, onlineIds, query, tab]);

  const connectedCount = useMemo(
    () => suggested.filter((i) => followingIds.includes(i.id)).length,
    [followingIds, suggested]
  );

  return (
    <View style={{ gap: spacing.md }}>
      {/* Social Search & Invite Header Card */}
      <Card style={{ gap: 10, borderColor: palette.indigoBorder, borderWidth: 1.5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Badge tone="primary">👥 MẠNG LƯỚI HỌC GIẢ & BẠN BÈ</Badge>
            <Text style={[typography.title, { color: palette.ink, marginTop: 4 }]}>
              Tìm Bạn Học & Kết Nối Đồng Môn
            </Text>
          </View>
          {user ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void shareInviteLink()}
              style={[styles.inviteCodeBtn, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
            >
              <Ionicons name="link-outline" size={15} color={palette.indigo} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                {formatScholarCode(user.id)} · Sao chép Link mời
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
            <Ionicons name="search-outline" size={18} color={palette.inkMuted} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                if (!v.trim()) setSearchResults([]);
              }}
              onSubmitEditing={() => void runSearch()}
              returnKeyType="search"
              placeholder="Tìm tên thật, email, Mã PAPY-XXXXXX..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.searchInput, { color: palette.ink }]}
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </View>
          <Button icon="search" disabled={searching || query.trim().length < 2} onPress={() => void runSearch()}>
            {searching ? 'Đang tìm…' : 'Tìm'}
          </Button>
        </View>

        {!!notice && (
          <View style={[styles.noticeBanner, { backgroundColor: palette.indigoTint }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigoDeep }}>{notice}</Text>
          </View>
        )}

        {/* Sub-Filter Tabs */}
        {query.trim().length < 2 && (
          <View style={styles.filterPillsRow}>
            {(
              [
                { id: 'discover', label: `✨ Gợi ý kết bạn (${suggested.length})` },
                { id: 'connected', label: `🤝 Đã kết nối (${connectedCount})` },
                { id: 'online', label: `🟢 Trực tuyến (${onlineIds.size})` },
              ] as const
            ).map((f) => {
              const active = tab === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setTab(f.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: active ? palette.indigo : palette.paper,
                      borderColor: active ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: active ? '#FFFFFF' : palette.ink,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* Results / Suggested Scholars Grid */}
      {loadingSuggestions || searching ? (
        <PapyrusPageSkeleton variant="leaderboard" label="Đang tải danh bạ học giả…" />
      ) : displayedList.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: 8 }}>
          <Ionicons name="people-outline" size={34} color={palette.inkMuted} />
          <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center' }]}>
            {tab === 'online'
              ? 'Chưa có bạn học nào khác trực tuyến ngay giây phút này. Chuyển sang mục «Gợi ý kết bạn» để kết nối trước nhé!'
              : tab === 'connected'
              ? 'Bạn chưa kết bạn với học giả nào. Bấm «Kết bạn» ở danh sách gợi ý để bắt đầu trò chuyện!'
              : 'Nhập tên hoặc sao chép Link mời bạn bè cùng tham gia Papyrus!'}
          </Text>
        </Card>
      ) : (
        <View style={styles.cardsGrid}>
          {displayedList.map((peer) => {
            const isFriend = followingIds.includes(peer.id);
            const isOnline = onlineIds.has(peer.id);
            const initial = (peer.displayName.trim()[0] || 'H').toUpperCase();
            return (
              <Card key={peer.id} style={styles.peerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ position: 'relative' }}>
                    {peer.avatarUrl ? (
                      <Image source={{ uri: peer.avatarUrl }} style={styles.peerAvatar} />
                    ) : (
                      <View style={[styles.peerAvatar, { backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>{initial}</Text>
                      </View>
                    )}
                    {isOnline && <View style={styles.onlineDot} />}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                      {peer.displayName}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
                      {isOnline ? '🟢 Đang hoạt động · ' : ''}
                      {peer.eloRating} ELO · {peer.totalScore.toLocaleString('vi-VN')} XP
                    </Text>
                  </View>
                </View>

                <View style={styles.peerActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={addingId === peer.id}
                    onPress={() => void handleConnectFriend(peer)}
                    style={[
                      styles.peerBtn,
                      {
                        backgroundColor: isFriend ? palette.mintTint : palette.indigo,
                        borderColor: isFriend ? palette.mint : palette.indigo,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isFriend ? 'checkmark-circle' : 'person-add'}
                      size={15}
                      color={isFriend ? palette.mint : '#FFFFFF'}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: isFriend ? palette.mint : '#FFFFFF',
                      }}
                    >
                      {isFriend ? 'Bạn bè' : 'Kết bạn'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (onOpenDirectChat) {
                        onOpenDirectChat({ id: peer.id, name: peer.displayName });
                      } else {
                        router.push({
                          pathname: '/community',
                          params: { tab: 'messenger', dmUserId: peer.id, dmName: peer.displayName },
                        });
                      }
                    }}
                    style={[
                      styles.peerBtn,
                      {
                        backgroundColor: palette.paper,
                        borderColor: palette.paperMuted,
                      },
                    ]}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={palette.indigo} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>Nhắn tin</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  inviteCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 8,
  },
  noticeBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  cardsGrid: {
    gap: 10,
  },
  peerCard: {
    gap: 12,
    padding: spacing.md,
  },
  peerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  peerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  peerBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
});
