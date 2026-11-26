import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { isStoryActive24h, type ScholarStory } from '@/features/community/domain/models';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { StoryCard916 } from '@/features/community/presentation/StoryCard916';
import { StoryViewerModal } from '@/features/community/presentation/StoryModalViewer';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import {
  areUsersBlocked,
  areUsersFriends,
  canViewerAccessPost,
  projectSafePostForViewer,
} from '@/features/social/domain/rankingAndPermissions';
import { MetaThreadsPostCard } from '@/features/social/presentation/MetaThreadsPostCard';

type UserProfileTab = 'posts' | 'replies' | 'reposts' | 'media' | 'pinned' | 'communities';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const palette = usePalette();
  const me = useAuthStore((s) => s.user);
  const viewerId = me?.id ?? 'guest';
  const isGuest = !me || viewerId === 'guest';
  const viewerName = me?.displayName ?? 'Khách';

  const stories = useCommunityStore((s) => s.stories);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);
  const reactToStory = useCommunityStore((s) => s.reactToStory);
  const [nowMs] = useState(() => Date.now());
  const [viewingStoryGroup, setViewingStoryGroup] = useState<ScholarStory[] | null>(null);

  const profilesById = useSocialStore((s) => s.profilesById);
  const posts = useSocialStore((s) => s.posts);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const userSlices = useSocialStore((s) => s.userSlices);

  const incrementProfileView = useSocialStore((s) => s.incrementProfileView);
  const toggleFollowUser = useSocialStore((s) => s.toggleFollowUser);
  const toggleCloseFriend = useSocialStore((s) => s.toggleCloseFriend);
  const sendFriendRequest = useSocialStore((s) => s.sendFriendRequest);
  const respondFriendRequest = useSocialStore((s) => s.respondFriendRequest);
  const cancelOrUnfriend = useSocialStore((s) => s.cancelOrUnfriend);
  const toggleUserRelation = useSocialStore((s) => s.toggleUserRelation);
  const submitModerationReport = useSocialStore((s) => s.submitModerationReport);
  const openOrCreateDirectConversation = useSocialStore((s) => s.openOrCreateDirectConversation);

  const togglePostEmojiReaction = useSocialStore((s) => s.togglePostEmojiReaction);
  const togglePureRepost = useSocialStore((s) => s.togglePureRepost);
  const toggleSaveBookmark = useSocialStore((s) => s.toggleSaveBookmark);
  const toggleFavouritePost = useSocialStore((s) => s.toggleFavouritePost);
  const togglePinPost = useSocialStore((s) => s.togglePinPost);
  const editSocialPost = useSocialStore((s) => s.editSocialPost);
  const deleteOrArchivePost = useSocialStore((s) => s.deleteOrArchivePost);
  const summarizePostWithAi = useSocialStore((s) => s.summarizePostWithAi);
  const voteUnifiedPoll = useSocialStore((s) => s.voteUnifiedPoll);
  const addUnifiedPollOption = useSocialStore((s) => s.addUnifiedPollOption);
  const toggleCloseUnifiedPoll = useSocialStore((s) => s.toggleCloseUnifiedPoll);
  const voteDebateSide = useSocialStore((s) => s.voteDebateSide);
  const addDebateArgument = useSocialStore((s) => s.addDebateArgument);
  const addThreadedReply = useSocialStore((s) => s.addThreadedReply);
  const editOrDeleteComment = useSocialStore((s) => s.editOrDeleteComment);
  const toggleCommentReaction = useSocialStore((s) => s.toggleCommentReaction);
  const togglePinComment = useSocialStore((s) => s.togglePinComment);
  const sharePostToDestination = useSocialStore((s) => s.sharePostToDestination);
  const updateYourAlgo = useSocialStore((s) => s.updateYourAlgo);

  const [tab, setTab] = useState<UserProfileTab>('posts');
  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [connectionsModal, setConnectionsModal] = useState<
    'followers' | 'following' | 'friends' | null
  >(null);
  const [notice, setNotice] = useState('');

  const ensureAuth = () => {
    if (!isGuest) return true;
    setNotice('Vui lòng đăng nhập để thực hiện thao tác này.');
    return false;
  };

  useEffect(() => {
    if (userId && userId === viewerId) {
      router.replace('/profile');
      return;
    }
    if (userId && !isGuest) {
      incrementProfileView(userId, viewerId);
    }
  }, [incrementProfileView, isGuest, router, userId, viewerId]);

  const targetProfile = userId ? profilesById[userId] : undefined;
  const graph = useMemo(
    () => ({ follows, friendRequests, relations, communities }),
    [communities, follows, friendRequests, relations]
  );

  const blocked = Boolean(userId && areUsersBlocked(viewerId, userId, graph));
  const isMuted = relations.some(
    (r) => r.actorId === viewerId && r.targetId === userId && r.type === 'mute'
  );
  const isRestricted = relations.some(
    (r) => r.actorId === viewerId && r.targetId === userId && r.type === 'restrict'
  );

  const followEdge = follows.find(
    (f) => f.followerId === viewerId && f.followingId === userId
  );
  const isFollowing = followEdge?.status === 'accepted';
  const isFollowRequested = followEdge?.status === 'pending';
  const isCloseFriend = Boolean(followEdge?.isCloseFriend);

  const friendReq = friendRequests.find(
    (r) =>
      ((r.senderId === viewerId && r.receiverId === userId) ||
        (r.senderId === userId && r.receiverId === viewerId)) &&
      (r.status === 'pending' || r.status === 'accepted')
  );
  const isTwoWayFriend = areUsersFriends(viewerId, userId || '', graph);

  const canSeePrivateContent =
    !targetProfile?.privacy.isPrivateAccount ||
    isFollowing ||
    isTwoWayFriend ||
    userId === viewerId;

  const targetFollowers = useMemo(
    () =>
      follows
        .filter((f) => f.followingId === userId && f.status === 'accepted')
        .map((f) => f.followerId),
    [follows, userId]
  );
  const targetFollowing = useMemo(
    () =>
      follows
        .filter((f) => f.followerId === userId && f.status === 'accepted')
        .map((f) => f.followingId),
    [follows, userId]
  );
  const targetFriends = useMemo(
    () =>
      friendRequests
        .filter(
          (r) => r.status === 'accepted' && (r.senderId === userId || r.receiverId === userId)
        )
        .map((r) => (r.senderId === userId ? r.receiverId : r.senderId)),
    [friendRequests, userId]
  );

  const myFriendsSet = useMemo(() => {
    const s = new Set<string>();
    friendRequests.forEach((r) => {
      if (r.status !== 'accepted') return;
      if (r.senderId === viewerId) s.add(r.receiverId);
      if (r.receiverId === viewerId) s.add(r.senderId);
    });
    return s;
  }, [friendRequests, viewerId]);

  const mutualFriendsCount = useMemo(
    () => targetFriends.filter((fid) => myFriendsSet.has(fid)).length,
    [myFriendsSet, targetFriends]
  );

  // Strictly this user's own active 24h stories and pinned profile stories
  const targetActiveStories = useMemo(
    () =>
      userId
        ? stories
            .filter((s) => s.authorId === userId && isStoryActive24h(s, nowMs))
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        : [],
    [nowMs, stories, userId]
  );
  const targetPinnedStories = useMemo(
    () =>
      userId
        ? stories
            .filter(
              (s) =>
                s.authorId === userId && Boolean(s.pinnedOnProfile ?? s.isHighlight)
            )
            .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        : [],
    [stories, userId]
  );

  const visibleAuthorPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          !p.isAnonymous &&
          p.authorId === userId &&
          canViewerAccessPost(p, viewerId, graph)
      ),
    [graph, posts, userId, viewerId]
  );

  const repostedPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          Boolean(userId && p.repostedByIds.includes(userId)) &&
          canViewerAccessPost(p, viewerId, graph)
      ),
    [graph, posts, userId, viewerId]
  );

  const userReplies = useMemo(
    () =>
      posts.flatMap((p) =>
        canViewerAccessPost(p, viewerId, graph)
          ? p.comments
              .filter((c) => c.authorId === userId)
              .map((c) => ({ comment: c, parentPost: p }))
          : []
      ),
    [graph, posts, userId, viewerId]
  );

  const joinedCommunities = useMemo(
    () =>
      communities.filter(
        (c) => c.visibility !== 'hidden' && c.members.some((m) => m.userId === userId)
      ),
    [communities, userId]
  );

  const slice = userSlices[viewerId];

  if (!targetProfile || blocked) {
    return (
      <Screen bottomNav>
        <TopBar title="Trang cá nhân" />
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: 10 }}>
          <Ionicons name="person-remove-outline" size={40} color={palette.inkMuted} />
          <Text style={[typography.title, { color: palette.ink }]}>
            Không thể truy cập trang cá nhân
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}>
            {blocked
              ? 'Tài khoản này đang nằm trong danh sách chặn của bạn.'
              : 'Hồ sơ người dùng không tồn tại hoặc đã bị vô hiệu hóa.'}
          </Text>
          {blocked && userId && !isGuest ? (
            <Button
              variant="secondary"
              onPress={() => toggleUserRelation(viewerId, userId, 'block')}
            >
              Bỏ chặn tài khoản
            </Button>
          ) : null}
        </Card>
      </Screen>
    );
  }

  const shareProfileUrl = async () => {
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://papyrus-lyart-five.vercel.app';
    const url = `${origin}/user/${targetProfile.id}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice('Đã sao chép liên kết trang cá nhân.');
    } else {
      await Share.share({
        message: `${targetProfile.displayName} trên Papyrus: ${url}`,
      }).catch(() => undefined);
    }
  };

  return (
    <Screen bottomNav>
      <TopBar
        title={targetProfile.displayName}
        action={
          !isGuest ? (
            <Pressable onPress={() => setSafetyModalOpen(true)} style={{ padding: 6 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color={palette.ink} />
            </Pressable>
          ) : undefined
        }
      />

      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: spacing.md }}>
        <View style={[styles.coverBanner, { backgroundColor: palette.indigo }]}>
          {targetProfile.coverUrl ? (
            <Image
              source={{ uri: targetProfile.coverUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
        </View>

        <View style={{ padding: spacing.md, marginTop: -36 }}>
          <View style={[styles.avatarWrap, { borderColor: palette.paperRaised }]}>
            {targetProfile.avatarUrl ? (
              <Image source={{ uri: targetProfile.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View
                style={[
                  styles.avatarImg,
                  {
                    backgroundColor: palette.indigo,
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Text style={{ color: palette.onPrimary, fontSize: 28, fontWeight: '800' }}>
                  {(targetProfile.displayName[0] || 'U').toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            <Text style={[typography.heading, { color: palette.ink }]}>
              {targetProfile.displayName}
            </Text>
            {targetProfile.privacy.isPrivateAccount ? (
              <Badge tone="neutral">Riêng tư</Badge>
            ) : null}
            {targetProfile.badges.map((b) => (
              <Badge key={b} tone="primary">
                {b}
              </Badge>
            ))}
          </View>

          {targetProfile.bio ? (
            <Text style={[typography.body, { color: palette.ink, marginTop: 6, lineHeight: 21 }]}>
              {targetProfile.bio}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {targetProfile.major ? (
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>{targetProfile.major}</Text>
            ) : null}
            {targetProfile.university ? (
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                {targetProfile.university}
              </Text>
            ) : null}
            {targetProfile.locationArea ? (
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                {targetProfile.locationArea}
              </Text>
            ) : null}
          </View>

          {targetProfile.interests.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {targetProfile.interests.map((topic) => (
                <Badge key={topic} tone="neutral">
                  #{topic}
                </Badge>
              ))}
            </View>
          ) : null}

          {/* Real Social Graph Counters (0 when 0 friends/followers) */}
          <View style={styles.statsRow}>
            <Pressable onPress={() => setConnectionsModal('followers')}>
              <Text style={{ fontSize: 13, color: palette.ink }}>
                <Text style={{ fontWeight: '800' }}>{targetFollowers.length}</Text> Người theo dõi
              </Text>
            </Pressable>
            <Pressable onPress={() => setConnectionsModal('following')}>
              <Text style={{ fontSize: 13, color: palette.ink }}>
                <Text style={{ fontWeight: '800' }}>{targetFollowing.length}</Text> Đang theo dõi
              </Text>
            </Pressable>
            <Pressable onPress={() => setConnectionsModal('friends')}>
              <Text style={{ fontSize: 13, color: palette.ink }}>
                <Text style={{ fontWeight: '800' }}>{targetFriends.length}</Text> Bạn bè
              </Text>
            </Pressable>
            {mutualFriendsCount > 0 ? (
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.indigo }}>
                · {mutualFriendsCount} bạn chung
              </Text>
            ) : null}
          </View>

          {notice ? (
            <Text
              style={{ fontSize: 12, fontWeight: '700', color: palette.indigo, marginTop: 6 }}
            >
              {notice}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Button
              variant={isFollowing || isFollowRequested ? 'secondary' : 'primary'}
              icon={isFollowing ? 'checkmark-circle' : 'add-circle-outline'}
              onPress={() => {
                if (!ensureAuth()) return;
                const res = toggleFollowUser(viewerId, targetProfile.id);
                setNotice(
                  res === 'requested'
                    ? 'Đã gửi yêu cầu theo dõi.'
                    : res === 'followed'
                    ? `Đang theo dõi ${targetProfile.displayName}.`
                    : `Đã bỏ theo dõi ${targetProfile.displayName}.`
                );
              }}
            >
              {isFollowing ? 'Đang theo dõi' : isFollowRequested ? 'Đã yêu cầu' : 'Theo dõi'}
            </Button>

            {isTwoWayFriend ? (
              <Button
                variant="secondary"
                icon="people"
                onPress={() => {
                  if (!ensureAuth()) return;
                  cancelOrUnfriend(viewerId, targetProfile.id);
                }}
              >
                Bạn bè (Hủy)
              </Button>
            ) : friendReq?.status === 'pending' && friendReq.senderId === viewerId ? (
              <Button
                variant="secondary"
                icon="close-circle-outline"
                onPress={() => cancelOrUnfriend(viewerId, targetProfile.id)}
              >
                Hủy lời mời
              </Button>
            ) : friendReq?.status === 'pending' && friendReq.receiverId === viewerId ? (
              <Button
                variant="primary"
                icon="person-add"
                onPress={() => respondFriendRequest(friendReq.id, true)}
              >
                Chấp nhận kết bạn
              </Button>
            ) : (
              <Button
                variant="secondary"
                icon="person-add-outline"
                onPress={() => {
                  if (!ensureAuth()) return;
                  sendFriendRequest(viewerId, targetProfile.id);
                  setNotice(`Đã gửi lời mời kết bạn tới ${targetProfile.displayName}.`);
                }}
              >
                Kết bạn
              </Button>
            )}

            <Button
              variant="secondary"
              icon="chatbubble-ellipses-outline"
              onPress={() => {
                if (!ensureAuth()) return;
                const conv = openOrCreateDirectConversation(
                  { id: viewerId, name: viewerName, avatar: me?.avatarUrl ?? null },
                  {
                    id: targetProfile.id,
                    name: targetProfile.displayName,
                    avatar: targetProfile.avatarUrl,
                  }
                );
                if (!conv) return;
                router.push({ pathname: '/messages', params: { conversationId: conv.id } });
              }}
            >
              Nhắn tin
            </Button>

            <Pressable
              accessibilityLabel="Chia sẻ trang cá nhân"
              onPress={() => void shareProfileUrl()}
              style={[
                styles.iconBtn,
                { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
              ]}
            >
              <Ionicons name="share-social-outline" size={18} color={palette.ink} />
            </Pressable>
          </View>

          {/* User's Own Grouped 24h Story Box & Pinned Highlight Box */}
          {canSeePrivateContent &&
          (targetActiveStories.length > 0 || targetPinnedStories.length > 0) ? (
            <View style={{ marginTop: spacing.md, gap: 6 }}>
              <Text style={[typography.label, { color: palette.inkMuted }]}>
                TIN 24 GIỜ & TIN ĐÃ GẮN
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {targetActiveStories.length > 0 ? (
                  <StoryCard916
                    story={targetActiveStories[targetActiveStories.length - 1]!}
                    totalCount={targetActiveStories.length}
                    customLabel="Tin 24h"
                    seen={targetActiveStories.every((s) => s.viewedByIds.includes(viewerId))}
                    onPress={() => setViewingStoryGroup(targetActiveStories)}
                  />
                ) : null}

                {targetPinnedStories.length > 0 ? (
                  <StoryCard916
                    story={targetPinnedStories[targetPinnedStories.length - 1]!}
                    totalCount={targetPinnedStories.length}
                    customLabel="Tin đã gắn"
                    seen={targetPinnedStories.every((s) => s.viewedByIds.includes(viewerId))}
                    onPress={() => setViewingStoryGroup(targetPinnedStories)}
                  />
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsStrip, { borderTopColor: palette.paperMuted }]}
        >
          {(
            [
              { id: 'posts', label: `Bài viết (${visibleAuthorPosts.length})` },
              { id: 'replies', label: `Phản hồi (${userReplies.length})` },
              { id: 'reposts', label: `Đăng lại (${repostedPosts.length})` },
              { id: 'media', label: 'Ảnh & Video' },
              { id: 'pinned', label: 'Đã ghim' },
              { id: 'communities', label: `Nhóm (${joinedCommunities.length})` },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tabItem,
                tab === t.id && { borderBottomColor: palette.indigo, borderBottomWidth: 2.5 },
              ]}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: tab === t.id ? palette.indigo : palette.inkMuted,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      {!canSeePrivateContent ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: 8 }}>
          <Ionicons name="lock-closed" size={32} color={palette.indigo} />
          <Text style={[typography.title, { color: palette.ink }]}>
            Tài khoản này ở chế độ riêng tư
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}>
            Gửi yêu cầu theo dõi hoặc kết bạn với {targetProfile.displayName} để xem bài viết.
          </Text>
        </Card>
      ) : tab === 'posts' || tab === 'reposts' || tab === 'pinned' ? (
        (tab === 'posts'
          ? visibleAuthorPosts
          : tab === 'reposts'
          ? repostedPosts
          : visibleAuthorPosts.filter((p) => p.isPinnedProfile)
        ).map((post) => (
          <MetaThreadsPostCard
            key={post.id}
            post={projectSafePostForViewer(post, viewerId, false)}
            viewerId={viewerId}
            viewerName={viewerName}
            viewerAvatar={me?.avatarUrl ?? null}
            isSavedBookmark={Boolean(slice?.bookmarkedPostIds.includes(post.id))}
            isFavourited={Boolean(slice?.favouritePostIds.includes(post.id))}
            isFollowingAuthor={isFollowing}
            profilesById={profilesById}
            graph={graph}
            collections={slice?.collections ?? []}
            conversations={conversations}
            communities={communities}
            onToggleFollow={(tid) => {
              if (!ensureAuth()) return;
              toggleFollowUser(viewerId, tid);
            }}
            onReactPost={(pid, rx) => {
              if (!ensureAuth()) return;
              togglePostEmojiReaction(pid, rx, viewerId);
            }}
            onTogglePureRepost={(pid) => {
              if (!ensureAuth()) return;
              togglePureRepost(pid, viewerId);
            }}
            onOpenQuoteComposer={() =>
              router.push({ pathname: '/post/[postId]', params: { postId: post.id } })
            }
            onToggleBookmark={(pid, colId) => toggleSaveBookmark(viewerId, pid, colId)}
            onToggleFavourite={(pid) => toggleFavouritePost(viewerId, pid)}
            onTogglePin={(pid, sc) => togglePinPost(pid, sc)}
            onEditPost={(pid, parts, lf) => editSocialPost(pid, viewerId, parts, lf)}
            onDeleteOrArchive={(pid, mode) => deleteOrArchivePost(pid, viewerId, mode)}
            onSummarizeAi={summarizePostWithAi}
            onVotePoll={(pid, oid) => {
              if (!ensureAuth()) return;
              voteUnifiedPoll('post', pid, oid, viewerId);
            }}
            onAddPollOption={(pid, txt) => {
              if (!ensureAuth()) return;
              addUnifiedPollOption('post', pid, txt, { id: viewerId, name: viewerName });
            }}
            onToggleClosePoll={(pid) => toggleCloseUnifiedPoll('post', pid, viewerId)}
            onVoteDebate={(pid, side) => {
              if (!ensureAuth()) return;
              voteDebateSide(pid, side, viewerId);
            }}
            onAddDebateArgument={(pid, side, txt) => {
              if (!ensureAuth()) return;
              addDebateArgument(
                pid,
                side,
                { id: viewerId, name: viewerName, avatar: me?.avatarUrl ?? null },
                txt
              );
            }}
            onAddReply={(inp) => {
              if (!ensureAuth()) return;
              addThreadedReply({
                ...inp,
                authorId: viewerId,
                authorName: viewerName,
                authorAvatar: me?.avatarUrl ?? null,
              });
            }}
            onEditOrDeleteComment={(pid, cid, txt) =>
              editOrDeleteComment(pid, cid, viewerId, txt)
            }
            onReactComment={(pid, cid, rx) => {
              if (!ensureAuth()) return;
              toggleCommentReaction(pid, cid, rx, viewerId);
            }}
            onPinComment={togglePinComment}
            onShareToTarget={(p, dest, note) => {
              if (!ensureAuth()) return;
              sharePostToDestination(
                p,
                { id: viewerId, name: viewerName, avatar: me?.avatarUrl ?? null },
                dest,
                note
              );
            }}
            onAlgoFeedback={(act, p) => {
              if (act === 'not_interested') {
                updateYourAlgo(viewerId, {
                  notInterestedPostIds: [...(slice?.algo.notInterestedPostIds ?? []), p.id],
                });
              }
            }}
            onBlockOrMuteAuthor={(aid, kind) => {
              if (!ensureAuth()) return;
              toggleUserRelation(viewerId, aid, kind);
            }}
            onReportTarget={(tType, tId, prev, ownerId) => {
              if (!ensureAuth()) return;
              submitModerationReport({
                reporterId: viewerId,
                reporterName: viewerName,
                targetType: tType,
                targetId: tId,
                targetPreview: prev,
                targetOwnerId: ownerId,
                reason: 'Vi phạm nguyên tắc cộng đồng',
                details: '',
              });
            }}
          />
        ))
      ) : tab === 'replies' ? (
        <View style={{ gap: 8 }}>
          {userReplies.map(({ comment, parentPost }) => (
            <Card
              key={comment.id}
              onPress={() =>
                router.push({ pathname: '/post/[postId]', params: { postId: parentPost.id } })
              }
            >
              <Text style={{ fontSize: 11.5, color: palette.indigo, fontWeight: '700' }}>
                Phản hồi tới bài viết của {parentPost.authorName}
              </Text>
              <Text style={[typography.body, { color: palette.ink, marginTop: 4 }]}>
                {comment.content}
              </Text>
            </Card>
          ))}
        </View>
      ) : tab === 'media' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {visibleAuthorPosts
            .flatMap((p) => p.mediaItems.map((m) => ({ m, postId: p.id })))
            .map(({ m, postId }) => (
              <Pressable
                key={m.id}
                onPress={() =>
                  router.push({ pathname: '/post/[postId]', params: { postId } })
                }
                style={styles.mediaGridCell}
              >
                <Image
                  source={{ uri: m.thumbnailUri || m.uri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {joinedCommunities.map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="people" size={22} color={palette.indigo} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink }}>
                  {c.name}
                </Text>
                <Text style={{ fontSize: 12, color: palette.inkMuted }} numberOfLines={2}>
                  {c.description}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      <StoryViewerModal
        stories={viewingStoryGroup}
        viewerId={viewerId}
        onClose={() => setViewingStoryGroup(null)}
        onMarkViewed={(sid) => markStoryViewed(sid, viewerId)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
      />

      {safetyModalOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSafetyModalOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setSafetyModalOpen(false)}>
            <Card style={[styles.modalCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                Quyền riêng tư & tương tác với {targetProfile.displayName}
              </Text>
              {isFollowing ? (
                <Button
                  variant="secondary"
                  icon="star"
                  onPress={() => {
                    toggleCloseFriend(viewerId, targetProfile.id);
                    setSafetyModalOpen(false);
                  }}
                >
                  {isCloseFriend ? 'Gỡ khỏi Bạn thân' : 'Thêm vào Bạn thân'}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                icon="volume-mute-outline"
                onPress={() => {
                  toggleUserRelation(viewerId, targetProfile.id, 'mute');
                  setSafetyModalOpen(false);
                }}
              >
                {isMuted ? 'Bỏ tạm ẩn bài viết' : 'Tạm ẩn bài viết'}
              </Button>
              <Button
                variant="secondary"
                icon="hand-left-outline"
                onPress={() => {
                  toggleUserRelation(viewerId, targetProfile.id, 'restrict');
                  setSafetyModalOpen(false);
                }}
              >
                {isRestricted ? 'Bỏ hạn chế tương tác' : 'Hạn chế tương tác'}
              </Button>
              <Button
                variant="danger"
                icon="ban-outline"
                onPress={() => {
                  toggleUserRelation(viewerId, targetProfile.id, 'block');
                  setSafetyModalOpen(false);
                }}
              >
                Chặn tài khoản
              </Button>
              <Button
                variant="secondary"
                icon="flag-outline"
                onPress={() => {
                  submitModerationReport({
                    reporterId: viewerId,
                    reporterName: viewerName,
                    targetType: 'user',
                    targetId: targetProfile.id,
                    targetPreview: targetProfile.displayName,
                    targetOwnerId: targetProfile.id,
                    reason: 'Báo cáo tài khoản',
                    details: '',
                  });
                  setSafetyModalOpen(false);
                  setNotice('Đã gửi báo cáo tới bộ phận kiểm duyệt.');
                }}
              >
                Báo cáo tài khoản
              </Button>
            </Card>
          </Pressable>
        </Modal>
      ) : null}

      {connectionsModal ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setConnectionsModal(null)}
        >
          <View style={styles.backdrop}>
            <Card style={[styles.modalCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                {connectionsModal === 'followers'
                  ? 'Người theo dõi'
                  : connectionsModal === 'following'
                  ? 'Đang theo dõi'
                  : 'Bạn bè'}
              </Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {(connectionsModal === 'followers'
                  ? targetFollowers
                  : connectionsModal === 'following'
                  ? targetFollowing
                  : targetFriends
                ).map((uid) => {
                  const p = profilesById[uid];
                  const label =
                    p?.displayName || (uid === viewerId ? viewerName : 'Thành viên Papyrus');
                  return (
                    <Pressable
                      key={uid}
                      onPress={() => {
                        setConnectionsModal(null);
                        router.push({ pathname: '/user/[userId]', params: { userId: uid } });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Ionicons name="person-circle" size={26} color={palette.indigo} />
                      <Text
                        style={{
                          fontSize: 13.5,
                          fontWeight: '800',
                          color: palette.ink,
                          flex: 1,
                        }}
                      >
                        {label}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Button variant="secondary" onPress={() => setConnectionsModal(null)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverBanner: { width: '100%', height: 124 },
  avatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsStrip: { borderTopWidth: 1, marginTop: 8, paddingHorizontal: spacing.sm },
  tabItem: { paddingHorizontal: 12, paddingVertical: 10 },
  mediaGridCell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: { width: '100%', maxWidth: 440, gap: 8 },
});
