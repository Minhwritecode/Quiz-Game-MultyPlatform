import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Screen, SmoothReveal, TopBar, usePalette } from '@/shared/ui';
import { PapyrusPageSkeleton } from '@/shared/PapyrusLoader';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { extractCompleteSentences } from '@/features/scan-ocr/domain/ocrCleaner';
import { seedQuestionSets } from '@/composition/preferences';
import {
  fetchDailyUpdatedKnowledgeFeed,
  searchAcademicKnowledgeLive,
} from '@/composition/platform';
import { askPapyAiFeedAssistant } from '@/composition/social';
import type { DailyKnowledgeArticle, ScholarStory } from '@/features/community/domain/models';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { CreateStoryCard916, StoryCard916 } from '@/features/community/presentation/StoryCard916';
import {
  StoryComposerModal,
  StoryViewerModal,
} from '@/features/community/presentation/StoryModalViewer';
import { FriendsDiscoveryHub } from '@/features/community/presentation/FriendsDiscoveryHub';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import {
  canViewerAccessPost,
  isFollowingAccepted,
  matchesVietnameseSearch,
  projectSafePostForViewer,
  rankAndFilterFeedPosts,
} from '@/features/social/domain/rankingAndPermissions';
import type {
  CommunityRole,
  FeedModeType,
  SocialPostItem,
} from '@/features/social/domain/models';
import { MetaThreadsPostCard } from '@/features/social/presentation/MetaThreadsPostCard';
import { AdvancedThreadComposerModal } from '@/features/social/presentation/AdvancedThreadComposerModal';

type HubSection = 'feeds' | 'communities' | 'discover';
type DiscoverSubTab = 'documents_and_posts' | 'users';

const AREA_CLUSTERS = ['ALL', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Quốc tế'];

export default function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    dmUserId?: string;
    dmName?: string;
    communityId?: string;
    topic?: string;
  }>();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const refreshTick = useRouteRefreshStore((s) => s.refreshTick);
  const scrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);

  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName?.trim() || 'Thành viên Papyrus';
  const viewerAvatar = user?.avatarUrl ?? null;

  const addBonusXp = usePapyrusStore((s) => s.addBonusXp);
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(
    () => (storeSets.length > 0 ? storeSets : seedQuestionSets),
    [storeSets]
  );

  // Stories (Facebook 9:16 photo/video stories)
  const stories = useCommunityStore((s) => s.stories);
  const addStory = useCommunityStore((s) => s.addStory);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);
  const reactToStory = useCommunityStore((s) => s.reactToStory);

  // Production Social Media & Threads Store
  const profilesById = useSocialStore((s) => s.profilesById);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const socialPosts = useSocialStore((s) => s.posts);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const userSlices = useSocialStore((s) => s.userSlices);
  const feedScrollOffset = useSocialStore((s) => s.feedScrollOffset);

  const ensureUserProfile = useSocialStore((s) => s.ensureUserProfile);
  const syncCloudDirectory = useSocialStore((s) => s.syncCloudDirectory);
  const runScheduledAndGhostSweep = useSocialStore((s) => s.runScheduledAndGhostSweep);
  const saveComposerDraft = useSocialStore((s) => s.saveComposerDraft);
  const createSocialPost = useSocialStore((s) => s.createSocialPost);
  const editSocialPost = useSocialStore((s) => s.editSocialPost);
  const deleteOrArchivePost = useSocialStore((s) => s.deleteOrArchivePost);
  const togglePinPost = useSocialStore((s) => s.togglePinPost);
  const summarizePostWithAi = useSocialStore((s) => s.summarizePostWithAi);
  const voteDebateSide = useSocialStore((s) => s.voteDebateSide);
  const addDebateArgument = useSocialStore((s) => s.addDebateArgument);
  const togglePostEmojiReaction = useSocialStore((s) => s.togglePostEmojiReaction);
  const addThreadedReply = useSocialStore((s) => s.addThreadedReply);
  const editOrDeleteComment = useSocialStore((s) => s.editOrDeleteComment);
  const toggleCommentReaction = useSocialStore((s) => s.toggleCommentReaction);
  const togglePinComment = useSocialStore((s) => s.togglePinComment);
  const togglePureRepost = useSocialStore((s) => s.togglePureRepost);
  const toggleSaveBookmark = useSocialStore((s) => s.toggleSaveBookmark);
  const toggleFavouritePost = useSocialStore((s) => s.toggleFavouritePost);
  const createBookmarkCollection = useSocialStore((s) => s.createBookmarkCollection);
  const voteUnifiedPoll = useSocialStore((s) => s.voteUnifiedPoll);
  const addUnifiedPollOption = useSocialStore((s) => s.addUnifiedPollOption);
  const toggleCloseUnifiedPoll = useSocialStore((s) => s.toggleCloseUnifiedPoll);
  const toggleFollowUser = useSocialStore((s) => s.toggleFollowUser);
  const toggleUserRelation = useSocialStore((s) => s.toggleUserRelation);
  const setFeedScrollOffset = useSocialStore((s) => s.setFeedScrollOffset);
  const updateYourAlgo = useSocialStore((s) => s.updateYourAlgo);
  const resetYourAlgo = useSocialStore((s) => s.resetYourAlgo);
  const saveCustomFeed = useSocialStore((s) => s.saveCustomFeed);
  const deleteCustomFeed = useSocialStore((s) => s.deleteCustomFeed);
  const recordSearchQuery = useSocialStore((s) => s.recordSearchQuery);
  const clearSearchHistory = useSocialStore((s) => s.clearSearchHistory);
  const createCommunity = useSocialStore((s) => s.createCommunity);
  const joinOrLeaveCommunity = useSocialStore((s) => s.joinOrLeaveCommunity);
  const updateCommunityMemberRole = useSocialStore((s) => s.updateCommunityMemberRole);
  const approvePendingPost = useSocialStore((s) => s.approvePendingPost);
  const createCommunityEvent = useSocialStore((s) => s.createCommunityEvent);
  const toggleEventRsvp = useSocialStore((s) => s.toggleEventRsvp);
  const sharePostToDestination = useSocialStore((s) => s.sharePostToDestination);
  const submitModerationReport = useSocialStore((s) => s.submitModerationReport);

  const mySlice = userSlices[viewerId] ?? userSlices.guest;
  const myAlgo = useMemo(
    () =>
      mySlice?.algo ?? {
        boostedTopics: [],
        hiddenTopics: [],
        mutedKeywords: [],
        prioritizedAccountIds: [],
        showLessAccountIds: [],
        notInterestedPostIds: [],
        knowledgeMode: false,
        activeMood: 'all' as const,
        preferenceExpiresAt: null,
      },
    [mySlice?.algo]
  );

  // Redirect legacy inline messenger deep links straight to Dedicated Messaging Center (`/messages`)
  useEffect(() => {
    if (params.tab === 'messenger' || params.dmUserId) {
      router.replace({
        pathname: '/messages',
        params: {
          ...(params.dmUserId ? { peerId: params.dmUserId } : {}),
          ...(params.dmName ? { peerName: params.dmName } : {}),
        },
      });
    }
  }, [params.dmName, params.dmUserId, params.tab, router]);

  // Sync profile, cloud directory & scheduled/ghost sweeps
  useEffect(() => {
    if (user?.id) {
      ensureUserProfile({
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role === 'admin' ? 'admin' : 'user',
      });
    }
    runScheduledAndGhostSweep();
    void syncCloudDirectory();
  }, [ensureUserProfile, refreshTick, runScheduledAndGhostSweep, syncCloudDirectory, user]);

  // Restore scroll position on mount when returning to Feed
  useEffect(() => {
    if (feedScrollOffset > 40) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: feedScrollOffset, animated: false });
      }, 90);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [feedScrollOffset]);

  const [hubSection, setHubSection] = useState<HubSection>(() =>
    params.communityId
      ? 'communities'
      : params.tab === 'friends' || params.tab === 'search'
      ? 'discover'
      : 'feeds'
  );
  const [discoverSubTab, setDiscoverSubTab] = useState<DiscoverSubTab>(() =>
    params.tab === 'friends' ? 'users' : 'documents_and_posts'
  );

  // Feed Modes, Topic Filter, Nearby Location Consent & Pagination
  const [feedMode, setFeedMode] = useState<FeedModeType>('for_you');
  const [selectedCustomFeedId, setSelectedCustomFeedId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>(params.topic || 'ALL');
  const [locationConsent, setLocationConsent] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState(8);

  // PapyAI Feed Assistant
  const [aiFeedPrompt, setAiFeedPrompt] = useState('');
  const [aiAssistantBusy, setAiAssistantBusy] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Modals: Story, Composer, Quote, Your Algo, Bookmarks Drawer, Scheduled/Archived
  const [activeStory, setActiveStory] = useState<ScholarStory | null>(null);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{
    text?: string;
    subtext?: string;
    imageUri?: string | null;
  } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [quotedPost, setQuotedPost] = useState<SocialPostItem | null>(null);
  const [composerCommunityId, setComposerCommunityId] = useState<string | null>(null);

  const [algoModalOpen, setAlgoModalOpen] = useState(false);
  const [newMutedKeyword, setNewMutedKeyword] = useState('');
  const [newCustomFeedName, setNewCustomFeedName] = useState('');
  const [newCustomFeedTopics, setNewCustomFeedTopics] = useState('CNTT, AI, ÔnThi');

  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false);
  const [bookmarkTab, setBookmarkTab] = useState<'bookmarks' | 'favourites' | 'scheduled'>(
    'bookmarks'
  );
  const [newColName, setNewColName] = useState('');

  // Communities Module State
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    params.communityId || null
  );
  const [communitySubTab, setCommunitySubTab] = useState<
    'feed' | 'events' | 'members' | 'moderation'
  >('feed');
  const [createCommOpen, setCreateCommOpen] = useState(false);
  const [commName, setCommName] = useState('');
  const [commDesc, setCommDesc] = useState('');
  const [commVisibility, setCommVisibility] = useState<'public' | 'private' | 'hidden'>('public');
  const [commTopics, setCommTopics] = useState('CNTT, ÔnThi');
  const [commPostApproval, setCommPostApproval] = useState(false);

  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState('Phòng Live Thảo Luận · Papyrus');

  // Academic & Post Search State (Separate from User Profile Search!)
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [searchingDocs, setSearchingDocs] = useState(false);
  const [liveWikiResults, setLiveWikiResults] = useState<DailyKnowledgeArticle[]>([]);
  const [dailyFeed, setDailyFeed] = useState<DailyKnowledgeArticle[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  const notifyToast = (text: string) => {
    setStatusToast(text);
    setTimeout(() => setStatusToast(null), 3000);
  };

  useEffect(() => {
    let active = true;
    void fetchDailyUpdatedKnowledgeFeed()
      .then((items) => {
        if (active) setDailyFeed(items);
      })
      .finally(() => {
        if (active) setLoadingDaily(false);
      });
    return () => {
      active = false;
    };
  }, [refreshTick]);

  useEffect(() => {
    const clean = docSearchQuery.trim();
    if (clean.length < 2) return;
    const t = setTimeout(() => {
      setSearchingDocs(true);
      void searchAcademicKnowledgeLive(clean)
        .then((res) => setLiveWikiResults(res))
        .finally(() => setSearchingDocs(false));
    }, 420);
    return () => clearTimeout(t);
  }, [docSearchQuery]);

  const graph = useMemo(
    () => ({ follows, friendRequests, relations, communities }),
    [communities, follows, friendRequests, relations]
  );

  const unreadMessagesTotal = useMemo(
    () =>
      conversations.reduce((acc, c) => acc + (c.unreadByUserIds[viewerId] ?? 0), 0) +
      conversations.filter((c) => c.requestState === 'pending').length,
    [conversations, viewerId]
  );

  const activeCustomFeed = useMemo(
    () => mySlice?.customFeeds.find((cf) => cf.id === selectedCustomFeedId) ?? null,
    [mySlice?.customFeeds, selectedCustomFeedId]
  );

  const rankedFeedItems = useMemo(
    () =>
      rankAndFilterFeedPosts({
        posts: socialPosts,
        viewerId,
        mode: feedMode,
        algo: myAlgo,
        graph,
        selectedTopic,
        selectedLocationArea: selectedArea,
        customFeed: activeCustomFeed,
      }),
    [activeCustomFeed, feedMode, graph, myAlgo, selectedArea, selectedTopic, socialPosts, viewerId]
  );

  const paginatedFeedItems = useMemo(
    () => rankedFeedItems.slice(0, pageSize),
    [pageSize, rankedFeedItems]
  );

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of socialPosts) {
      if (p.lifecycleStatus !== 'published') continue;
      for (const h of [...p.hashtags, ...p.topics]) {
        counts.set(h, (counts.get(h) ?? 0) + 1 + Object.keys(p.reactions).length);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [socialPosts]);

  // Document/Post/Hashtag Search Results (Vietnamese diacritic-insensitive!)
  const matchedSocialPosts = useMemo(() => {
    const q = docSearchQuery.trim();
    if (q.length < 2) return [];
    return socialPosts
      .filter((p) => canViewerAccessPost(p, viewerId, graph))
      .filter((p) =>
        matchesVietnameseSearch(
          `${p.threadParts.join(' ')} ${p.longFormBody ?? ''} ${p.hashtags.join(' ')} ${p.topics.join(' ')} ${p.authorName}`,
          q
        )
      )
      .slice(0, 8);
  }, [docSearchQuery, graph, socialPosts, viewerId]);

  const matchedQuestionSets = useMemo(() => {
    const q = docSearchQuery.trim();
    if (q.length < 2) return [];
    return allSets
      .filter((s) =>
        matchesVietnameseSearch(`${s.title} ${s.subject} ${(s.tags ?? []).join(' ')}`, q)
      )
      .slice(0, 5);
  }, [allSets, docSearchQuery]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId]
  );

  const handleAskAiFeedAssistant = async () => {
    if (!aiFeedPrompt.trim() || aiAssistantBusy) return;
    setAiAssistantBusy(true);
    try {
      const res = await askPapyAiFeedAssistant(aiFeedPrompt.trim());
      updateYourAlgo(viewerId, {
        ...res.patch,
        boostedTopics: Array.from(
          new Set([...myAlgo.boostedTopics, ...(res.patch.boostedTopics ?? [])])
        ),
        hiddenTopics: Array.from(
          new Set([...myAlgo.hiddenTopics, ...(res.patch.hiddenTopics ?? [])])
        ),
      });
      setAiFeedPrompt('');
      notifyToast(res.replyText);
    } finally {
      setAiAssistantBusy(false);
    }
  };

  const renderPostCard = (post: SocialPostItem, reason?: string) => {
    const isAdminViewer = user?.role === 'admin';
    const safePost = projectSafePostForViewer(post, viewerId, isAdminViewer);
    const realAuthor = post.internalAuthorId || post.authorId;
    return (
      <MetaThreadsPostCard
        key={post.id}
        post={safePost}
        viewerId={viewerId}
        viewerName={viewerName}
        viewerAvatar={viewerAvatar}
        recommendationReason={reason}
        isSavedBookmark={Boolean(mySlice?.bookmarkedPostIds.includes(post.id))}
        isFavourited={Boolean(mySlice?.favouritePostIds.includes(post.id))}
        isFollowingAuthor={isFollowingAccepted(viewerId, realAuthor, graph)}
        profilesById={profilesById}
        graph={graph}
        collections={(mySlice?.collections ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          coverEmoji: c.coverEmoji,
        }))}
        conversations={conversations
          .filter((c) => c.requestState !== 'archived')
          .map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
        communities={communities
          .filter((c) => !c.isSuspended && c.visibility !== 'hidden')
          .map((c) => ({ id: c.id, name: c.name }))}
        onToggleFollow={(targetId) => {
          const out = toggleFollowUser(viewerId, targetId);
          notifyToast(
            out === 'requested'
              ? 'Đã gửi yêu cầu theo dõi tài khoản riêng tư!'
              : out === 'followed'
              ? 'Đã theo dõi!'
              : 'Đã bỏ theo dõi.'
          );
        }}
        onReactPost={(pid, reaction) => {
          togglePostEmojiReaction(pid, reaction, viewerId);
        }}
        onTogglePureRepost={(pid) => {
          const added = togglePureRepost(pid, viewerId);
          notifyToast(added ? '🔁 Đã đăng lại (Repost) lên trang cá nhân!' : 'Đã hoàn tác Đăng lại.');
        }}
        onOpenQuoteComposer={(target) => {
          setQuotedPost(target);
          setComposerCommunityId(null);
          setComposerOpen(true);
        }}
        onToggleBookmark={(pid, colId) => {
          const saved = toggleSaveBookmark(viewerId, pid, colId);
          notifyToast(saved ? '🔖 Đã lưu vào Bộ sưu tập cá nhân!' : 'Đã bỏ lưu bài viết.');
        }}
        onToggleFavourite={(pid) => {
          const fav = toggleFavouritePost(viewerId, pid);
          notifyToast(fav ? '⭐ Đã thêm vào Yêu thích để ưu tiên tương tự!' : 'Đã gỡ khỏi Yêu thích.');
        }}
        onTogglePin={(pid, scope) => {
          togglePinPost(pid, scope);
          notifyToast('📌 Đã cập nhật trạng thái Ghim bài viết!');
        }}
        onEditPost={(pid, nextParts, nextLongForm) => {
          editSocialPost(pid, viewerId, nextParts, nextLongForm);
          notifyToast('✏️ Đã lưu chỉnh sửa & ghi nhận Lịch sử phiên bản!');
        }}
        onDeleteOrArchive={(pid, mode) => {
          deleteOrArchivePost(pid, viewerId, mode);
          notifyToast(
            mode === 'archive' ? '🗄️ Đã lưu trữ bài viết riêng tư.' : '🗑️ Đã xóa bài viết.'
          );
        }}
        onSummarizeAi={(pid) => summarizePostWithAi(pid)}
        onVotePoll={(pid, optId) => voteUnifiedPoll('post', pid, optId, viewerId)}
        onAddPollOption={(pid, text) =>
          addUnifiedPollOption('post', pid, text, { id: viewerId, name: viewerName })
        }
        onToggleClosePoll={(pid) => toggleCloseUnifiedPoll('post', pid, viewerId)}
        onVoteDebate={(pid, side) => voteDebateSide(pid, side, viewerId)}
        onAddDebateArgument={(pid, side, content) =>
          addDebateArgument(
            pid,
            side,
            { id: viewerId, name: viewerName, avatar: viewerAvatar },
            content
          )
        }
        onAddReply={(input) => {
          addThreadedReply({
            ...input,
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: viewerAvatar,
          });
          addBonusXp(5);
        }}
        onEditOrDeleteComment={(pid, cid, newContent) =>
          editOrDeleteComment(pid, cid, viewerId, newContent)
        }
        onReactComment={(pid, cid, reaction) =>
          toggleCommentReaction(pid, cid, reaction, viewerId)
        }
        onPinComment={(pid, cid) => togglePinComment(pid, cid)}
        onShareToTarget={(targetPost, dest, note) => {
          sharePostToDestination(
            targetPost,
            { id: viewerId, name: viewerName, avatar: viewerAvatar },
            dest,
            note
          );
          notifyToast(
            dest.type === 'conversation'
              ? '💬 Đã chia sẻ Thẻ bài viết nhúng vào Tin nhắn!'
              : '🏛️ Đã chia sẻ Thẻ bài viết vào Cộng đồng!'
          );
        }}
        onAlgoFeedback={(action, p) => {
          if (action === 'more') {
            updateYourAlgo(viewerId, {
              boostedTopics: Array.from(new Set([...myAlgo.boostedTopics, ...p.topics])),
              prioritizedAccountIds: Array.from(
                new Set([...myAlgo.prioritizedAccountIds, realAuthor])
              ),
            });
            notifyToast('✨ PapyAI sẽ ưu tiên hiển thị chủ đề & tác giả này nhiều hơn!');
          } else if (action === 'less') {
            updateYourAlgo(viewerId, {
              showLessAccountIds: Array.from(new Set([...myAlgo.showLessAccountIds, realAuthor])),
            });
            notifyToast('Đã giảm tần suất hiển thị nội dung tương tự.');
          } else if (action === 'not_interested') {
            updateYourAlgo(viewerId, {
              notInterestedPostIds: Array.from(new Set([...myAlgo.notInterestedPostIds, p.id])),
            });
            notifyToast('Đã ẩn bài viết khỏi Bảng tin của bạn.');
          } else if (action === 'hide_topic') {
            updateYourAlgo(viewerId, {
              hiddenTopics: Array.from(new Set([...myAlgo.hiddenTopics, ...p.topics])),
            });
            notifyToast('Đã thêm chủ đề vào danh sách ẩn trên Your Algo.');
          }
        }}
        onBlockOrMuteAuthor={(authorId, kind) => {
          toggleUserRelation(viewerId, authorId, kind);
          notifyToast(
            kind === 'block'
              ? '🚫 Đã chặn tài khoản này trên toàn hệ thống.'
              : '🔇 Đã tắt tiếng bài viết từ tài khoản này.'
          );
        }}
        onReportTarget={(targetType, targetId, preview, ownerId) => {
          submitModerationReport({
            reporterId: viewerId,
            reporterName: viewerName,
            targetType,
            targetId,
            targetPreview: preview,
            targetOwnerId: ownerId,
            reason: 'Báo cáo nội dung từ Bảng tin Cộng đồng',
            details: 'Người dùng yêu cầu đội ngũ kiểm duyệt xem xét.',
          });
          notifyToast('🛡️ Đã gửi báo cáo tới Hàng đợi Kiểm duyệt (Trust & Safety).');
        }}
      />
    );
  };

  return (
    <Screen scroll={false}>
      <View style={[styles.container, isWide && { maxWidth: 960, alignSelf: 'center', width: '100%' }]}>
        <TopBar
          title="Mạng Xã Hội & Cộng Đồng"
          subtitle="Threads · Nhóm Học Tập · Tin 24h · PapyAI"
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở Trung tâm Tin nhắn"
                onPress={() => router.push('/messages')}
                style={[
                  styles.msgShortcutBtn,
                  { backgroundColor: palette.paperRaised, borderColor: palette.indigoBorder },
                ]}
              >
                <Ionicons name="chatbubble-ellipses" size={17} color={palette.indigo} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                  Tin nhắn
                </Text>
                {unreadMessagesTotal > 0 ? (
                  <View style={[styles.msgBadge, { backgroundColor: palette.danger }]}>
                    <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>
                      {unreadMessagesTotal}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đăng chuỗi bài viết mới"
                onPress={() => {
                  setQuotedPost(null);
                  setComposerCommunityId(selectedCommunity?.id ?? null);
                  setComposerOpen(true);
                }}
                style={[styles.composeTopBtn, { backgroundColor: palette.indigo }]}
              >
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Đăng bài</Text>
              </Pressable>
            </View>
          }
        />

        {statusToast ? (
          <View style={[styles.toastBar, { backgroundColor: palette.indigo }]}>
            <Ionicons name="sparkles" size={15} color="#FDE68A" />
            <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', flexShrink: 1 }}>
              {statusToast}
            </Text>
          </View>
        ) : null}

        {/* Primary Module Switcher */}
        <View style={styles.hubTabsRow}>
          {(
            [
              { id: 'feeds', label: '🧵 Bảng tin Threads' },
              { id: 'communities', label: `🏛️ Cộng đồng (${communities.length})` },
              { id: 'discover', label: '🔍 Khám phá & Bạn bè' },
            ] as const
          ).map((sec) => {
            const active = hubSection === sec.id;
            return (
              <Pressable
                key={sec.id}
                onPress={() => setHubSection(sec.id)}
                style={[
                  styles.hubTabBtn,
                  {
                    backgroundColor: active ? palette.indigo : palette.paper,
                    borderColor: active ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    color: active ? '#FFFFFF' : palette.ink,
                  }}
                  numberOfLines={1}
                >
                  {sec.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 110, gap: spacing.md }}
          scrollEventThrottle={250}
          onScroll={(e) => {
            if (hubSection === 'feeds') {
              setFeedScrollOffset(e.nativeEvent.contentOffset.y);
            }
          }}
        >
          {/* ===================================================================== */}
          {/* MODULE 1: META THREADS + FACEBOOK STORIES + YOUR ALGO FEED            */}
          {/* ===================================================================== */}
          {hubSection === 'feeds' ? (
            <SmoothReveal style={{ gap: spacing.md }}>
              {/* 9:16 Facebook Stories Strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
              >
                <CreateStoryCard916
                  displayName={viewerName}
                  avatarUrl={viewerAvatar}
                  onPress={() => {
                    setStoryDraft(null);
                    setStoryComposerOpen(true);
                  }}
                />
                {stories.map((st) => (
                  <StoryCard916
                    key={st.id}
                    story={st}
                    seen={st.viewedByIds.includes(viewerId)}
                    onPress={() => {
                      markStoryViewed(st.id, viewerId);
                      setActiveStory(st);
                    }}
                  />
                ))}
              </ScrollView>

              {/* Quick Composer Prompt Card (Resumes Draft if Saved!) */}
              <Pressable
                onPress={() => {
                  setQuotedPost(null);
                  setComposerCommunityId(null);
                  setComposerOpen(true);
                }}
                style={[
                  styles.quickComposeCard,
                  { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                ]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: palette.indigo }]}>
                  {viewerAvatar ? (
                    <Image source={{ uri: viewerAvatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>
                      {(viewerName[0] || 'P').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                    {viewerName}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: palette.inkMuted }} numberOfLines={1}>
                    {mySlice?.draft
                      ? `📝 Tiếp tục bản nháp đã lưu tự động: "${mySlice.draft.threadParts[0] || 'Đang soạn...'}"`
                      : 'Bắt đầu một chuỗi Thread, đặt câu hỏi, tạo Poll hoặc đăng Ghost 24h...'}
                  </Text>
                </View>
                <Badge tone="primary">+ Chuỗi</Badge>
              </Pressable>

              {/* PapyAI Feed Assistant + Your Algo & Saved Bookmarks Controls */}
              <Card style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="sparkles" size={16} color={palette.indigo} />
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink }}>
                      Trợ lý Bảng tin PapyAI & Thuật toán cá nhân
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Pressable
                      onPress={() => setAlgoModalOpen(true)}
                      style={[styles.utilChip, { backgroundColor: palette.indigoTint }]}
                    >
                      <Ionicons name="options-outline" size={14} color={palette.indigo} />
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                        Your Algo & Custom Feeds
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setBookmarksDrawerOpen(true)}
                      style={[styles.utilChip, { backgroundColor: palette.paperRaised }]}
                    >
                      <Ionicons name="bookmarks-outline" size={14} color={palette.ink} />
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.ink }}>
                        Đã lưu ({mySlice?.bookmarkedPostIds.length ?? 0})
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    value={aiFeedPrompt}
                    onChangeText={setAiFeedPrompt}
                    placeholder="Nói với PapyAI: 'Ưu tiên CNTT & AI, ẩn giải trí, bật chế độ tập trung'..."
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.aiInput,
                      {
                        color: palette.ink,
                        backgroundColor: palette.paperRaised,
                        borderColor: palette.paperMuted,
                      },
                    ]}
                  />
                  <Button
                    size="sm"
                    disabled={!aiFeedPrompt.trim() || aiAssistantBusy}
                    onPress={() => void handleAskAiFeedAssistant()}
                  >
                    {aiAssistantBusy ? 'Đang tối ưu...' : 'Áp dụng AI'}
                  </Button>
                </View>
              </Card>

              {/* Feed Mode Selector (For You, Home, Following, Friends, Trending, Knowledge, Debate, Nearby + Custom Feeds) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {(
                  [
                    { id: 'for_you', label: '✨ Dành cho bạn' },
                    { id: 'home', label: '🏠 Trang chủ' },
                    { id: 'following', label: '➕ Đang theo dõi' },
                    { id: 'friends', label: '🤝 Bạn bè' },
                    { id: 'trending', label: '🔥 Thịnh hành' },
                    { id: 'knowledge', label: '🧠 Chế độ Tri thức' },
                    { id: 'debate', label: '⚖️ Tranh biện' },
                    { id: 'nearby', label: '📍 Gần bạn & Bản đồ' },
                  ] as const
                ).map((m) => {
                  const active = feedMode === m.id && !selectedCustomFeedId;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        setFeedMode(m.id);
                        setSelectedCustomFeedId(null);
                      }}
                      style={[
                        styles.modePill,
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
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}

                {(mySlice?.customFeeds ?? [])
                  .filter((cf) => cf.isPinned)
                  .map((cf) => {
                    const active = feedMode === 'custom' && selectedCustomFeedId === cf.id;
                    return (
                      <Pressable
                        key={cf.id}
                        onPress={() => {
                          setFeedMode('custom');
                          setSelectedCustomFeedId(cf.id);
                        }}
                        style={[
                          styles.modePill,
                          {
                            backgroundColor: active ? '#8B5CF6' : palette.paper,
                            borderColor: active ? '#8B5CF6' : palette.indigoBorder,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: active ? '#FFFFFF' : palette.indigo,
                          }}
                        >
                          {cf.name}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>

              {/* Nearby Feed & Privacy-First Location Cluster Panel (Section 7.6) */}
              {feedMode === 'nearby' ? (
                <Card style={{ gap: 8, borderColor: palette.indigoBorder }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 200 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                        🗺️ Bản Đồ & Cụm Thảo Luận Theo Khu Vực (Quyền riêng tư tuyệt đối)
                      </Text>
                      <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                        Chỉ hiển thị khu vực gần đúng theo tỉnh/thành phố khi bạn chủ động bật — không bao giờ chia sẻ tọa độ GPS chính xác.
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant={locationConsent ? 'secondary' : 'primary'}
                      onPress={() => setLocationConsent((v) => !v)}
                    >
                      {locationConsent ? 'Tắt vị trí khu vực' : 'Bật khám phá khu vực'}
                    </Button>
                  </View>

                  {locationConsent ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {AREA_CLUSTERS.map((area) => (
                        <Pressable
                          key={area}
                          onPress={() => setSelectedArea(area)}
                          style={[
                            styles.modePill,
                            {
                              backgroundColor:
                                selectedArea === area ? palette.indigo : palette.paperRaised,
                              borderColor:
                                selectedArea === area ? palette.indigo : palette.paperMuted,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: '800',
                              color: selectedArea === area ? '#FFF' : palette.ink,
                            }}
                          >
                            📍 {area === 'ALL' ? 'Tất cả cụm thành phố' : area}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </Card>
              ) : null}

              {/* Trending Topic Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                <Pressable
                  onPress={() => setSelectedTopic('ALL')}
                  style={[
                    styles.topicChip,
                    {
                      backgroundColor:
                        selectedTopic === 'ALL' ? palette.indigoTint : palette.paper,
                      borderColor: selectedTopic === 'ALL' ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.ink }}>
                    Tất cả chủ đề
                  </Text>
                </Pressable>
                {trendingHashtags.map(([tag, score]) => (
                  <Pressable
                    key={tag}
                    onPress={() => setSelectedTopic(selectedTopic === tag ? 'ALL' : tag)}
                    style={[
                      styles.topicChip,
                      {
                        backgroundColor:
                          selectedTopic === tag ? palette.indigoTint : palette.paper,
                        borderColor: selectedTopic === tag ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                      #{tag} ({score})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Ranked Threads Stream */}
              {paginatedFeedItems.length === 0 ? (
                <Card style={{ alignItems: 'center', gap: 10, paddingVertical: spacing.xl }}>
                  <Ionicons name="sparkles-outline" size={30} color={palette.indigo} />
                  <Text style={[typography.title, { color: palette.ink, textAlign: 'center' }]}>
                    Chưa có bài viết khớp bộ lọc hiện tại
                  </Text>
                  <Text
                    style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}
                  >
                    Hãy thử chuyển sang Bảng tin Dành cho bạn, đặt lại Your Algo hoặc đăng chuỗi Thread đầu tiên!
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setFeedMode('for_you');
                        setSelectedTopic('ALL');
                        setSelectedCustomFeedId(null);
                      }}
                    >
                      Về Dành cho bạn
                    </Button>
                    <Button onPress={() => setComposerOpen(true)}>+ Đăng Thread mới</Button>
                  </View>
                </Card>
              ) : (
                <>
                  {paginatedFeedItems.map(({ post, reason }) => renderPostCard(post, reason))}

                  {rankedFeedItems.length > pageSize ? (
                    <Button
                      variant="secondary"
                      onPress={() => setPageSize((prev) => prev + 8)}
                      fullWidth
                    >
                      Xem thêm bài viết ({rankedFeedItems.length - pageSize} bài còn lại)
                    </Button>
                  ) : null}
                </>
              )}
            </SmoothReveal>
          ) : null}

          {/* ===================================================================== */}
          {/* MODULE 2: COMMUNITIES / GROUPS + RBAC + EVENTS + REPUTATION           */}
          {/* ===================================================================== */}
          {hubSection === 'communities' ? (
            <SmoothReveal style={{ gap: spacing.md }}>
              {!selectedCommunity ? (
                <>
                  <Card style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[typography.title, { color: palette.ink }]}>
                          🏛️ Nhóm & Cộng Đồng Chuyên Môn
                        </Text>
                        <Text style={[typography.caption, { color: palette.inkMuted }]}>
                          Tham gia nhóm Công khai / Riêng tư, bình chọn Poll Zalo, dự sự kiện Live và tích lũy Huy hiệu Uy tín.
                        </Text>
                      </View>
                      <Button icon="add-circle-outline" onPress={() => setCreateCommOpen(true)}>
                        Tạo Cộng đồng mới
                      </Button>
                    </View>
                  </Card>

                  {communities
                    .filter((c) => !c.isSuspended && (c.visibility !== 'hidden' || c.members.some((m) => m.userId === viewerId)))
                    .map((comm) => {
                      const myEntry = comm.members.find((m) => m.userId === viewerId);
                      return (
                        <Card key={comm.id} style={{ gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={[
                                styles.commIconBox,
                                { backgroundColor: comm.accentColor || palette.indigo },
                              ]}
                            >
                              <Text style={{ fontSize: 22 }}>{comm.avatarEmoji}</Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 6,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Text
                                  style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}
                                >
                                  {comm.name}
                                </Text>
                                <Badge
                                  tone={comm.visibility === 'public' ? 'success' : 'primary'}
                                >
                                  {comm.visibility === 'public'
                                    ? '🌍 Công khai'
                                    : comm.visibility === 'private'
                                    ? '🔒 Riêng tư'
                                    : '🕵️ Ẩn'}
                                </Badge>
                              </View>
                              <Text style={{ fontSize: 12, color: palette.inkMuted, marginTop: 2 }}>
                                👥 {comm.members.length} thành viên · 📅 {comm.events.length} sự kiện
                              </Text>
                            </View>
                          </View>

                          <Text style={[typography.caption, { color: palette.ink }]}>
                            {comm.description}
                          </Text>

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            <Button
                              size="sm"
                              onPress={() => {
                                setSelectedCommunityId(comm.id);
                                setCommunitySubTab('feed');
                              }}
                            >
                              Mở Cộng đồng
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => {
                                const state = joinOrLeaveCommunity(comm.id, {
                                  id: viewerId,
                                  name: viewerName,
                                  avatar: viewerAvatar,
                                });
                                notifyToast(
                                  state === 'pending'
                                    ? '⏳ Đã gửi yêu cầu tham gia nhóm riêng tư!'
                                    : state === 'member'
                                    ? `🎉 Đã tham gia «${comm.name}»!`
                                    : 'Đã rời khỏi nhóm.'
                                );
                              }}
                            >
                              {myEntry
                                ? myEntry.role === 'pending'
                                  ? '⏳ Đang chờ duyệt (Hủy)'
                                  : `✓ Đã tham gia (${myEntry.role})`
                                : comm.requireMemberApproval
                                ? 'Gửi yêu cầu tham gia'
                                : '+ Tham gia ngay'}
                            </Button>
                          </View>
                        </Card>
                      );
                    })}
                </>
              ) : (
                <>
                  {/* Active Community Detail View */}
                  <Card style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <Pressable
                        onPress={() => setSelectedCommunityId(null)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        <Ionicons name="arrow-back" size={18} color={palette.indigo} />
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.indigo }}>
                          Tất cả Cộng đồng
                        </Text>
                      </Pressable>

                      <Button
                        size="sm"
                        icon="create-outline"
                        onPress={() => {
                          setQuotedPost(null);
                          setComposerCommunityId(selectedCommunity.id);
                          setComposerOpen(true);
                        }}
                      >
                        Đăng vào nhóm
                      </Button>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={[
                          styles.commIconBox,
                          { backgroundColor: selectedCommunity.accentColor },
                        ]}
                      >
                        <Text style={{ fontSize: 24 }}>{selectedCommunity.avatarEmoji}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[typography.title, { color: palette.ink }]}>
                          {selectedCommunity.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                          {selectedCommunity.description}
                        </Text>
                      </View>
                    </View>

                    {selectedCommunity.announcements[0] ? (
                      <View
                        style={[
                          styles.announceBox,
                          { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                        ]}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                          {selectedCommunity.announcements[0]}
                        </Text>
                      </View>
                    ) : null}

                    {/* Community Sub-Tabs */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {(
                        [
                          { id: 'feed', label: '📝 Thảo luận & Ghim' },
                          {
                            id: 'events',
                            label: `📅 Sự kiện (${selectedCommunity.events.length})`,
                          },
                          {
                            id: 'members',
                            label: `🏆 Thành viên & Uy tín (${selectedCommunity.members.length})`,
                          },
                          { id: 'moderation', label: '🛡️ Duyệt bài & Nội quy' },
                        ] as const
                      ).map((st) => (
                        <Pressable
                          key={st.id}
                          onPress={() => setCommunitySubTab(st.id)}
                          style={[
                            styles.modePill,
                            {
                              backgroundColor:
                                communitySubTab === st.id ? palette.indigo : palette.paperRaised,
                              borderColor:
                                communitySubTab === st.id ? palette.indigo : palette.paperMuted,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: communitySubTab === st.id ? '#FFF' : palette.ink,
                            }}
                          >
                            {st.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </Card>

                  {communitySubTab === 'feed' ? (
                    socialPosts
                      .filter(
                        (p) =>
                          p.communityId === selectedCommunity.id &&
                          canViewerAccessPost(p, viewerId, graph)
                      )
                      .sort((a, b) =>
                        a.isPinnedCommunity !== b.isPinnedCommunity
                          ? a.isPinnedCommunity
                            ? -1
                            : 1
                          : Date.parse(b.createdAt) - Date.parse(a.createdAt)
                      )
                      .map((p) => renderPostCard(p, `Cộng đồng · ${selectedCommunity.name}`))
                  ) : null}

                  {communitySubTab === 'events' ? (
                    <View style={{ gap: 10 }}>
                      <Button
                        icon="calendar-outline"
                        onPress={() => setCreateEventOpen(true)}
                      >
                        + Tạo Sự Kiện / Lịch Học Trực Tiếp Mới
                      </Button>
                      {selectedCommunity.events.map((ev) => {
                        const rsvped = ev.rsvpUserIds.includes(viewerId);
                        return (
                          <Card key={ev.id} style={{ gap: 8 }}>
                            <Badge tone="primary">
                              📅 {new Date(ev.startsAt).toLocaleString('vi-VN')}
                            </Badge>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}>
                              {ev.title}
                            </Text>
                            <Text style={{ fontSize: 12.5, color: palette.inkMuted }}>
                              {ev.description}
                            </Text>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}>
                              📍 {ev.locationLabel} · 👥 {ev.rsvpUserIds.length} người đăng ký tham dự
                            </Text>
                            <Button
                              size="sm"
                              variant={rsvped ? 'secondary' : 'primary'}
                              onPress={() =>
                                toggleEventRsvp(selectedCommunity.id, ev.id, viewerId)
                              }
                            >
                              {rsvped
                                ? '✓ Đã đăng ký tham dự & Nhắc lịch (Hủy)'
                                : '🔔 Đăng ký tham dự (RSVP + Nhắc lịch)'}
                            </Button>
                          </Card>
                        );
                      })}
                    </View>
                  ) : null}

                  {communitySubTab === 'members' ? (
                    <Card style={{ gap: 10 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        🏆 Bảng Xếp Hạng Uy Tín & Phân Quyền RBAC
                      </Text>
                      <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                        Điểm uy tín tính theo đóng góp chất lượng (bình luận hữu ích, bài viết được đánh giá cao, chống spam).
                      </Text>
                      {[...selectedCommunity.members]
                        .sort((a, b) => b.reputationPoints - a.reputationPoints)
                        .map((mem, idx) => {
                          const canManageRoles =
                            user?.role === 'admin' ||
                            selectedCommunity.members.some(
                              (m) =>
                                m.userId === viewerId &&
                                (m.role === 'owner' || m.role === 'admin')
                            );
                          return (
                            <View
                              key={mem.userId}
                              style={[
                                styles.memberRow,
                                { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                              ]}
                            >
                              <Pressable
                                onPress={() =>
                                  router.push({
                                    pathname: '/user/[userId]',
                                    params: { userId: mem.userId },
                                  })
                                }
                                style={{ flex: 1, minWidth: 0 }}
                              >
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                                  #{idx + 1} · {mem.displayName}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                                  Vai trò: {mem.role.toUpperCase()} · ⭐ {mem.reputationPoints} điểm uy tín
                                  {mem.badges.length > 0 ? ` · 🏅 ${mem.badges.join(', ')}` : ''}
                                </Text>
                              </Pressable>

                              {canManageRoles && mem.role !== 'owner' ? (
                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                  {(['member', 'moderator', 'admin'] as CommunityRole[]).map(
                                    (r) => (
                                      <Pressable
                                        key={r}
                                        onPress={() => {
                                          updateCommunityMemberRole(
                                            selectedCommunity.id,
                                            viewerName,
                                            mem.userId,
                                            r
                                          );
                                          notifyToast(`Đã cập nhật quyền ${mem.displayName} → ${r}`);
                                        }}
                                        style={[
                                          styles.roleBtn,
                                          {
                                            backgroundColor:
                                              mem.role === r ? palette.indigo : palette.paper,
                                          },
                                        ]}
                                      >
                                        <Text
                                          style={{
                                            fontSize: 10.5,
                                            fontWeight: '800',
                                            color: mem.role === r ? '#FFF' : palette.ink,
                                          }}
                                        >
                                          {r}
                                        </Text>
                                      </Pressable>
                                    )
                                  )}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                    </Card>
                  ) : null}

                  {communitySubTab === 'moderation' ? (
                    <Card style={{ gap: 10 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        📜 Nội Quy Cộng Đồng
                      </Text>
                      {selectedCommunity.rules.map((rule, i) => (
                        <Text key={i} style={{ fontSize: 12.5, color: palette.ink }}>
                          {rule}
                        </Text>
                      ))}

                      <Text style={[typography.title, { color: palette.ink, marginTop: 8 }]}>
                        ⏳ Hàng Đợi Duyệt Bài Viết
                      </Text>
                      {socialPosts
                        .filter(
                          (p) =>
                            p.communityId === selectedCommunity.id &&
                            p.lifecycleStatus === 'pending_approval'
                        )
                        .map((pending) => (
                          <View
                            key={pending.id}
                            style={[
                              styles.memberRow,
                              { borderColor: palette.indigoBorder, backgroundColor: palette.paperRaised },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                                {pending.authorName}
                              </Text>
                              <Text style={{ fontSize: 12, color: palette.inkMuted }} numberOfLines={2}>
                                {pending.threadParts[0]}
                              </Text>
                            </View>
                            <Button
                              size="sm"
                              onPress={() => {
                                approvePendingPost(pending.id, true);
                                notifyToast('Đã duyệt xuất bản bài viết vào nhóm!');
                              }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => {
                                approvePendingPost(pending.id, false);
                                notifyToast('Đã từ chối bài viết chờ duyệt.');
                              }}
                            >
                              Từ chối
                            </Button>
                          </View>
                        ))}
                    </Card>
                  ) : null}
                </>
              )}
            </SmoothReveal>
          ) : null}

          {/* ===================================================================== */}
          {/* MODULE 3: SEPARATED ACADEMIC/POST DISCOVERY VS USER PROFILE SEARCH    */}
          {/* ===================================================================== */}
          {hubSection === 'discover' ? (
            <SmoothReveal style={{ gap: spacing.md }}>
              {/* Explicit Separation per Section 7.5: Document/Post Search vs User Search */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setDiscoverSubTab('documents_and_posts')}
                  style={[
                    styles.hubTabBtn,
                    {
                      backgroundColor:
                        discoverSubTab === 'documents_and_posts'
                          ? palette.indigo
                          : palette.paperRaised,
                      borderColor:
                        discoverSubTab === 'documents_and_posts'
                          ? palette.indigo
                          : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: discoverSubTab === 'documents_and_posts' ? '#FFF' : palette.ink,
                    }}
                  >
                    📚 Tra cứu Tài liệu · Bài viết · Tin tức
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDiscoverSubTab('users')}
                  style={[
                    styles.hubTabBtn,
                    {
                      backgroundColor:
                        discoverSubTab === 'users' ? palette.indigo : palette.paperRaised,
                      borderColor:
                        discoverSubTab === 'users' ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: discoverSubTab === 'users' ? '#FFF' : palette.ink,
                    }}
                  >
                    👥 Tìm Người Dùng & Bạn Bè
                  </Text>
                </Pressable>
              </View>

              {discoverSubTab === 'users' ? (
                <FriendsDiscoveryHub
                  onOpenDirectChat={(scholar) =>
                    router.push({
                      pathname: '/messages',
                      params: { peerId: scholar.id, peerName: scholar.name },
                    })
                  }
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  <Card style={{ gap: 10 }}>
                    <Text style={[typography.title, { color: palette.ink }]}>
                      🔎 Tra Cứu Học Thuật, Chuỗi Bài Viết & Hashtag (Hỗ trợ có dấu / không dấu)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={docSearchQuery}
                        onChangeText={setDocSearchQuery}
                        onSubmitEditing={() => {
                          if (docSearchQuery.trim()) {
                            recordSearchQuery(viewerId, docSearchQuery.trim());
                          }
                        }}
                        placeholder="Nhập khái niệm, bài viết, #hashtag, môn học (vd: deadlock, luong tu, lich su)..."
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.aiInput,
                          {
                            color: palette.ink,
                            backgroundColor: palette.paperRaised,
                            borderColor: palette.paperMuted,
                          },
                        ]}
                      />
                      {docSearchQuery.length > 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setDocSearchQuery('')}
                        >
                          Xóa
                        </Button>
                      ) : null}
                    </View>

                    {/* Recent Searches */}
                    {(mySlice?.recentSearchQueries.length ?? 0) > 0 ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 11.5, color: palette.inkMuted, fontWeight: '700' }}>
                          Tìm gần đây:
                        </Text>
                        {mySlice!.recentSearchQueries.map((q) => (
                          <Pressable
                            key={q}
                            onPress={() => setDocSearchQuery(q)}
                            style={[styles.utilChip, { backgroundColor: palette.paperRaised }]}
                          >
                            <Text style={{ fontSize: 11.5, color: palette.ink }}>{q}</Text>
                          </Pressable>
                        ))}
                        <Pressable onPress={() => clearSearchHistory(viewerId)}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: palette.danger }}>
                            Xóa lịch sử
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Card>

                  {/* Matched Threads Posts */}
                  {matchedSocialPosts.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        🧵 Chuỗi bài viết liên quan ({matchedSocialPosts.length})
                      </Text>
                      {matchedSocialPosts.map((p) => renderPostCard(p, 'Kết quả tìm kiếm'))}
                    </View>
                  ) : null}

                  {/* Matched Question Sets */}
                  {matchedQuestionSets.length > 0 ? (
                    <Card style={{ gap: 8 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        📘 Bộ Đề Học Tập Trong Thư Viện ({matchedQuestionSets.length})
                      </Text>
                      {matchedQuestionSets.map((qs) => (
                        <Pressable
                          key={qs.id}
                          onPress={() =>
                            router.push({ pathname: '/study/[setId]', params: { setId: qs.id } })
                          }
                          style={[
                            styles.memberRow,
                            { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                          ]}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                              {qs.title}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                              {qs.subject} · {qs.questions.length} câu hỏi
                            </Text>
                          </View>
                          <Ionicons name="play-circle" size={22} color={palette.indigo} />
                        </Pressable>
                      ))}
                    </Card>
                  ) : null}

                  {/* Live Academic Articles & Daily Knowledge Feed */}
                  <View style={{ gap: 10 }}>
                    <Text style={[typography.title, { color: palette.ink }]}>
                      {docSearchQuery.trim().length >= 2
                        ? `🌐 Tư Liệu Học Thuật Trực Tuyến (${searchingDocs ? 'Đang tìm...' : liveWikiResults.length})`
                        : '📰 Điểm Tin Tri Thức & Xu Hướng Hôm Nay'}
                    </Text>

                    {loadingDaily && docSearchQuery.trim().length < 2 ? (
                      <PapyrusPageSkeleton />
                    ) : (
                      (docSearchQuery.trim().length >= 2 ? liveWikiResults : dailyFeed).map(
                        (art) => (
                          <Card key={art.id} style={{ gap: 8 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Badge tone="primary">{art.category}</Badge>
                              <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                                {art.source}
                              </Text>
                            </View>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: palette.ink }}>
                              {art.title}
                            </Text>
                            <Text style={{ fontSize: 13, lineHeight: 20, color: palette.ink }}>
                              {art.summary}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onPress={() => {
                                  const cleanSentence = extractCompleteSentences(
                                    `${art.title}: ${art.summary}`,
                                    210
                                  );
                                  setStoryDraft({
                                    text: cleanSentence,
                                    subtext: `#${art.category.replace(/\s+/g, '')} · ${art.source}`,
                                    imageUri: art.thumbnailUrl || null,
                                  });
                                  setStoryComposerOpen(true);
                                }}
                              >
                                ✨ Chia sẻ lên Story 24h
                              </Button>
                              {art.url ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => void Linking.openURL(art.url)}
                                >
                                  Đọc nguồn gốc ↗
                                </Button>
                              ) : null}
                            </View>
                          </Card>
                        )
                      )
                    )}
                  </View>
                </View>
              )}
            </SmoothReveal>
          ) : null}
        </ScrollView>
      </View>

      {/* ===================================================================== */}
      {/* MODALS: STORIES, ADVANCED THREAD COMPOSER, YOUR ALGO, BOOKMARKS, ETC. */}
      {/* ===================================================================== */}
      <StoryViewerModal
        story={activeStory}
        viewerId={viewerId}
        onClose={() => setActiveStory(null)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
        onDirectMessage={(author) =>
          router.push({
            pathname: '/messages',
            params: {
              peerId: author.id,
              peerName: author.name,
              ...(author.replyText ? { initialText: author.replyText } : {}),
            },
          })
        }
      />

      <StoryComposerModal
        visible={storyComposerOpen}
        initialDraft={storyDraft}
        onClose={() => setStoryComposerOpen(false)}
        onPublish={(data) => {
          addStory({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: viewerAvatar,
            authorLevel: 1,
            badgeLabel: 'Thành viên Papyrus',
            text: data.text,
            subtext: data.subtext,
            gradient: data.gradient,
            mediaType: data.mediaType,
            imageUri: data.imageUri,
            videoUri: data.videoUri ?? null,
            thumbnailUri: data.thumbnailUri ?? data.imageUri,
            durationSec: data.durationSec,
            isHighlight: data.isHighlight,
          });
          addBonusXp(20);
          notifyToast('✨ Đã đăng Tin Story 24h thành công!');
        }}
      />

      <AdvancedThreadComposerModal
        visible={composerOpen}
        viewerId={viewerId}
        viewerName={viewerName}
        savedDraft={mySlice?.draft ?? null}
        quotedPost={quotedPost}
        communities={communities}
        knownUsers={Object.values(profilesById)}
        questionSets={allSets}
        onSaveDraft={(draft) => saveComposerDraft(viewerId, draft)}
        onClose={() => {
          setComposerOpen(false);
          setQuotedPost(null);
        }}
        onPublish={(payload) => {
          const created = createSocialPost({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: viewerAvatar,
            communityId: payload.communityId ?? composerCommunityId,
            postKind: payload.postKind,
            threadParts: payload.threadParts,
            longFormBody: payload.longFormBody,
            mediaItems: payload.mediaItems,
            poll: payload.poll,
            attachedQuiz: payload.attachedQuiz,
            codeSnippet: payload.codeSnippet,
            debate: payload.debate,
            repostOfId: payload.repostOfId,
            isQuote: payload.isQuote,
            isSpoiler: payload.isSpoiler,
            spoilerWarning: payload.spoilerWarning,
            isAnonymous: payload.isAnonymous,
            audience: payload.audience,
            replyPermission: payload.replyPermission,
            topics: payload.topics,
            hashtags: payload.hashtags,
            mentionedUserIds: payload.mentionedUserIds,
            locationLabel: payload.locationLabel,
            scheduledFor: payload.scheduledFor,
            ghostHours: payload.postKind === 'ghost' ? 24 : undefined,
          });
          addBonusXp(15);
          setQuotedPost(null);
          notifyToast(
            created.lifecycleStatus === 'scheduled'
              ? '⏰ Đã lên lịch xuất bản bài viết tự động!'
              : created.lifecycleStatus === 'pending_approval'
              ? '⏳ Bài viết đã vào hàng đợi Quản trị viên nhóm duyệt!'
              : created.postKind === 'ghost'
              ? '👻 Đã đăng Ghost Post (tự động hết hạn sau 24 giờ)!'
              : '🚀 Đã xuất bản chuỗi Thread thành công!'
          );
        }}
      />

      {/* Your Algo & Custom Feeds Controller Modal (Section 7.2 & 7.3) */}
      {algoModalOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setAlgoModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  ⚙️ Điều Khiển Thuật Toán (Your Algo) & Custom Feeds
                </Text>
                <Pressable onPress={() => setAlgoModalOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
                <Pressable
                  onPress={() =>
                    updateYourAlgo(viewerId, { knowledgeMode: !myAlgo.knowledgeMode })
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons
                    name={myAlgo.knowledgeMode ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={palette.indigo}
                  />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink, flex: 1 }}>
                    🧠 Luôn bật Chế độ Tri thức (Ưu tiên bài học thuật, code, quiz & phân tích sâu)
                  </Text>
                </Pressable>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                    🔇 Từ khóa tắt tiếng (Muted Keywords):
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      value={newMutedKeyword}
                      onChangeText={setNewMutedKeyword}
                      placeholder="Nhập từ khóa muốn ẩn khỏi Bảng tin..."
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.aiInput,
                        {
                          color: palette.ink,
                          borderColor: palette.paperMuted,
                          backgroundColor: palette.paperRaised,
                        },
                      ]}
                    />
                    <Button
                      size="sm"
                      onPress={() => {
                        if (!newMutedKeyword.trim()) return;
                        updateYourAlgo(viewerId, {
                          mutedKeywords: Array.from(
                            new Set([...myAlgo.mutedKeywords, newMutedKeyword.trim()])
                          ),
                        });
                        setNewMutedKeyword('');
                      }}
                    >
                      Ẩn
                    </Button>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {myAlgo.mutedKeywords.map((kw) => (
                      <Pressable
                        key={kw}
                        onPress={() =>
                          updateYourAlgo(viewerId, {
                            mutedKeywords: myAlgo.mutedKeywords.filter((x) => x !== kw),
                          })
                        }
                        style={[styles.utilChip, { backgroundColor: palette.dangerTint }]}
                      >
                        <Text style={{ fontSize: 11.5, color: palette.danger, fontWeight: '700' }}>
                          {kw} ✕
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                    📌 Tạo Bảng Tin Tùy Chỉnh (Custom Feed):
                  </Text>
                  <TextInput
                    value={newCustomFeedName}
                    onChangeText={setNewCustomFeedName}
                    placeholder="Tên Custom Feed (vd: Ôn Thi AI & Toán Rời Rạc)..."
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.aiInput,
                      {
                        color: palette.ink,
                        borderColor: palette.paperMuted,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  />
                  <TextInput
                    value={newCustomFeedTopics}
                    onChangeText={setNewCustomFeedTopics}
                    placeholder="Chủ đề cách nhau bởi dấu phẩy (vd: CNTT, AI, ToánLýHóa)..."
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.aiInput,
                      {
                        color: palette.ink,
                        borderColor: palette.paperMuted,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  />
                  <Button
                    size="sm"
                    disabled={!newCustomFeedName.trim()}
                    onPress={() => {
                      saveCustomFeed(viewerId, {
                        name: newCustomFeedName.trim(),
                        topics: newCustomFeedTopics
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                        accountIds: [],
                        communityIds: [],
                        isPinned: true,
                        isPublic: true,
                      });
                      setNewCustomFeedName('');
                      notifyToast('📌 Đã ghim Custom Feed mới lên thanh Bảng tin!');
                    }}
                  >
                    + Lưu & Ghim Custom Feed
                  </Button>

                  {(mySlice?.customFeeds ?? []).map((cf) => (
                    <View
                      key={cf.id}
                      style={[
                        styles.memberRow,
                        { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                      ]}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink, flex: 1 }}>
                        {cf.name} ({cf.topics.join(', ')})
                      </Text>
                      <Pressable onPress={() => deleteCustomFeed(viewerId, cf.id)}>
                        <Ionicons name="trash-outline" size={16} color={palette.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    resetYourAlgo(viewerId);
                    notifyToast('Đã khôi phục mặc định cho Your Algo!');
                  }}
                >
                  Đặt lại mặc định
                </Button>
                <Button onPress={() => setAlgoModalOpen(false)}>Xong</Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Saved Bookmarks, Smart Collections, Favourites & Scheduled/Archived Drawer */}
      {bookmarksDrawerOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setBookmarksDrawerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  🔖 Kho Lưu Trữ Cá Nhân (Riêng tư)
                </Text>
                <Pressable onPress={() => setBookmarksDrawerOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(
                  [
                    {
                      id: 'bookmarks',
                      label: `🔖 Bookmark (${mySlice?.bookmarkedPostIds.length ?? 0})`,
                    },
                    {
                      id: 'favourites',
                      label: `⭐ Yêu thích (${mySlice?.favouritePostIds.length ?? 0})`,
                    },
                    { id: 'scheduled', label: '⏰ Hẹn giờ & Lưu trữ' },
                  ] as const
                ).map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setBookmarkTab(t.id)}
                    style={[
                      styles.modePill,
                      {
                        backgroundColor:
                          bookmarkTab === t.id ? palette.indigo : palette.paperRaised,
                        borderColor: bookmarkTab === t.id ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: bookmarkTab === t.id ? '#FFF' : palette.ink,
                      }}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {bookmarkTab === 'bookmarks' ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TextInput
                    value={newColName}
                    onChangeText={setNewColName}
                    placeholder="Tạo thư mục sưu tập mới (vd: Giải Tích 2)..."
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.aiInput,
                      {
                        color: palette.ink,
                        borderColor: palette.paperMuted,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  />
                  <Button
                    size="sm"
                    disabled={!newColName.trim()}
                    onPress={() => {
                      createBookmarkCollection(viewerId, newColName.trim(), '📂');
                      setNewColName('');
                    }}
                  >
                    + Thư mục
                  </Button>
                </View>
              ) : null}

              <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
                {bookmarkTab === 'bookmarks' &&
                  socialPosts
                    .filter((p) => mySlice?.bookmarkedPostIds.includes(p.id))
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setBookmarksDrawerOpen(false);
                          router.push({ pathname: '/post/[postId]', params: { postId: p.id } });
                        }}
                        style={[
                          styles.memberRow,
                          { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                            {p.authorName}
                          </Text>
                          <Text style={{ fontSize: 12, color: palette.inkMuted }} numberOfLines={2}>
                            {p.threadParts[0]}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={18} color={palette.indigo} />
                      </Pressable>
                    ))}

                {bookmarkTab === 'favourites' &&
                  socialPosts
                    .filter((p) => mySlice?.favouritePostIds.includes(p.id))
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setBookmarksDrawerOpen(false);
                          router.push({ pathname: '/post/[postId]', params: { postId: p.id } });
                        }}
                        style={[
                          styles.memberRow,
                          { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                            ⭐ {p.authorName}
                          </Text>
                          <Text style={{ fontSize: 12, color: palette.inkMuted }} numberOfLines={2}>
                            {p.threadParts[0]}
                          </Text>
                        </View>
                        <Ionicons name="open-outline" size={18} color={palette.indigo} />
                      </Pressable>
                    ))}

                {bookmarkTab === 'scheduled' &&
                  socialPosts
                    .filter(
                      (p) =>
                        (p.internalAuthorId || p.authorId) === viewerId &&
                        (p.lifecycleStatus === 'scheduled' || p.lifecycleStatus === 'archived')
                    )
                    .map((p) => (
                      <View
                        key={p.id}
                        style={[
                          styles.memberRow,
                          { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Badge tone="primary">
                            {p.lifecycleStatus === 'scheduled'
                              ? `⏰ Hẹn giờ: ${p.scheduledFor}`
                              : '🗄️ Đã lưu trữ'}
                          </Badge>
                          <Text
                            style={{ fontSize: 12.5, color: palette.ink, marginTop: 4 }}
                            numberOfLines={2}
                          >
                            {p.threadParts[0]}
                          </Text>
                        </View>
                        <Button
                          size="sm"
                          onPress={() => {
                            deleteOrArchivePost(p.id, viewerId, 'restore');
                            notifyToast('Đã khôi phục bài viết lên Bảng tin!');
                          }}
                        >
                          Đăng ngay
                        </Button>
                      </View>
                    ))}
              </ScrollView>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Create Community Modal */}
      {createCommOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setCreateCommOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                🏛️ Tạo Nhóm / Cộng Đồng Mới
              </Text>
              <TextInput
                value={commName}
                onChangeText={setCommName}
                placeholder="Tên Cộng đồng..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <TextInput
                value={commDesc}
                onChangeText={setCommDesc}
                placeholder="Mô tả mục tiêu & chủ đề thảo luận..."
                placeholderTextColor={palette.inkMuted}
                multiline
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                    minHeight: 68,
                  },
                ]}
              />
              <TextInput
                value={commTopics}
                onChangeText={setCommTopics}
                placeholder="Chủ đề (vd: CNTT, AI, ÔnThi)..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(
                  [
                    { id: 'public', label: '🌍 Công khai' },
                    { id: 'private', label: '🔒 Riêng tư' },
                    { id: 'hidden', label: '🕵️ Nhóm Ẩn' },
                  ] as const
                ).map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => setCommVisibility(v.id)}
                    style={[
                      styles.modePill,
                      {
                        backgroundColor:
                          commVisibility === v.id ? palette.indigo : palette.paperRaised,
                        borderColor:
                          commVisibility === v.id ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: commVisibility === v.id ? '#FFF' : palette.ink,
                      }}
                    >
                      {v.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => setCommPostApproval((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons
                  name={commPostApproval ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={palette.indigo}
                />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.ink }}>
                  Yêu cầu Quản trị viên duyệt bài trước khi hiển thị
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setCreateCommOpen(false)}>
                  Hủy
                </Button>
                <Button
                  disabled={!commName.trim()}
                  onPress={() => {
                    const created = createCommunity({
                      ownerId: viewerId,
                      ownerName: viewerName,
                      name: commName.trim(),
                      description: commDesc.trim() || 'Cộng đồng thảo luận học tập trên Papyrus.',
                      visibility: commVisibility,
                      topics: commTopics
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                      rules: [
                        '1. Tôn trọng các thành viên và dẫn nguồn tài liệu rõ ràng.',
                        '2. Không spam quảng cáo ngoài chủ đề học thuật.',
                      ],
                      requirePostApproval: commPostApproval,
                    });
                    setCommName('');
                    setCommDesc('');
                    setCreateCommOpen(false);
                    setSelectedCommunityId(created.id);
                    notifyToast(`🎉 Đã tạo Cộng đồng «${created.name}»!`);
                  }}
                >
                  Tạo Cộng đồng
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Create Community Event Modal */}
      {createEventOpen && selectedCommunity ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setCreateEventOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                📅 Tạo Sự Kiện Cộng Đồng
              </Text>
              <TextInput
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Tên sự kiện (vd: Live Giải Đề Cuối Kỳ)..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <TextInput
                value={eventDesc}
                onChangeText={setEventDesc}
                placeholder="Nội dung chi tiết..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <TextInput
                value={eventLocation}
                onChangeText={setEventLocation}
                placeholder="Địa điểm / Phòng Live..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.aiInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setCreateEventOpen(false)}>
                  Hủy
                </Button>
                <Button
                  disabled={!eventTitle.trim()}
                  onPress={() => {
                    createCommunityEvent({
                      communityId: selectedCommunity.id,
                      creatorId: viewerId,
                      creatorName: viewerName,
                      title: eventTitle.trim(),
                      description: eventDesc.trim(),
                      locationLabel: eventLocation.trim(),
                      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                    });
                    setEventTitle('');
                    setEventDesc('');
                    setCreateEventOpen(false);
                    notifyToast('📅 Đã tạo sự kiện mới cho Cộng đồng!');
                  }}
                >
                  Đăng sự kiện
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  msgShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  msgBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  toastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  hubTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
  },
  hubTabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickComposeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  utilChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  aiInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 12.5,
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  commIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announceBox: {
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  roleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 520,
    gap: 10,
  },
});
