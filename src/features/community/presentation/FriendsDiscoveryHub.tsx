import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { PapyrusPageSkeleton } from '@/shared/PapyrusLoader';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { dependencies } from '@/composition/dependencies';
import {
  fetchSuggestedScholarsForFriends,
  getOnlineScholarCandidates,
  subscribeOnlineScholars,
} from '@/composition/platform';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import {
  areUsersBlocked,
  areUsersFriends,
  computeIntelligentFriendRecommendations,
  isFollowingAccepted,
  matchesVietnameseSearch,
} from '@/features/social/domain/rankingAndPermissions';

/**
 * Intelligent Social Graph & Friends Discovery Hub (Sections 4.1, 4.3, 4.4):
 * - Searches & displays users STRICTLY by their main Profile Name (ZERO scholar codes!).
 * - Disambiguates same-name users via Avatar, Bio, Major/University, Location & Mutual Friends!
 * - Separates 1-Way Follow vs 2-Way Friend Requests (Accept / Reject / Cancel / Unfriend).
 * - Recommends people intelligently based on shared post topics, hashtags, communities & mutuals,
 *   with transparent explanation labels and Hide / Not Interested controls.
 * - Routes "Message / Nhắn tin" directly to the Dedicated Messaging Center (`/messages`).
 */
export const FriendsDiscoveryHub = memo(function FriendsDiscoveryHub({
  onOpenDirectChat,
}: {
  onOpenDirectChat?: (peer: { id: string; name: string }) => void;
}) {
  const router = useRouter();
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName ?? 'Thành viên Papyrus';

  const profilesById = useSocialStore((s) => s.profilesById);
  const posts = useSocialStore((s) => s.posts);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const communities = useSocialStore((s) => s.communities);
  const userSlices = useSocialStore((s) => s.userSlices);

  const ensureUserProfile = useSocialStore((s) => s.ensureUserProfile);
  const syncCloudDirectory = useSocialStore((s) => s.syncCloudDirectory);
  const toggleFollowUser = useSocialStore((s) => s.toggleFollowUser);
  const sendFriendRequest = useSocialStore((s) => s.sendFriendRequest);
  const respondFriendRequest = useSocialStore((s) => s.respondFriendRequest);
  const cancelOrUnfriend = useSocialStore((s) => s.cancelOrUnfriend);
  const dismissFriendRecommendation = useSocialStore((s) => s.dismissFriendRecommendation);
  const openOrCreateDirectConversation = useSocialStore((s) => s.openOrCreateDirectConversation);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [tab, setTab] = useState<'recommended' | 'requests' | 'friends' | 'following' | 'online'>('recommended');
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const syncPresence = () => {
      const list = getOnlineScholarCandidates(user?.id);
      setOnlineIds(new Set(list.map((i) => i.id)));
      list.forEach((cand) => {
        ensureUserProfile({
          id: cand.id,
          displayName: cand.displayName,
          avatarUrl: cand.avatarUrl,
        });
      });
    };
    syncPresence();
    return subscribeOnlineScholars(syncPresence);
  }, [ensureUserProfile, user?.id]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      syncCloudDirectory(),
      fetchSuggestedScholarsForFriends(user?.id).then((items) => {
        if (!active) return;
        items.forEach((it) => {
          ensureUserProfile({
            id: it.id,
            displayName: it.displayName,
            avatarUrl: it.avatarUrl,
          });
        });
      }),
    ]).finally(() => {
      if (active) setLoadingCloud(false);
    });
    return () => {
      active = false;
    };
  }, [ensureUserProfile, syncCloudDirectory, user?.id]);

  const runLiveNameSearch = useCallback(async () => {
    const clean = query.trim();
    if (clean.length < 2) return;
    setSearching(true);
    setNotice('');
    try {
      const remote = await dependencies.leaderboard.searchPlayers(clean);
      remote.forEach((cand) => {
        ensureUserProfile({
          id: cand.id,
          displayName: cand.displayName,
          avatarUrl: cand.avatarUrl,
        });
      });
      if (remote.length === 0) {
        const localHit = Object.values(useSocialStore.getState().profilesById).some(
          (p) => p.id !== viewerId && matchesVietnameseSearch(`${p.displayName} ${p.bio} ${p.major}`, clean)
        );
        if (!localHit) {
          setNotice(`Chưa tìm thấy người dùng có tên "${clean}". Hãy kiểm tra lại họ tên hoặc gửi liên kết mời bạn bè!`);
        }
      }
    } finally {
      setSearching(false);
    }
  }, [ensureUserProfile, query, viewerId]);

  const graph = useMemo(
    () => ({ follows, friendRequests, relations, communities }),
    [communities, follows, friendRequests, relations]
  );

  const allProfiles = useMemo(
    () => Object.values(profilesById).filter((p) => p.id !== viewerId && !areUsersBlocked(viewerId, p.id, graph)),
    [graph, profilesById, viewerId]
  );

  const viewerProfile = profilesById[viewerId];
  const dismissedIds = userSlices[viewerId]?.dismissedRecommendationIds ?? [];

  const recommendations = useMemo(
    () =>
      computeIntelligentFriendRecommendations({
        candidates: allProfiles,
        posts,
        viewerId,
        viewerInterests: viewerProfile?.interests ?? ['CNTT', 'AI', 'ÔnThi'],
        graph,
        dismissedUserIds: dismissedIds,
      }),
    [allProfiles, dismissedIds, graph, posts, viewerId, viewerProfile?.interests]
  );

  const incomingRequests = useMemo(
    () => friendRequests.filter((r) => r.receiverId === viewerId && r.status === 'pending'),
    [friendRequests, viewerId]
  );

  const twoWayFriends = useMemo(
    () => allProfiles.filter((p) => areUsersFriends(viewerId, p.id, graph)),
    [allProfiles, graph, viewerId]
  );

  const followingProfiles = useMemo(
    () => allProfiles.filter((p) => isFollowingAccepted(viewerId, p.id, graph)),
    [allProfiles, graph, viewerId]
  );

  const searchMatches = useMemo(() => {
    const clean = query.trim();
    if (clean.length < 2) return [];
    return allProfiles.filter((p) =>
      matchesVietnameseSearch(
        `${p.displayName} ${p.bio} ${p.major} ${p.university} ${p.interests.join(' ')}`,
        clean
      )
    );
  }, [allProfiles, query]);

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
      setNotice(`✅ Đã sao chép Liên kết Kết bạn của ${user.displayName}!`);
      return;
    }
    await Share.share({
      message: `Kết bạn với ${user.displayName} trên mạng xã hội Papyrus: ${url}`,
    }).catch(() => undefined);
  };

  const openDirectMessage = (peerId: string, peerName: string, peerAvatar: string | null) => {
    if (!user || viewerId === 'guest') {
      setNotice('Vui lòng đăng nhập để nhắn tin trực tiếp.');
      return;
    }
    if (onOpenDirectChat) {
      onOpenDirectChat({ id: peerId, name: peerName });
      return;
    }
    const conv = openOrCreateDirectConversation(
      { id: viewerId, name: viewerName, avatar: user?.avatarUrl ?? null },
      { id: peerId, name: peerName, avatar: peerAvatar }
    );
    if (!conv) return;
    router.push({ pathname: '/messages', params: { conversationId: conv.id } });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {/* Search by Main Profile Name Card */}
      <Card style={{ gap: 10, borderColor: palette.indigoBorder, borderWidth: 1.5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Badge tone="primary">KẾT NỐI BẠN BÈ</Badge>
            <Text style={[typography.title, { color: palette.ink, marginTop: 4 }]}>
              Tìm bạn bè theo tên hiển thị
            </Text>
          </View>
          {user ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void shareInviteLink()}
              style={[styles.inviteBtn, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
            >
              <AppIcon name="share-social-outline" size={15} color={palette.indigo} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                Chia sẻ liên kết của {user.displayName}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
            <AppIcon name="search-outline" size={18} color={palette.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runLiveNameSearch()}
              returnKeyType="search"
              placeholder="Nhập tên hiển thị, chuyên ngành hoặc trường học..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.searchInput, { color: palette.ink }]}
            />
            {query.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Bỏ chọn" onPress={() => setQuery('')}>
                <AppIcon name="close-circle" size={18} color={palette.inkMuted} />
              </Pressable>
            ) : null}
          </View>
          <Button icon="search" disabled={searching || query.trim().length < 2} onPress={() => void runLiveNameSearch()}>
            {searching ? 'Đang tìm…' : 'Tìm'}
          </Button>
        </View>

        {!!notice && (
          <View style={[styles.noticeBanner, { backgroundColor: palette.indigoTint }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigoDeep }}>{notice}</Text>
          </View>
        )}

        {/* Social Graph Tabs */}
        {query.trim().length < 2 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                { id: 'recommended', label: `Gợi ý (${recommendations.length})` },
                { id: 'requests', label: `Lời mời (${incomingRequests.length})` },
                { id: 'friends', label: `Bạn bè (${twoWayFriends.length})` },
                { id: 'following', label: `Đang theo dõi (${followingProfiles.length})` },
                { id: 'online', label: 'Trực tuyến' },
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
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: active ? palette.onPrimary : palette.ink }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      {/* Incoming Friend Requests Tab */}
      {query.trim().length < 2 && tab === 'requests' && (
        <View style={{ gap: 8 }}>
          {incomingRequests.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Text style={{ color: palette.inkMuted, fontSize: 13 }}>Hiện không có lời mời kết bạn nào đang chờ.</Text>
            </Card>
          ) : (
            incomingRequests.map((req) => {
              const sender = profilesById[req.senderId];
              const name = sender?.displayName || 'Thành viên Papyrus';
              return (
                <Card key={req.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: req.senderId } })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink }}>{name}</Text>
                    <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                      {sender?.bio || 'Đã gửi lời mời kết bạn hai chiều cho bạn'}
                    </Text>
                  </Pressable>
                  <Button
                    onPress={() => {
                      respondFriendRequest(req.id, true);
                      void dependencies.leaderboard.addFriend(req.senderId).catch(() => undefined);
                    }}
                  >
                    Chấp nhận
                  </Button>
                  <Button variant="secondary" onPress={() => respondFriendRequest(req.id, false)}>
                    Từ chối
                  </Button>
                </Card>
              );
            })
          )}
        </View>
      )}

      {/* Main Directory / Intelligent Recommendations Grid */}
      {loadingCloud || searching ? (
        <PapyrusPageSkeleton variant="leaderboard" label="Đang đồng bộ danh bạ mạng xã hội…" />
      ) : (
        <View style={styles.cardsGrid}>
          {(query.trim().length >= 2
            ? searchMatches.map((profile) => ({
                profile,
                reasonLabel: profile.bio || profile.major || 'Khớp kết quả tìm kiếm tên Profile',
              }))
            : tab === 'recommended'
            ? recommendations
            : tab === 'friends'
            ? twoWayFriends.map((profile) => ({ profile, reasonLabel: 'Bạn bè hai chiều trên Papyrus' }))
            : tab === 'following'
            ? followingProfiles.map((profile) => ({ profile, reasonLabel: 'Tài khoản bạn đang theo dõi' }))
            : tab === 'online'
            ? allProfiles
                .filter((p) => onlineIds.has(p.id) || p.isOnline)
                .map((profile) => ({ profile, reasonLabel: 'Đang trực tuyến ngay lúc này' }))
            : []
          ).map(({ profile, reasonLabel }) => {
            const isFriend = areUsersFriends(viewerId, profile.id, graph);
            const isFollowing = isFollowingAccepted(viewerId, profile.id, graph);
            const pendingSent = friendRequests.some(
              (r) => r.senderId === viewerId && r.receiverId === profile.id && r.status === 'pending'
            );
            const isOnline = onlineIds.has(profile.id) || Boolean(profile.isOnline);

            return (
              <Card key={profile.id} style={styles.peerCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: profile.id } })}
                    style={{ position: 'relative' }}
                  >
                    {profile.avatarUrl ? (
                      <Image source={{ uri: profile.avatarUrl }} style={styles.peerAvatar} />
                    ) : (
                      <View
                        style={[
                          styles.peerAvatar,
                          { backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '900' }}>
                          {(profile.displayName[0] || 'P').toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isOnline && profile.privacy.showOnlineStatus && <View style={styles.onlineDot} />}
                  </Pressable>

                  <Pressable
                    onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: profile.id } })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                      {profile.displayName}
                    </Text>
                    {/* Disambiguation context for same-name users (Avatar + Bio + Major + Location!) */}
                    {(profile.major || profile.locationArea) && (
                      <Text style={{ fontSize: 11.5, color: palette.inkMuted, marginTop: 1 }} numberOfLines={1}>
                        {[profile.major, profile.university, profile.locationArea].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {profile.bio ? (
                      <Text style={{ fontSize: 11.5, color: palette.ink, marginTop: 3 }} numberOfLines={2}>
                        {profile.bio}
                      </Text>
                    ) : null}
                    <Text style={{ fontSize: 11, fontWeight: '600', color: palette.indigo, marginTop: 4 }} numberOfLines={1}>
                      {reasonLabel}
                    </Text>
                  </Pressable>

                  {tab === 'recommended' && query.trim().length < 2 && (
                    <Pressable
                      accessibilityLabel="Ẩn gợi ý này"
                      onPress={() => dismissFriendRecommendation(viewerId, profile.id)}
                      hitSlop={8}
                    >
                      <AppIcon name="close" size={18} color={palette.inkMuted} />
                    </Pressable>
                  )}
                </View>

                <View style={styles.peerActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!user || viewerId === 'guest') {
                        setNotice('Vui lòng đăng nhập để theo dõi thành viên.');
                        return;
                      }
                      toggleFollowUser(viewerId, profile.id);
                    }}
                    style={[
                      styles.peerBtn,
                      {
                        backgroundColor: isFollowing ? palette.paper : palette.indigoTint,
                        borderColor: palette.indigo,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                      {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      if (!user || viewerId === 'guest') {
                        setNotice('Vui lòng đăng nhập để gửi lời mời kết bạn.');
                        return;
                      }
                      if (isFriend || pendingSent) {
                        cancelOrUnfriend(viewerId, profile.id);
                      } else {
                        sendFriendRequest(viewerId, profile.id);
                        void dependencies.leaderboard.addFriend(profile.id).catch(() => undefined);
                        setNotice(`Đã gửi lời mời kết bạn tới ${profile.displayName}.`);
                      }
                    }}
                    style={[
                      styles.peerBtn,
                      {
                        backgroundColor: isFriend ? palette.mintTint : pendingSent ? palette.paper : palette.indigo,
                        borderColor: isFriend ? palette.mint : palette.indigo,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: isFriend ? palette.mint : pendingSent ? palette.inkMuted : palette.onPrimary,
                      }}
                    >
                      {isFriend ? 'Bạn bè' : pendingSent ? 'Đã gửi lời mời' : 'Kết bạn'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openDirectMessage(profile.id, profile.displayName, profile.avatarUrl)}
                    style={[styles.peerBtn, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <AppIcon name="chatbubble-ellipses-outline" size={14} color={palette.indigo} />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>Nhắn tin</Text>
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
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13.5, paddingVertical: 8 },
  noticeBanner: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  filterPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1 },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  peerCard: { flexGrow: 1, flexBasis: 290, minWidth: 260, gap: 10 },
  peerAvatar: { width: 48, height: 48, borderRadius: 24 },
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
  peerActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  peerBtn: {
    flex: 1,
    minWidth: 78,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
});
