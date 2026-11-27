import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { PapyrusPageSkeleton } from '@/shared/PapyrusLoader';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { extractCompleteSentences } from '@/features/scan-ocr/domain/ocrCleaner';
import { seedQuestionSets } from '@/composition/preferences';
import {
  fetchDailyUpdatedKnowledgeFeed,
  pickEditorialPhotoFallback,
  searchAcademicKnowledgeLive,
} from '@/composition/platform';
import { askPapyAiFeedAssistant } from '@/composition/social';
import {
  groupStoriesByAuthor,
  isStoryActive24h,
  type DailyKnowledgeArticle,
  type ScholarStory,
} from '@/features/community/domain/models';
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

const QUICK_SEARCH_TOPICS = [
  'Trí tuệ nhân tạo',
  'Google Gemini',
  'Bán dẫn & Lượng tử',
  'Kỹ thuật Phần mềm',
  'Khoa học Vũ trụ',
  'Lịch sử Việt Nam',
];

function buildSourceDocFromArticle(art: DailyKnowledgeArticle) {
  const body = `${art.title}\n\nNguồn: ${art.source} (${art.category})\nLiên kết: ${art.url}\n\n${art.summary}`;
  return {
    id: `src-${art.id}-${Date.now()}`,
    title: art.title,
    text: body,
    createdAt: new Date().toISOString(),
  };
}

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
  const isCompactHeader = width < 600;
  const refreshTick = useRouteRefreshStore((s) => s.refreshTick);
  const searchSeqRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);

  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const isGuest = !user || viewerId === 'guest';
  const viewerName = user?.displayName?.trim() || 'Khách';
  const viewerAvatar = user?.avatarUrl ?? null;

  const addBonusXp = usePapyrusStore((s) => s.addBonusXp);
  const saveSourceDocument = usePapyrusStore((s) => s.saveSourceDocument);
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(
    () => (storeSets.length > 0 ? storeSets : seedQuestionSets),
    [storeSets]
  );

  // 24h Stories (grouped into 1 single box per user)
  const stories = useCommunityStore((s) => s.stories);
  const addStory = useCommunityStore((s) => s.addStory);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);
  const reactToStory = useCommunityStore((s) => s.reactToStory);
  const [storyNowMs, setStoryNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setStoryNowMs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const groupedActiveStories = useMemo(() => {
    const activeOnly = stories.filter((s) => isStoryActive24h(s, storyNowMs));
    return groupStoriesByAuthor(activeOnly);
  }, [stories, storyNowMs]);

  // Production Social Media & Threads Store
  const profilesById = useSocialStore((s) => s.profilesById);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const socialPosts = useSocialStore((s) => s.posts);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const userSlices = useSocialStore((s) => s.userSlices);

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

  const [feedMode, setFeedMode] = useState<FeedModeType>('for_you');
  const [selectedCustomFeedId, setSelectedCustomFeedId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>(params.topic || 'ALL');
  const [locationConsent, setLocationConsent] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState(8);

  const [aiAlgoOpen, setAiAlgoOpen] = useState(false);
  const [aiFeedPrompt, setAiFeedPrompt] = useState('');
  const [aiAssistantBusy, setAiAssistantBusy] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const [activeStoryGroup, setActiveStoryGroup] = useState<ScholarStory[] | null>(null);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{
    text?: string;
    subtext?: string;
    imageUri?: string | null;
  } | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [quotedPost, setQuotedPost] = useState<SocialPostItem | null>(null);
  const [composerCommunityId, setComposerCommunityId] = useState<string | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{
    text: string;
    topics?: string;
    communityId?: string | null;
  } | null>(null);

  const [algoModalOpen, setAlgoModalOpen] = useState(false);
  const [newMutedKeyword, setNewMutedKeyword] = useState('');
  const [newCustomFeedName, setNewCustomFeedName] = useState('');
  const [newCustomFeedTopics, setNewCustomFeedTopics] = useState('');

  const [bookmarksDrawerOpen, setBookmarksDrawerOpen] = useState(false);
  const [bookmarkTab, setBookmarkTab] = useState<'bookmarks' | 'favourites' | 'scheduled'>(
    'bookmarks'
  );
  const [newColName, setNewColName] = useState('');

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
  const [commTopics, setCommTopics] = useState('');
  const [commPostApproval, setCommPostApproval] = useState(false);

  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocation, setEventLocation] = useState('Phòng thảo luận trực tuyến');

  // Realtime Search Engine State
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [searchingDocs, setSearchingDocs] = useState(false);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const [liveWikiResults, setLiveWikiResults] = useState<DailyKnowledgeArticle[]>([]);
  const [dailyFeed, setDailyFeed] = useState<DailyKnowledgeArticle[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  );
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  const notifyToast = useCallback((text: string) => {
    setStatusToast(text);
    setTimeout(() => setStatusToast(null), 3000);
  }, []);

  const requireSignedIn = useCallback(
    (reason = 'tương tác hoặc đăng nội dung') => {
      if (!isGuest) return true;
      notifyToast(`Vui lòng đăng nhập để ${reason}.`);
      return false;
    },
    [isGuest, notifyToast]
  );

  const reloadDailyTrending = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const items = await fetchDailyUpdatedKnowledgeFeed(true);
      setDailyFeed(items);
      setLastSyncedAt(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      );
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchDailyUpdatedKnowledgeFeed()
      .then((items) => {
        if (!active) return;
        setDailyFeed(items);
        setLastSyncedAt(
          new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        );
      })
      .finally(() => {
        if (active) setLoadingDaily(false);
      });
    return () => {
      active = false;
    };
  }, [refreshTick]);

  const executeLiveSearch = useCallback(async (rawQuery: string) => {
    const clean = rawQuery.trim();
    searchAbortRef.current?.abort();
    if (clean.length < 2) {
      searchSeqRef.current += 1;
      setSearchingDocs(false);
      setHasCompletedSearch(false);
      setLiveWikiResults([]);
      return;
    }
    const seq = ++searchSeqRef.current;
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearchingDocs(true);
    try {
      const res = await searchAcademicKnowledgeLive(clean, ctrl.signal);
      if (seq !== searchSeqRef.current || ctrl.signal.aborted) return;
      setLiveWikiResults(res);
      setHasCompletedSearch(true);
      setLastSyncedAt(
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      );
    } finally {
      if (seq === searchSeqRef.current) {
        setSearchingDocs(false);
      }
    }
  }, []);

  useEffect(() => {
    const clean = docSearchQuery.trim();
    if (clean.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      void executeLiveSearch(clean);
    }, 240);
    return () => clearTimeout(t);
  }, [docSearchQuery, executeLiveSearch]);

  const handleResetSearchEngine = () => {
    searchAbortRef.current?.abort();
    searchSeqRef.current += 1;
    setDocSearchQuery('');
    setSearchingDocs(false);
    setHasCompletedSearch(false);
    setLiveWikiResults([]);
    setBrokenThumbs({});
    void reloadDailyTrending();
    notifyToast('Đã đặt lại công cụ tra cứu và làm mới nguồn tin thời gian thực.');
  };

  const graph = useMemo(
    () => ({ follows, friendRequests, relations, communities }),
    [communities, follows, friendRequests, relations]
  );

  const unreadMessagesTotal = useMemo(
    () =>
      isGuest
        ? 0
        : conversations.reduce((acc, c) => acc + (c.unreadByUserIds[viewerId] ?? 0), 0) +
          conversations.filter((c) => c.requestState === 'pending').length,
    [conversations, isGuest, viewerId]
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
          if (!requireSignedIn('theo dõi thành viên')) return;
          const out = toggleFollowUser(viewerId, targetId);
          notifyToast(
            out === 'requested'
              ? 'Đã gửi yêu cầu theo dõi.'
              : out === 'followed'
              ? 'Đã theo dõi.'
              : 'Đã bỏ theo dõi.'
          );
        }}
        onReactPost={(pid, reaction) => {
          if (!requireSignedIn('thả cảm xúc')) return;
          togglePostEmojiReaction(pid, reaction, viewerId);
        }}
        onTogglePureRepost={(pid) => {
          if (!requireSignedIn('đăng lại bài viết')) return;
          const added = togglePureRepost(pid, viewerId);
          notifyToast(added ? 'Đã đăng lại lên trang cá nhân.' : 'Đã hoàn tác đăng lại.');
        }}
        onOpenQuoteComposer={(target) => {
          if (!requireSignedIn('trích dẫn bài viết')) return;
          setQuotedPost(target);
          setComposerPrefill(null);
          setComposerCommunityId(null);
          setComposerOpen(true);
        }}
        onToggleBookmark={(pid, colId) => {
          const saved = toggleSaveBookmark(viewerId, pid, colId);
          notifyToast(saved ? 'Đã lưu bài viết.' : 'Đã bỏ lưu bài viết.');
        }}
        onToggleFavourite={(pid) => {
          const fav = toggleFavouritePost(viewerId, pid);
          notifyToast(fav ? 'Đã thêm vào Yêu thích.' : 'Đã gỡ khỏi Yêu thích.');
        }}
        onTogglePin={(pid, scope) => {
          if (!requireSignedIn('ghim bài viết')) return;
          togglePinPost(pid, scope);
          notifyToast('Đã cập nhật trạng thái ghim.');
        }}
        onEditPost={(pid, nextParts, nextLongForm) => {
          if (!requireSignedIn('chỉnh sửa bài viết')) return;
          editSocialPost(pid, viewerId, nextParts, nextLongForm);
          notifyToast('Đã lưu chỉnh sửa.');
        }}
        onDeleteOrArchive={(pid, mode) => {
          if (!requireSignedIn('quản lý bài viết')) return;
          deleteOrArchivePost(pid, viewerId, mode);
          notifyToast(mode === 'archive' ? 'Đã lưu trữ bài viết.' : 'Đã xóa bài viết.');
        }}
        onSummarizeAi={(pid) => summarizePostWithAi(pid)}
        onVotePoll={(pid, optId) => {
          if (!requireSignedIn('bình chọn khảo sát')) return;
          voteUnifiedPoll('post', pid, optId, viewerId);
        }}
        onAddPollOption={(pid, text) => {
          if (!requireSignedIn('thêm lựa chọn khảo sát')) return;
          addUnifiedPollOption('post', pid, text, { id: viewerId, name: viewerName });
        }}
        onToggleClosePoll={(pid) => {
          if (!requireSignedIn('đóng khảo sát')) return;
          toggleCloseUnifiedPoll('post', pid, viewerId);
        }}
        onVoteDebate={(pid, side) => {
          if (!requireSignedIn('bình chọn tranh biện')) return;
          voteDebateSide(pid, side, viewerId);
        }}
        onAddDebateArgument={(pid, side, content) => {
          if (!requireSignedIn('gửi lập luận')) return;
          addDebateArgument(
            pid,
            side,
            { id: viewerId, name: viewerName, avatar: viewerAvatar },
            content
          );
        }}
        onAddReply={(input) => {
          if (!requireSignedIn('bình luận')) return;
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
        onReactComment={(pid, cid, reaction) => {
          if (!requireSignedIn('thả cảm xúc')) return;
          toggleCommentReaction(pid, cid, reaction, viewerId);
        }}
        onPinComment={(pid, cid) => togglePinComment(pid, cid)}
        onShareToTarget={(targetPost, dest, note) => {
          if (!requireSignedIn('chia sẻ bài viết')) return;
          sharePostToDestination(
            targetPost,
            { id: viewerId, name: viewerName, avatar: viewerAvatar },
            dest,
            note
          );
          notifyToast(
            dest.type === 'conversation'
              ? 'Đã gửi bài viết vào cuộc trò chuyện.'
              : 'Đã chia sẻ bài viết vào nhóm.'
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
            notifyToast('Sẽ ưu tiên hiển thị nội dung tương tự.');
          } else if (action === 'less') {
            updateYourAlgo(viewerId, {
              showLessAccountIds: Array.from(new Set([...myAlgo.showLessAccountIds, realAuthor])),
            });
            notifyToast('Đã giảm tần suất hiển thị nội dung tương tự.');
          } else if (action === 'not_interested') {
            updateYourAlgo(viewerId, {
              notInterestedPostIds: Array.from(new Set([...myAlgo.notInterestedPostIds, p.id])),
            });
            notifyToast('Đã ẩn bài viết khỏi bảng tin.');
          } else if (action === 'hide_topic') {
            updateYourAlgo(viewerId, {
              hiddenTopics: Array.from(new Set([...myAlgo.hiddenTopics, ...p.topics])),
            });
            notifyToast('Đã ẩn chủ đề này trên bảng tin.');
          }
        }}
        onBlockOrMuteAuthor={(authorId, kind) => {
          if (!requireSignedIn('chặn hoặc tắt tiếng tài khoản')) return;
          toggleUserRelation(viewerId, authorId, kind);
          notifyToast(
            kind === 'block' ? 'Đã chặn tài khoản này.' : 'Đã tắt tiếng bài viết từ tài khoản này.'
          );
        }}
        onReportTarget={(targetType, targetId, preview, ownerId) => {
          if (!requireSignedIn('báo cáo nội dung')) return;
          submitModerationReport({
            reporterId: viewerId,
            reporterName: viewerName,
            targetType,
            targetId,
            targetPreview: preview,
            targetOwnerId: ownerId,
            reason: 'Báo cáo nội dung từ Cộng đồng',
            details: 'Người dùng yêu cầu đội ngũ kiểm duyệt xem xét.',
          });
          notifyToast('Đã gửi báo cáo tới bộ phận kiểm duyệt.');
        }}
      />
    );
  };

  return (
    <Screen
      bottomNav
      maxWidth={960}
      scrollResetKey={`${hubSection}:${discoverSubTab}:${selectedCommunityId ?? ''}`}
      onPullRefresh={reloadDailyTrending}
    >
      <View style={styles.container}>
        <TopBar
          title={isCompactHeader ? 'Cộng đồng' : 'Mạng Xã Hội & Cộng Đồng'}
          subtitle={
            isCompactHeader ? 'Bảng tin · Nhóm · Tra cứu' : 'Bảng tin · Nhóm học tập · Tin 24h · Tra cứu'
          }
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở Tin nhắn"
                onPress={() => router.push('/messages')}
                style={[
                  styles.msgShortcutBtn,
                  isCompactHeader && { paddingHorizontal: 8 },
                  { backgroundColor: palette.paperRaised, borderColor: palette.indigoBorder },
                ]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.indigo} />
                {!isCompactHeader ? (
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                    Tin nhắn
                  </Text>
                ) : null}
                {unreadMessagesTotal > 0 ? (
                  <View style={[styles.msgBadge, { backgroundColor: palette.danger }]}>
                    <Text style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '900' }}>
                      {unreadMessagesTotal}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đăng bài viết mới"
                onPress={() => {
                  if (!requireSignedIn('đăng bài viết mới')) return;
                  setQuotedPost(null);
                  setComposerPrefill(null);
                  setComposerCommunityId(selectedCommunity?.id ?? null);
                  setComposerOpen(true);
                }}
                style={[styles.composeTopBtn, { backgroundColor: palette.indigo }]}
              >
                <Ionicons name="create-outline" size={15} color={palette.onPrimary} />
                <Text style={{ color: palette.onPrimary, fontSize: 12, fontWeight: '800' }}>
                  {isCompactHeader ? 'Đăng' : 'Đăng bài'}
                </Text>
              </Pressable>
            </View>
          }
        />

        {statusToast ? (
          <View style={[styles.toastBar, { backgroundColor: palette.indigo }]}>
            <Ionicons name="information-circle-outline" size={16} color={palette.onPrimary} />
            <Text
              style={{
                color: palette.onPrimary,
                fontSize: 12.5,
                fontWeight: '700',
                flexShrink: 1,
              }}
            >
              {statusToast}
            </Text>
          </View>
        ) : null}

        {/* Primary Module Switcher */}
        <View style={styles.hubTabsRow}>
          {(
            [
              { id: 'feeds', label: 'Bảng tin', icon: 'newspaper-outline' as const },
              {
                id: 'communities',
                label: `Nhóm (${communities.length})`,
                icon: 'people-outline' as const,
              },
              { id: 'discover', label: 'Tra cứu & Bạn bè', icon: 'search-outline' as const },
            ] as const
          ).map((sec) => {
            const active = hubSection === sec.id;
            return (
              <Pressable
                key={sec.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setHubSection(sec.id)}
                style={[
                  styles.hubTabBtn,
                  {
                    backgroundColor: active ? palette.indigo : palette.paperRaised,
                    borderColor: active ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Ionicons
                  name={sec.icon}
                  size={14}
                  color={active ? palette.onPrimary : palette.indigo}
                />
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '800',
                    color: active ? palette.onPrimary : palette.ink,
                  }}
                  numberOfLines={1}
                >
                  {sec.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            paddingTop: spacing.xs,
            gap: spacing.md,
          }}
        >
          {/* ===================================================================== */}
          {/* MODULE 1: THREADS FEED + 24H SINGLE-BOX GROUPED STORIES               */}
          {/* ===================================================================== */}
          {hubSection === 'feeds' ? (
            <View style={{ gap: spacing.md }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
              >
                <CreateStoryCard916
                  displayName={viewerName}
                  avatarUrl={viewerAvatar}
                  onPress={() => {
                    if (!requireSignedIn('đăng tin 24 giờ')) return;
                    setStoryDraft(null);
                    setStoryComposerOpen(true);
                  }}
                />
                {groupedActiveStories.map((grp) => (
                  <StoryCard916
                    key={grp.authorId}
                    story={grp.coverStory}
                    totalCount={grp.stories.length}
                    seen={grp.stories.every((s) => s.viewedByIds.includes(viewerId))}
                    onPress={() => {
                      setActiveStoryGroup(grp.stories);
                    }}
                  />
                ))}
              </ScrollView>

              {/* Clean Quick Composer Card */}
              <Pressable
                onPress={() => {
                  if (!requireSignedIn('đăng bài viết mới')) return;
                  setQuotedPost(null);
                  setComposerPrefill(null);
                  setComposerCommunityId(null);
                  setComposerOpen(true);
                }}
                style={[
                  styles.quickComposeCard,
                  { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                ]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: palette.indigo }]}>
                  {viewerAvatar ? (
                    <Image source={{ uri: viewerAvatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={{ color: palette.onPrimary, fontWeight: '800', fontSize: 14 }}>
                      {(viewerName[0] || 'P').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}>
                    {isGuest ? 'Đăng nhập để chia sẻ bài viết' : viewerName}
                  </Text>
                  <Text style={{ fontSize: 12.5, color: palette.inkMuted }} numberOfLines={1}>
                    {!isGuest && mySlice?.draft
                      ? `Tiếp tục bản nháp: "${mySlice.draft.threadParts[0] || 'Đang soạn...'}"`
                      : 'Bạn đang nghĩ gì? Chia sẻ câu hỏi, kiến thức hoặc hình ảnh...'}
                  </Text>
                </View>
                <Badge tone="primary">Đăng bài</Badge>
              </Pressable>

              {/* Feed Mode Selector (Clean text labels without noisy leading emojis) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, alignItems: 'center' }}
              >
                {(
                  [
                    { id: 'for_you', label: 'Dành cho bạn' },
                    { id: 'following', label: 'Đang theo dõi' },
                    { id: 'friends', label: 'Bạn bè' },
                    { id: 'trending', label: 'Thịnh hành' },
                    { id: 'knowledge', label: 'Học thuật' },
                    { id: 'debate', label: 'Tranh biện' },
                    { id: 'nearby', label: 'Khu vực' },
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
                          backgroundColor: active ? palette.indigo : palette.paperRaised,
                          borderColor: active ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: active ? palette.onPrimary : palette.ink,
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
                            backgroundColor: active ? palette.gold : palette.paperRaised,
                            borderColor: active ? palette.goldBorder : palette.indigoBorder,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: active ? palette.onGold : palette.indigo,
                          }}
                        >
                          {cf.name}
                        </Text>
                      </Pressable>
                    );
                  })}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAiAlgoOpen((v) => !v)}
                  style={[
                    styles.utilChip,
                    {
                      backgroundColor: aiAlgoOpen ? palette.indigoTint : palette.paperRaised,
                      borderColor: palette.paperMuted,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons name="sparkles-outline" size={13} color={palette.indigo} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                    Lọc bằng AI
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAlgoModalOpen(true)}
                  style={[
                    styles.utilChip,
                    {
                      backgroundColor: palette.paperRaised,
                      borderColor: palette.paperMuted,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons name="options-outline" size={14} color={palette.inkMuted} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                    Tùy chỉnh
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setBookmarksDrawerOpen(true)}
                  style={[
                    styles.utilChip,
                    {
                      backgroundColor: palette.paperRaised,
                      borderColor: palette.paperMuted,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons name="bookmark-outline" size={14} color={palette.inkMuted} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                    Đã lưu ({mySlice?.bookmarkedPostIds.length ?? 0})
                  </Text>
                </Pressable>
              </ScrollView>

              {aiAlgoOpen ? (
                <Card style={{ padding: spacing.sm, gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      value={aiFeedPrompt}
                      onChangeText={setAiFeedPrompt}
                      placeholder="Nhập chủ đề muốn ưu tiên hoặc ẩn..."
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.aiInput,
                        {
                          color: palette.ink,
                          backgroundColor: palette.paper,
                          borderColor: palette.paperMuted,
                        },
                      ]}
                    />
                    <Button
                      size="sm"
                      disabled={!aiFeedPrompt.trim() || aiAssistantBusy}
                      onPress={() => void handleAskAiFeedAssistant()}
                    >
                      {aiAssistantBusy ? 'Đang lọc...' : 'Áp dụng'}
                    </Button>
                  </View>
                </Card>
              ) : null}

              {/* Nearby Location Cluster Panel */}
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
                        Thảo luận theo khu vực
                      </Text>
                      <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                        Hiển thị bài viết theo tỉnh hoặc thành phố khi bạn bật, không chia sẻ vị trí chính xác.
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant={locationConsent ? 'secondary' : 'primary'}
                      onPress={() => setLocationConsent((v) => !v)}
                    >
                      {locationConsent ? 'Tắt khu vực' : 'Chọn khu vực'}
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
                              fontWeight: '700',
                              color: selectedArea === area ? palette.onPrimary : palette.ink,
                            }}
                          >
                            {area === 'ALL' ? 'Tất cả khu vực' : area}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </Card>
              ) : null}

              {/* Trending Hashtag Chips (only rendered when real posts have tags) */}
              {trendingHashtags.length > 0 ? (
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
                          selectedTopic === 'ALL' ? palette.indigoTint : palette.paperRaised,
                        borderColor:
                          selectedTopic === 'ALL' ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                      Tất cả
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
                            selectedTopic === tag ? palette.indigoTint : palette.paperRaised,
                          borderColor:
                            selectedTopic === tag ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                        #{tag} ({score})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {/* Feed Stream */}
              {paginatedFeedItems.length === 0 ? (
                <Card style={{ alignItems: 'center', gap: 10, paddingVertical: spacing.xl }}>
                  <Ionicons name="chatbubbles-outline" size={28} color={palette.indigo} />
                  <Text style={[typography.title, { color: palette.ink, textAlign: 'center' }]}>
                    Chưa có bài viết nào trong mục này
                  </Text>
                  <Text
                    style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}
                  >
                    Hãy là người đầu tiên chia sẻ kiến thức hoặc đặt câu hỏi thảo luận cùng cộng đồng.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {feedMode !== 'for_you' || selectedTopic !== 'ALL' || selectedCustomFeedId ? (
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setFeedMode('for_you');
                          setSelectedTopic('ALL');
                          setSelectedCustomFeedId(null);
                        }}
                      >
                        Xem tất cả bài viết
                      </Button>
                    ) : null}
                    <Button
                      onPress={() => {
                        if (!requireSignedIn('đăng bài viết mới')) return;
                        setComposerOpen(true);
                      }}
                    >
                      Đăng bài mới
                    </Button>
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
                      Xem thêm ({rankedFeedItems.length - pageSize} bài viết)
                    </Button>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* ===================================================================== */}
          {/* MODULE 2: COMMUNITIES / GROUPS                                        */}
          {/* ===================================================================== */}
          {hubSection === 'communities' ? (
            <View style={{ gap: spacing.md }}>
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
                          Nhóm học tập & chuyên môn
                        </Text>
                        <Text style={[typography.caption, { color: palette.inkMuted }]}>
                          Tham gia thảo luận theo chuyên ngành, chia sẻ tài liệu và tạo lịch ôn tập nhóm.
                        </Text>
                      </View>
                      <Button
                        icon="add-circle-outline"
                        onPress={() => {
                          if (!requireSignedIn('tạo nhóm mới')) return;
                          setCreateCommOpen(true);
                        }}
                      >
                        Tạo nhóm
                      </Button>
                    </View>
                  </Card>

                  {communities
                    .filter(
                      (c) =>
                        !c.isSuspended &&
                        (c.visibility !== 'hidden' ||
                          c.members.some((m) => m.userId === viewerId))
                    )
                    .map((comm) => {
                      const myEntry = comm.members.find((m) => m.userId === viewerId);
                      return (
                        <Card key={comm.id} style={{ gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={[
                                styles.commIconBox,
                                { backgroundColor: palette.indigoTint },
                              ]}
                            >
                              <Ionicons name="people" size={22} color={palette.indigo} />
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
                                  style={{ fontSize: 15, fontWeight: '800', color: palette.ink }}
                                >
                                  {comm.name}
                                </Text>
                                <Badge
                                  tone={comm.visibility === 'public' ? 'success' : 'primary'}
                                >
                                  {comm.visibility === 'public'
                                    ? 'Công khai'
                                    : comm.visibility === 'private'
                                    ? 'Riêng tư'
                                    : 'Nhóm ẩn'}
                                </Badge>
                              </View>
                              <Text
                                style={{ fontSize: 12, color: palette.inkMuted, marginTop: 2 }}
                              >
                                {comm.members.length} thành viên · {comm.events.length} sự kiện
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
                              Vào nhóm
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => {
                                if (!requireSignedIn('tham gia nhóm')) return;
                                const state = joinOrLeaveCommunity(comm.id, {
                                  id: viewerId,
                                  name: viewerName,
                                  avatar: viewerAvatar,
                                });
                                notifyToast(
                                  state === 'pending'
                                    ? 'Đã gửi yêu cầu tham gia nhóm.'
                                    : state === 'joined'
                                    ? `Đã tham gia ${comm.name}.`
                                    : 'Đã rời khỏi nhóm.'
                                );
                              }}
                            >
                              {myEntry
                                ? myEntry.role === 'pending'
                                  ? 'Đang chờ duyệt (Hủy)'
                                  : 'Đã tham gia'
                                : comm.requireMemberApproval
                                ? 'Gửi yêu cầu'
                                : 'Tham gia'}
                            </Button>
                          </View>
                        </Card>
                      );
                    })}
                </>
              ) : (
                <>
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
                          Danh sách nhóm
                        </Text>
                      </Pressable>

                      <Button
                        size="sm"
                        icon="create-outline"
                        onPress={() => {
                          if (!requireSignedIn('đăng bài vào nhóm')) return;
                          setQuotedPost(null);
                          setComposerPrefill(null);
                          setComposerCommunityId(selectedCommunity.id);
                          setComposerOpen(true);
                        }}
                      >
                        Đăng vào nhóm
                      </Button>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={[styles.commIconBox, { backgroundColor: palette.indigoTint }]}
                      >
                        <Ionicons name="people" size={22} color={palette.indigo} />
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

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {(
                        [
                          { id: 'feed', label: 'Thảo luận' },
                          {
                            id: 'events',
                            label: `Sự kiện (${selectedCommunity.events.length})`,
                          },
                          {
                            id: 'members',
                            label: `Thành viên (${selectedCommunity.members.length})`,
                          },
                          { id: 'moderation', label: 'Nội quy & Duyệt bài' },
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
                              fontWeight: '700',
                              color:
                                communitySubTab === st.id ? palette.onPrimary : palette.ink,
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
                      .map((p) => renderPostCard(p, selectedCommunity.name))
                  ) : null}

                  {communitySubTab === 'events' ? (
                    <View style={{ gap: 10 }}>
                      <Button
                        icon="calendar-outline"
                        onPress={() => {
                          if (!requireSignedIn('tạo sự kiện nhóm')) return;
                          setCreateEventOpen(true);
                        }}
                      >
                        Tạo sự kiện mới
                      </Button>
                      {selectedCommunity.events.map((ev) => {
                        const rsvped = ev.rsvpUserIds.includes(viewerId);
                        return (
                          <Card key={ev.id} style={{ gap: 8 }}>
                            <Badge tone="primary">
                              {new Date(ev.startsAt).toLocaleString('vi-VN')}
                            </Badge>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.ink }}>
                              {ev.title}
                            </Text>
                            <Text style={{ fontSize: 12.5, color: palette.inkMuted }}>
                              {ev.description}
                            </Text>
                            <Text
                              style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}
                            >
                              {ev.locationLabel} · {ev.rsvpUserIds.length} người tham dự
                            </Text>
                            <Button
                              size="sm"
                              variant={rsvped ? 'secondary' : 'primary'}
                              onPress={() => {
                                if (!requireSignedIn('đăng ký sự kiện')) return;
                                toggleEventRsvp(selectedCommunity.id, ev.id, viewerId);
                              }}
                            >
                              {rsvped ? 'Đã đăng ký (Hủy)' : 'Đăng ký tham dự'}
                            </Button>
                          </Card>
                        );
                      })}
                    </View>
                  ) : null}

                  {communitySubTab === 'members' ? (
                    <Card style={{ gap: 10 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        Thành viên trong nhóm ({selectedCommunity.members.length})
                      </Text>
                      {selectedCommunity.members.length === 0 ? (
                        <Text style={{ fontSize: 12.5, color: palette.inkMuted }}>
                          Chưa có thành viên nào tham gia nhóm này.
                        </Text>
                      ) : (
                        [...selectedCommunity.members]
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
                                  {
                                    borderColor: palette.paperMuted,
                                    backgroundColor: palette.paperRaised,
                                  },
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
                                  <Text
                                    style={{
                                      fontSize: 13.5,
                                      fontWeight: '800',
                                      color: palette.ink,
                                    }}
                                  >
                                    {idx + 1}. {mem.displayName}
                                  </Text>
                                  <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                                    Vai trò: {mem.role} · {mem.reputationPoints} điểm đóng góp
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
                                            notifyToast(
                                              `Đã cập nhật vai trò ${mem.displayName} → ${r}`
                                            );
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
                                              fontWeight: '700',
                                              color:
                                                mem.role === r ? palette.onPrimary : palette.ink,
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
                          })
                      )}
                    </Card>
                  ) : null}

                  {communitySubTab === 'moderation' ? (
                    <Card style={{ gap: 10 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        Nội quy nhóm
                      </Text>
                      {selectedCommunity.rules.map((rule, i) => (
                        <Text key={i} style={{ fontSize: 12.5, color: palette.ink }}>
                          {rule}
                        </Text>
                      ))}

                      <Text style={[typography.title, { color: palette.ink, marginTop: 8 }]}>
                        Bài viết chờ duyệt
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
                              {
                                borderColor: palette.indigoBorder,
                                backgroundColor: palette.paperRaised,
                              },
                            ]}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}
                              >
                                {pending.authorName}
                              </Text>
                              <Text
                                style={{ fontSize: 12, color: palette.inkMuted }}
                                numberOfLines={2}
                              >
                                {pending.threadParts[0]}
                              </Text>
                            </View>
                            <Button
                              size="sm"
                              onPress={() => {
                                approvePendingPost(pending.id, true);
                                notifyToast('Đã duyệt bài viết.');
                              }}
                            >
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => {
                                approvePendingPost(pending.id, false);
                                notifyToast('Đã từ chối bài viết.');
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
            </View>
          ) : null}

          {/* ===================================================================== */}
          {/* MODULE 3: REAL-TIME SEARCH ENGINE + USER DISCOVERY                    */}
          {/* ===================================================================== */}
          {hubSection === 'discover' ? (
            <View style={{ gap: spacing.md }}>
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
                  <Ionicons
                    name="globe-outline"
                    size={15}
                    color={
                      discoverSubTab === 'documents_and_posts'
                        ? palette.onPrimary
                        : palette.indigo
                    }
                  />
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color:
                        discoverSubTab === 'documents_and_posts'
                          ? palette.onPrimary
                          : palette.ink,
                    }}
                    numberOfLines={1}
                  >
                    Tra cứu & Tin tức
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
                  <Ionicons
                    name="person-add-outline"
                    size={15}
                    color={discoverSubTab === 'users' ? palette.onPrimary : palette.indigo}
                  />
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: discoverSubTab === 'users' ? palette.onPrimary : palette.ink,
                    }}
                    numberOfLines={1}
                  >
                    Tìm bạn bè
                  </Text>
                </Pressable>
              </View>

              {discoverSubTab === 'users' ? (
                <FriendsDiscoveryHub
                  onOpenDirectChat={(scholar) => {
                    if (!requireSignedIn('nhắn tin trực tiếp')) return;
                    router.push({
                      pathname: '/messages',
                      params: { peerId: scholar.id, peerName: scholar.name },
                    });
                  }}
                />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {/* Real-Time Multi-Source Search Engine Header Card */}
                  <Card style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                        <Text style={[typography.title, { color: palette.ink }]}>
                          Tra cứu kiến thức & nguồn tin thời gian thực
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: palette.mint,
                            }}
                          />
                          <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                            Trực tiếp · Google News · Wikipedia · OpenAlex · Hacker News ({lastSyncedAt})
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Đặt lại công cụ tìm kiếm"
                        onPress={handleResetSearchEngine}
                        style={[
                          styles.resetEngineBtn,
                          {
                            backgroundColor: palette.paperRaised,
                            borderColor: palette.indigoBorder,
                          },
                        ]}
                      >
                        <Ionicons name="refresh-outline" size={14} color={palette.indigo} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}>
                          Đặt lại
                        </Text>
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={docSearchQuery}
                        onChangeText={(val) => {
                          setDocSearchQuery(val);
                          if (val.trim().length < 2) {
                            searchAbortRef.current?.abort();
                            searchSeqRef.current += 1;
                            setSearchingDocs(false);
                            setHasCompletedSearch(false);
                            setLiveWikiResults([]);
                          }
                        }}
                        onSubmitEditing={() => {
                          if (docSearchQuery.trim()) {
                            recordSearchQuery(viewerId, docSearchQuery.trim());
                            void executeLiveSearch(docSearchQuery);
                          }
                        }}
                        placeholder="Nhập chủ đề, khái niệm, tin tức hoặc từ khóa..."
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
                        disabled={docSearchQuery.trim().length < 2 || searchingDocs}
                        onPress={() => {
                          recordSearchQuery(viewerId, docSearchQuery.trim());
                          void executeLiveSearch(docSearchQuery);
                        }}
                      >
                        {searchingDocs ? 'Đang tìm...' : 'Tìm'}
                      </Button>
                    </View>

                    {/* Quick Real-Time Topic Chips */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {QUICK_SEARCH_TOPICS.map((topic) => {
                        const active = docSearchQuery.trim().toLowerCase() === topic.toLowerCase();
                        return (
                          <Pressable
                            key={topic}
                            onPress={() => {
                              setDocSearchQuery(topic);
                              recordSearchQuery(viewerId, topic);
                              void executeLiveSearch(topic);
                            }}
                            style={[
                              styles.topicChip,
                              {
                                backgroundColor: active
                                  ? palette.indigo
                                  : palette.paperRaised,
                                borderColor: active ? palette.indigo : palette.paperMuted,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '700',
                                color: active ? palette.onPrimary : palette.ink,
                              }}
                            >
                              {topic}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {(mySlice?.recentSearchQueries.length ?? 0) > 0 ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <Text
                          style={{ fontSize: 11.5, color: palette.inkMuted, fontWeight: '700' }}
                        >
                          Gần đây:
                        </Text>
                        {mySlice!.recentSearchQueries.map((q) => (
                          <Pressable
                            key={q}
                            onPress={() => {
                              setDocSearchQuery(q);
                              void executeLiveSearch(q);
                            }}
                            style={[styles.utilChip, { backgroundColor: palette.paperRaised }]}
                          >
                            <Text style={{ fontSize: 11.5, color: palette.ink }}>{q}</Text>
                          </Pressable>
                        ))}
                        <Pressable onPress={() => clearSearchHistory(viewerId)}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: palette.danger }}>
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
                        Bài viết trong cộng đồng ({matchedSocialPosts.length})
                      </Text>
                      {matchedSocialPosts.map((p) => renderPostCard(p))}
                    </View>
                  ) : null}

                  {/* Matched Question Sets */}
                  {matchedQuestionSets.length > 0 ? (
                    <Card style={{ gap: 8 }}>
                      <Text style={[typography.title, { color: palette.ink }]}>
                        Bộ đề trong thư viện ({matchedQuestionSets.length})
                      </Text>
                      {matchedQuestionSets.map((qs) => (
                        <Pressable
                          key={qs.id}
                          onPress={() =>
                            router.push({ pathname: '/study/[setId]', params: { setId: qs.id } })
                          }
                          style={[
                            styles.memberRow,
                            {
                              borderColor: palette.paperMuted,
                              backgroundColor: palette.paperRaised,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ fontSize: 13.5, fontWeight: '800', color: palette.ink }}
                            >
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

                  {/* Live Articles & Daily Knowledge Cards with Real Photo Thumbnails + Smooth Zero-Jitter Streaming */}
                  <View style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <Text style={[typography.title, { color: palette.ink }]}>
                        {docSearchQuery.trim().length >= 2
                          ? `Kết quả cho "${docSearchQuery.trim()}" (${liveWikiResults.length})`
                          : 'Tin tức & học liệu mới nhất hôm nay'}
                      </Text>
                      {searchingDocs ? (
                        <Badge tone="primary">Đang cập nhật trực tiếp…</Badge>
                      ) : null}
                    </View>

                    {loadingDaily && dailyFeed.length === 0 && liveWikiResults.length === 0 ? (
                      <PapyrusPageSkeleton />
                    ) : docSearchQuery.trim().length >= 2 &&
                      !searchingDocs &&
                      hasCompletedSearch &&
                      liveWikiResults.length === 0 ? (
                      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: spacing.lg }}>
                        <Ionicons name="search-outline" size={26} color={palette.indigo} />
                        <Text style={[typography.title, { color: palette.ink, textAlign: 'center' }]}>
                          Chưa tìm thấy bài báo khớp từ khóa &ldquo;{docSearchQuery.trim()}&rdquo;
                        </Text>
                        <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}>
                          Thử rút gọn từ khóa hoặc bấm Đặt lại để xem tin tức mới nhất hôm nay.
                        </Text>
                      </Card>
                    ) : (
                      (docSearchQuery.trim().length >= 2
                        ? liveWikiResults.length > 0
                          ? liveWikiResults
                          : dailyFeed
                        : dailyFeed
                      ).map((art) => {
                        const fallbackPhoto = pickEditorialPhotoFallback(
                          art.id,
                          art.title,
                          art.category,
                          docSearchQuery
                        );
                        const resolvedThumb =
                          !brokenThumbs[art.id] &&
                          art.thumbnailUrl &&
                          !art.thumbnailUrl.startsWith('data:image/svg+xml')
                            ? art.thumbnailUrl
                            : fallbackPhoto;
                        return (
                          <Card key={art.id} style={{ gap: 10 }}>
                            <Image
                              source={{ uri: resolvedThumb }}
                              onError={() => {
                                if (!brokenThumbs[art.id]) {
                                  setBrokenThumbs((prev) => ({ ...prev, [art.id]: true }));
                                }
                              }}
                              style={[
                                styles.newsThumb,
                                { backgroundColor: palette.paperMuted },
                              ]}
                              resizeMode="cover"
                            />

                              <View
                                style={{
                                  flexDirection: 'row',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Badge tone="primary">{art.source}</Badge>
                                  <Text
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: '700',
                                      color: palette.indigo,
                                    }}
                                  >
                                    {art.category}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                                  {art.publishedLabel}
                                </Text>
                              </View>

                              <Text
                                style={{
                                  fontSize: 15.5,
                                  lineHeight: 22,
                                  fontWeight: '800',
                                  color: palette.ink,
                                }}
                              >
                                {art.title}
                              </Text>
                              <Text
                                style={{ fontSize: 13.5, lineHeight: 20, color: palette.ink }}
                              >
                                {art.summary}
                              </Text>

                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <Button
                                  size="sm"
                                  icon="sparkles-outline"
                                  onPress={() => {
                                    saveSourceDocument(buildSourceDocFromArticle(art));
                                    router.push('/create/generate');
                                  }}
                                >
                                  Tạo đề AI
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  icon="document-text-outline"
                                  onPress={() => {
                                    saveSourceDocument(buildSourceDocFromArticle(art));
                                    notifyToast(
                                      `Đã lưu "${art.title.slice(0, 36)}..." làm tài liệu nguồn.`
                                    );
                                  }}
                                >
                                  Lưu tài liệu
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    if (!requireSignedIn('đăng tin 24 giờ')) return;
                                    const cleanSentence = extractCompleteSentences(
                                      `${art.title}: ${art.summary}`,
                                      210
                                    );
                                    setStoryDraft({
                                      text: cleanSentence,
                                      subtext: `${art.category} · ${art.source}`,
                                      imageUri: art.thumbnailUrl || null,
                                    });
                                    setStoryComposerOpen(true);
                                  }}
                                >
                                  Đăng tin 24h
                                </Button>

                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    if (!requireSignedIn('chia sẻ bài viết')) return;
                                    setQuotedPost(null);
                                    setComposerPrefill({
                                      text: `${art.title}\n\n${art.summary}\n\nNguồn: ${art.url}`,
                                      topics: art.category,
                                      communityId: null,
                                    });
                                    setComposerOpen(true);
                                  }}
                                >
                                  Đăng bài
                                </Button>

                                {art.url ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => void Linking.openURL(art.url)}
                                  >
                                    Đọc nguồn ↗
                                  </Button>
                                ) : null}
                              </View>
                            </Card>
                          );
                        }
                      )
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </View>

      {/* ===================================================================== */}
      {/* MODALS                                                                */}
      {/* ===================================================================== */}
      <StoryViewerModal
        stories={activeStoryGroup}
        viewerId={viewerId}
        onClose={() => setActiveStoryGroup(null)}
        onMarkViewed={(sid) => markStoryViewed(sid, viewerId)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
        onDirectMessage={(author) => {
          if (!requireSignedIn('nhắn tin trực tiếp')) return;
          router.push({
            pathname: '/messages',
            params: {
              peerId: author.id,
              peerName: author.name,
              ...(author.replyText ? { initialText: author.replyText } : {}),
            },
          });
        }}
      />

      <StoryComposerModal
        visible={storyComposerOpen}
        initialDraft={storyDraft}
        onClose={() => setStoryComposerOpen(false)}
        onPublish={(data) => {
          if (!requireSignedIn('đăng tin 24 giờ')) return;
          const created = addStory({
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
            pinnedOnProfile: data.pinnedOnProfile,
          });
          if (!created) return;
          addBonusXp(20);
          notifyToast('Đã đăng tin 24 giờ.');
        }}
      />

      <AdvancedThreadComposerModal
        visible={composerOpen}
        viewerId={viewerId}
        viewerName={viewerName}
        savedDraft={mySlice?.draft ?? null}
        quotedPost={quotedPost}
        initialPrefill={composerPrefill}
        communities={communities}
        knownUsers={Object.values(profilesById)}
        questionSets={allSets}
        onSaveDraft={(draft) => {
          if (!isGuest) saveComposerDraft(viewerId, draft);
        }}
        onClose={() => {
          setComposerOpen(false);
          setQuotedPost(null);
          setComposerPrefill(null);
        }}
        onPublish={(payload) => {
          if (!requireSignedIn('đăng bài viết')) return;
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
          if (!created) return;
          addBonusXp(15);
          setQuotedPost(null);
          setComposerPrefill(null);
          notifyToast(
            created.lifecycleStatus === 'scheduled'
              ? 'Đã lên lịch đăng bài tự động.'
              : created.lifecycleStatus === 'pending_approval'
              ? 'Bài viết đã gửi chờ quản trị viên nhóm duyệt.'
              : created.postKind === 'ghost'
              ? 'Đã đăng bài tự hủy sau 24 giờ.'
              : 'Đã đăng bài viết mới.'
          );
        }}
      />

      {/* Feed Preferences & Custom Feeds Modal */}
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
                  Tùy chỉnh bảng tin
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
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink, flex: 1 }}>
                    Ưu tiên bài viết học thuật, mã nguồn và bộ đề ôn tập
                  </Text>
                </Pressable>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                    Từ khóa muốn ẩn
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      value={newMutedKeyword}
                      onChangeText={setNewMutedKeyword}
                      placeholder="Nhập từ khóa cần ẩn..."
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
                    Tạo bảng tin theo chủ đề riêng
                  </Text>
                  <TextInput
                    value={newCustomFeedName}
                    onChangeText={setNewCustomFeedName}
                    placeholder="Tên bảng tin..."
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
                    placeholder="Các chủ đề cách nhau bằng dấu phẩy..."
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
                      setNewCustomFeedTopics('');
                      notifyToast('Đã thêm bảng tin tùy chỉnh.');
                    }}
                  >
                    Lưu bảng tin
                  </Button>

                  {(mySlice?.customFeeds ?? []).map((cf) => (
                    <View
                      key={cf.id}
                      style={[
                        styles.memberRow,
                        { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                      ]}
                    >
                      <Text
                        style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink, flex: 1 }}
                      >
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
                    notifyToast('Đã khôi phục mặc định.');
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

      {/* Saved Bookmarks, Favourites & Scheduled/Archived Drawer */}
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
                  Kho lưu trữ cá nhân
                </Text>
                <Pressable onPress={() => setBookmarksDrawerOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    {
                      id: 'bookmarks',
                      label: `Đã lưu (${mySlice?.bookmarkedPostIds.length ?? 0})`,
                    },
                    {
                      id: 'favourites',
                      label: `Yêu thích (${mySlice?.favouritePostIds.length ?? 0})`,
                    },
                    { id: 'scheduled', label: 'Hẹn giờ & Lưu trữ' },
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
                        fontWeight: '700',
                        color: bookmarkTab === t.id ? palette.onPrimary : palette.ink,
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
                    placeholder="Tên thư mục sưu tập mới..."
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
                    Thêm
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
                          <Text
                            style={{ fontSize: 12, color: palette.inkMuted }}
                            numberOfLines={2}
                          >
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
                            {p.authorName}
                          </Text>
                          <Text
                            style={{ fontSize: 12, color: palette.inkMuted }}
                            numberOfLines={2}
                          >
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
                              ? `Hẹn giờ: ${p.scheduledFor}`
                              : 'Đã lưu trữ'}
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
                            notifyToast('Đã khôi phục bài viết lên bảng tin.');
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
              <Text style={[typography.title, { color: palette.ink }]}>Tạo nhóm mới</Text>
              <TextInput
                value={commName}
                onChangeText={setCommName}
                placeholder="Tên nhóm..."
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
                placeholder="Mô tả chủ đề thảo luận..."
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
                placeholder="Các chủ đề (cách nhau bằng dấu phẩy)..."
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
                    { id: 'public', label: 'Công khai' },
                    { id: 'private', label: 'Riêng tư' },
                    { id: 'hidden', label: 'Nhóm ẩn' },
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
                        fontWeight: '700',
                        color: commVisibility === v.id ? palette.onPrimary : palette.ink,
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
                  Duyệt bài viết trước khi hiển thị
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setCreateCommOpen(false)}>
                  Hủy
                </Button>
                <Button
                  disabled={!commName.trim()}
                  onPress={() => {
                    if (!requireSignedIn('tạo nhóm mới')) return;
                    const created = createCommunity({
                      ownerId: viewerId,
                      ownerName: viewerName,
                      name: commName.trim(),
                      description: commDesc.trim() || 'Nhóm thảo luận học tập trên Papyrus.',
                      visibility: commVisibility,
                      topics: commTopics
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                      rules: [
                        '1. Tôn trọng các thành viên và dẫn nguồn rõ ràng.',
                        '2. Không đăng nội dung rác.',
                      ],
                      requirePostApproval: commPostApproval,
                    });
                    if (!created) return;
                    setCommName('');
                    setCommDesc('');
                    setCreateCommOpen(false);
                    setSelectedCommunityId(created.id);
                    notifyToast(`Đã tạo nhóm ${created.name}.`);
                  }}
                >
                  Tạo nhóm
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
              <Text style={[typography.title, { color: palette.ink }]}>Tạo sự kiện nhóm</Text>
              <TextInput
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Tên sự kiện..."
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
                placeholder="Địa điểm hoặc liên kết phòng học..."
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
                    if (!requireSignedIn('tạo sự kiện')) return;
                    const ev = createCommunityEvent({
                      communityId: selectedCommunity.id,
                      creatorId: viewerId,
                      creatorName: viewerName,
                      title: eventTitle.trim(),
                      description: eventDesc.trim(),
                      locationLabel: eventLocation.trim(),
                      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
                    });
                    if (!ev) return;
                    setEventTitle('');
                    setEventDesc('');
                    setCreateEventOpen(false);
                    notifyToast('Đã tạo sự kiện mới.');
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
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  hubTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 6,
  },
  hubTabBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
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
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  aiInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 13,
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
  resetEngineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  newsThumb: {
    width: '100%',
    height: 178,
    borderRadius: radii.md,
  },
  commIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
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
