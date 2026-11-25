import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getScholarRankInfo } from '@/core/domain/scholarRank';
import { extractCompleteSentences } from '@/features/scan-ocr/domain/ocrCleaner';
import { seedQuestionSets } from '@/composition/preferences';
import {
  fetchDailyUpdatedKnowledgeFeed,
  getOnlineScholarCandidates,
  pickCoverImageDataUrl,
  searchAcademicKnowledgeLive,
} from '@/composition/platform';
import {
  VIRAL_THREAD_TEMPLATES,
  type DailyKnowledgeArticle,
  type ScholarStory,
} from '@/features/community/domain/models';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { CreateStoryCard916, StoryCard916 } from '@/features/community/presentation/StoryCard916';
import { StoryComposerModal, StoryViewerModal } from '@/features/community/presentation/StoryModalViewer';
import { ThreadPostCard } from '@/features/community/presentation/ThreadPostCard';
import { FriendsDiscoveryHub } from '@/features/community/presentation/FriendsDiscoveryHub';
import { sfx } from '@/core/audio/sfx';

type CommunityMainTab = 'feed' | 'messenger' | 'friends' | 'search';
type FeedFilter = 'all' | 'following' | 'bookmarks';

export default function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; dmUserId?: string; dmName?: string }>();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const refreshTick = useRouteRefreshStore((s) => s.refreshTick);

  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName ?? 'Học giả Papyrus';
  const viewerHandle = `@${((user?.email ? user.email.split('@')[0] : viewerName) || 'scholar').toLowerCase().replace(/[^a-z0-9._]/g, '') || 'scholar'}`;
  const totalScore = usePapyrusStore((s) => s.totalScore);
  const addBonusXp = usePapyrusStore((s) => s.addBonusXp);
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const rankInfo = useMemo(() => getScholarRankInfo(totalScore), [totalScore]);

  const stories = useCommunityStore((s) => s.stories);
  const posts = useCommunityStore((s) => s.posts);
  const channels = useCommunityStore((s) => s.channels);
  const messages = useCommunityStore((s) => s.messages);
  const followingAuthorIds = useCommunityStore((s) => s.followingAuthorIds);

  const addStory = useCommunityStore((s) => s.addStory);
  const markStoryViewed = useCommunityStore((s) => s.markStoryViewed);
  const reactToStory = useCommunityStore((s) => s.reactToStory);
  const addPost = useCommunityStore((s) => s.addPost);
  const togglePostReaction = useCommunityStore((s) => s.togglePostReaction);
  const votePostPoll = useCommunityStore((s) => s.votePostPoll);
  const toggleBookmarkPost = useCommunityStore((s) => s.toggleBookmarkPost);
  const toggleRepost = useCommunityStore((s) => s.toggleRepost);
  const addComment = useCommunityStore((s) => s.addComment);
  const toggleFollowAuthor = useCommunityStore((s) => s.toggleFollowAuthor);
  const createStudyGroup = useCommunityStore((s) => s.createStudyGroup);
  const ensureDirectChannel = useCommunityStore((s) => s.ensureDirectChannel);
  const sendGroupMessage = useCommunityStore((s) => s.sendGroupMessage);
  const toggleMessageReaction = useCommunityStore((s) => s.toggleMessageReaction);
  const voteGroupPoll = useCommunityStore((s) => s.voteGroupPoll);
  const pinChannelMessage = useCommunityStore((s) => s.pinChannelMessage);

  const [mainTab, setMainTab] = useState<CommunityMainTab>(() =>
    params.tab === 'messenger' || params.dmUserId
      ? 'messenger'
      : params.tab === 'friends'
      ? 'friends'
      : params.tab === 'search'
      ? 'search'
      : 'feed'
  );
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  // Story Modals + Pre-populated Draft (for sharing Search/News to Story with complete sentences!)
  const [activeStory, setActiveStory] = useState<ScholarStory | null>(null);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{
    text?: string;
    subtext?: string;
    imageUri?: string | null;
  } | null>(null);

  // Thread / Post Composer State
  const [composerOpen, setComposerOpen] = useState(false);
  const [threadParts, setThreadParts] = useState<string[]>(['']);
  const [selectedTemplateBadge, setSelectedTemplateBadge] = useState<string>('');
  const [postTagsText, setPostTagsText] = useState('CNTT, ÔnThi');
  const [postImageUri, setPostImageUri] = useState<string | null>(null);
  const [postCode, setPostCode] = useState('');
  const [showCodeField, setShowCodeField] = useState(false);
  const [attachedSetId, setAttachedSetId] = useState<string>('');
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');
  const [citationDraft, setCitationDraft] = useState<{ title: string; url: string; sourceName: string } | null>(null);

  // Messenger / Zalo Group Chat State (Mobile Dedicated Room vs Channel List — Zero Overlap!)
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() =>
    params.dmUserId ? `dm-${params.dmUserId.slice(0, 12)}` : channels[0]?.id ?? 'grp-it-algo'
  );
  const [mobileChatOpen, setMobileChatOpen] = useState<boolean>(() => Boolean(params.dmUserId));
  const [chatText, setChatText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; senderName: string; preview: string } | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTopic, setNewGroupTopic] = useState('Ôn thi Đại học');
  const [groupPollOpen, setGroupPollOpen] = useState(false);
  const [groupPollQ, setGroupPollQ] = useState('');
  const [groupPollA, setGroupPollA] = useState('');
  const [groupPollB, setGroupPollB] = useState('');

  // Live Real-Time Search Engine & Synchronized Trending News State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [liveResults, setLiveResults] = useState<DailyKnowledgeArticle[]>([]);
  const [dailyFeed, setDailyFeed] = useState<DailyKnowledgeArticle[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  useEffect(() => {
    if (!params.dmUserId || !params.dmName) return;
    const dm = ensureDirectChannel({ id: params.dmUserId, name: params.dmName });
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setSelectedChannelId(dm.id);
      setMobileChatOpen(true);
    });
    return () => {
      active = false;
    };
  }, [ensureDirectChannel, params.dmName, params.dmUserId]);

  const reloadDailyTrending = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const items = await fetchDailyUpdatedKnowledgeFeed();
      setDailyFeed(items);
    } finally {
      setLoadingDaily(false);
    }
  }, []);

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

  // Debounced live search-as-you-type for true real-time Search Engine feel!
  useEffect(() => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      void searchAcademicKnowledgeLive(clean)
        .then((res) => setLiveResults(res))
        .finally(() => setSearching(false));
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const runLiveSearchNow = async (overrideQuery?: string) => {
    const clean = (overrideQuery ?? searchQuery).trim();
    if (clean.length < 2) return;
    if (overrideQuery !== undefined) setSearchQuery(overrideQuery);
    setSearching(true);
    try {
      const res = await searchAcademicKnowledgeLive(clean);
      setLiveResults(res);
    } finally {
      setSearching(false);
    }
  };

  const allTags = useMemo(() => {
    const s = new Set<string>(['ALL', 'CNTT', 'ÔnThi', 'ToánLýHóa', 'VănSử', 'StudyWithMe']);
    posts.forEach((p) => p.tags.forEach((t) => s.add(t)));
    return Array.from(s).slice(0, 10);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    return posts.filter((p) => {
      if (feedFilter === 'following' && !followingAuthorIds.includes(p.authorId) && p.authorId !== viewerId) {
        return false;
      }
      if (feedFilter === 'bookmarks' && !p.bookmarkedByIds.includes(viewerId)) {
        return false;
      }
      if (tagFilter !== 'ALL' && !p.tags.includes(tagFilter)) {
        return false;
      }
      return true;
    });
  }, [feedFilter, followingAuthorIds, posts, tagFilter, viewerId]);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? channels[0],
    [channels, selectedChannelId]
  );

  const activeChannelId = activeChannel?.id;
  const channelMessages = useMemo(
    () => messages.filter((m) => m.channelId === activeChannelId),
    [activeChannelId, messages]
  );

  const pinnedId = activeChannel?.pinnedMessageId ?? null;
  const pinnedMessage = useMemo(
    () => (pinnedId ? channelMessages.find((m) => m.id === pinnedId) ?? null : null),
    [pinnedId, channelMessages]
  );

  const localMatchedSets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allSets
      .filter((s) => `${s.title} ${s.subject} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q))
      .slice(0, 4);
  }, [allSets, searchQuery]);

  const applyViralTemplate = (tplId: string) => {
    const tpl = VIRAL_THREAD_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setThreadParts([...tpl.parts]);
    setSelectedTemplateBadge(tpl.badge);
    setPostTagsText(`${tpl.defaultTag}, Papyrus`);
  };

  const publishThreadPost = () => {
    const cleanedParts = threadParts.map((p) => p.trim()).filter(Boolean);
    if (cleanedParts.length === 0) return;

    const chosenSet = attachedSetId ? allSets.find((s) => s.id === attachedSetId) : undefined;
    const tags = postTagsText
      .split(/[,#\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    const poll =
      showPollBuilder && pollQuestion.trim() && pollOpt1.trim() && pollOpt2.trim()
        ? {
            question: pollQuestion.trim(),
            options: [
              { id: 'p1', text: pollOpt1.trim(), voterIds: [] },
              { id: 'p2', text: pollOpt2.trim(), voterIds: [] },
            ],
          }
        : undefined;

    addPost({
      authorId: viewerId,
      authorName: viewerName,
      authorHandle: viewerHandle,
      authorAvatar: user?.avatarUrl ?? null,
      authorLevel: rankInfo.level,
      authorRoleBadge: `${rankInfo.badge} ${rankInfo.titleVi}`,
      threadParts: cleanedParts,
      templateBadge: selectedTemplateBadge || undefined,
      imageUri: postImageUri,
      codeSnippet: showCodeField && postCode.trim() ? postCode.trim() : undefined,
      attachedQuiz: chosenSet
        ? {
            setId: chosenSet.id,
            title: chosenSet.title,
            questionCount: chosenSet.questions.length,
            subject: chosenSet.subject || 'Đại học',
          }
        : undefined,
      poll,
      sourceCitation: citationDraft ?? undefined,
      tags,
    });

    addBonusXp(30);
    sfx.playLevelUp();
    setThreadParts(['']);
    setSelectedTemplateBadge('');
    setPostImageUri(null);
    setPostCode('');
    setShowCodeField(false);
    setAttachedSetId('');
    setShowPollBuilder(false);
    setPollQuestion('');
    setPollOpt1('');
    setPollOpt2('');
    setCitationDraft(null);
    setComposerOpen(false);
  };

  // SILENT OUTGOING SEND: Sending messages in group/DM chat plays NO sound!
  const handleSendChatMessage = () => {
    if (!activeChannel || !chatText.trim()) return;
    sendGroupMessage({
      channelId: activeChannel.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: user?.avatarUrl ?? null,
      text: chatText.trim(),
      replyTo: replyTarget ?? undefined,
    });
    setChatText('');
    setReplyTarget(null);
  };

  const handleShareQuizToGroup = () => {
    if (!activeChannel || !allSets[0]) return;
    const s = allSets[0];
    sendGroupMessage({
      channelId: activeChannel.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: user?.avatarUrl ?? null,
      text: `📜 Mình chia sẻ bộ đề "${s.title}" vào nhóm để cả nhà cùng luyện nhé!`,
      quizCard: {
        setId: s.id,
        title: s.title,
        questionCount: s.questions.length,
      },
    });
  };

  const handleCreateZaloPollInChat = () => {
    if (!activeChannel || !groupPollQ.trim() || !groupPollA.trim() || !groupPollB.trim()) return;
    sendGroupMessage({
      channelId: activeChannel.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: user?.avatarUrl ?? null,
      text: `📊 Đã mở bình chọn nhóm: ${groupPollQ.trim()}`,
      poll: {
        question: groupPollQ.trim(),
        options: [
          { id: 'gp1', text: groupPollA.trim(), voterIds: [] },
          { id: 'gp2', text: groupPollB.trim(), voterIds: [] },
        ],
      },
    });
    setGroupPollQ('');
    setGroupPollA('');
    setGroupPollB('');
    setGroupPollOpen(false);
  };

  // Share any Search / Trending News item into Story OR Thread using strictly COMPLETE grammatical sentences!
  const shareArticleToStory = (art: DailyKnowledgeArticle) => {
    const completeSentence = extractCompleteSentences(art.summary, 1, art.title);
    setStoryDraft({
      text: `📰 ${art.title} — ${completeSentence}`,
      subtext: `${art.source} · #TriThứcMớiNhất`,
      imageUri: art.thumbnailUrl ?? null,
    });
    setStoryComposerOpen(true);
  };

  const shareArticleToThread = (art: DailyKnowledgeArticle) => {
    const completeBody = extractCompleteSentences(art.summary, 2, art.title);
    setThreadParts([
      `🗞️ Tiêu điểm mới nhất từ ${art.source}: "${art.title}".`,
      `${completeBody}\n\nMọi người nghĩ sao về chủ đề này? Cùng thảo luận bên dưới nhé! 👇`,
    ]);
    setPostImageUri(art.thumbnailUrl ?? null);
    setCitationDraft({ title: art.title, url: art.url, sourceName: art.source });
    setComposerOpen(true);
  };

  const onlineScholars = getOnlineScholarCandidates(user?.id);
  const showChannelListPane = isWide || !mobileChatOpen;
  const showChatRoomPane = isWide || mobileChatOpen;

  return (
    <Screen bottomNav onPullRefresh={reloadDailyTrending}>
      <TopBar
        title="Cộng đồng Học thuật"
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setCitationDraft(null);
              setComposerOpen(true);
            }}
            style={[styles.composePillBtn, { backgroundColor: palette.indigo }]}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>Đăng Thread</Text>
          </Pressable>
        }
      />

      {/* 4-Module Social Super-Hub Switcher: Feed | Messenger/Zalo | Friends | Live Search Engine */}
      <View style={[styles.hubTabs, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
        {(
          [
            { id: 'feed', label: '📰 Bảng Tin', short: 'Bảng tin' },
            { id: 'messenger', label: '💬 Nhóm Chat', short: 'Nhắn tin' },
            { id: 'friends', label: '👥 Bạn Bè', short: 'Bạn bè' },
            { id: 'search', label: '🔎 Search Engine', short: 'Tra cứu' },
          ] as const
        ).map((tb) => {
          const active = mainTab === tb.id;
          return (
            <Pressable
              key={tb.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setMainTab(tb.id)}
              style={[styles.hubTabBtn, active && { backgroundColor: palette.indigo }]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: active ? '#FFFFFF' : palette.inkMuted,
                }}
                numberOfLines={1}
              >
                {width >= 560 ? tb.label : tb.short}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 1: FACEBOOK 9:16 STORIES + THREADS HYBRID FEED
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'feed' && (
        <SmoothReveal>
          {/* Facebook-Exact 9:16 Stories Carousel (Full Photo & Video First-Frame Thumbnail!) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
            <CreateStoryCard916
              avatarUrl={user?.avatarUrl}
              displayName={viewerName}
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

          {/* Facebook + Threads Quick Composer Trigger Card */}
          <Card onPress={() => setComposerOpen(true)} style={styles.quickComposeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.miniAvatar, { backgroundColor: palette.indigo }]}>
                <Text style={{ color: '#FFF', fontWeight: '900' }}>
                  {(viewerName[0] || 'P').toUpperCase()}
                </Text>
              </View>
              <View style={[styles.fakeInputPill, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  {viewerName} ơi, chia sẻ chuỗi Thread kiến thức, đề Quiz hoặc câu hỏi hôm nay nhé… (+30 XP)
                </Text>
              </View>
            </View>
            <View style={[styles.quickComposeActions, { borderTopColor: palette.paperMuted }]}>
              <View style={styles.composeChip}>
                <Ionicons name="flame" size={14} color="#F59E0B" />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.ink }}>10 Mẫu Viral Thread</Text>
              </View>
              <View style={styles.composeChip}>
                <Ionicons name="videocam-outline" size={15} color="#E11D48" />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.ink }}>Story Ảnh/Video</Text>
              </View>
              <View style={styles.composeChip}>
                <Ionicons name="stats-chart-outline" size={14} color="#6366F1" />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.ink }}>Poll & Bộ đề</Text>
              </View>
            </View>
          </Card>

          {/* Feed Filter Tabs + Topic Hashtags */}
          <View style={styles.filterBarRow}>
            {(
              [
                { id: 'all', label: '🔥 Dành cho bạn' },
                { id: 'following', label: '👥 Đang theo dõi' },
                { id: 'bookmarks', label: '🔖 Đã lưu' },
              ] as const
            ).map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFeedFilter(f.id)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: feedFilter === f.id ? palette.indigo : palette.paperRaised,
                    borderColor: feedFilter === f.id ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: feedFilter === f.id ? '#FFFFFF' : palette.ink,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: spacing.md }}>
            {allTags.map((tg) => (
              <Pressable
                key={tg}
                onPress={() => setTagFilter(tg)}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: tagFilter === tg ? palette.indigoTint : palette.paper,
                    borderColor: tagFilter === tg ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: tagFilter === tg ? palette.indigoDeep : palette.inkMuted }}>
                  {tg === 'ALL' ? 'Tất cả chủ đề' : `#${tg}`}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {visiblePosts.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Ionicons name="newspaper-outline" size={34} color={palette.inkMuted} />
              <Text style={[typography.body, { color: palette.inkMuted, marginTop: 8 }]}>
                Chưa có bài viết nào trong mục lọc này. Hãy đăng chuỗi Thread đầu tiên của bạn!
              </Text>
            </Card>
          ) : (
            visiblePosts.map((post) => (
              <ThreadPostCard
                key={post.id}
                post={post}
                viewerId={viewerId}
                isFollowing={followingAuthorIds.includes(post.authorId)}
                onToggleFollow={toggleFollowAuthor}
                onReact={(pid, key) => togglePostReaction(pid, key, viewerId)}
                onVotePoll={(pid, oid) => votePostPoll(pid, oid, viewerId)}
                onToggleBookmark={(pid) => toggleBookmarkPost(pid, viewerId)}
                onToggleRepost={(pid) => toggleRepost(pid, viewerId)}
                onComment={(pid, text) =>
                  addComment(pid, { id: viewerId, name: viewerName, avatar: user?.avatarUrl ?? null }, text)
                }
                onOpenQuiz={(setId) => router.push({ pathname: '/study/[setId]', params: { setId } })}
                onShareToChat={(sharedPost) => {
                  if (activeChannel) {
                    sendGroupMessage({
                      channelId: activeChannel.id,
                      senderId: viewerId,
                      senderName: viewerName,
                      senderAvatar: user?.avatarUrl ?? null,
                      text: `🔗 Chia sẻ Thread từ ${sharedPost.authorName}: "${extractCompleteSentences(sharedPost.threadParts[0] || '', 1)}"`,
                    });
                    setMainTab('messenger');
                    setMobileChatOpen(true);
                  }
                }}
              />
            ))
          )}
        </SmoothReveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 2: MESSENGER + ZALO STUDY GROUPS & 1-ON-1 CHAT (ZERO OVERLAP!)
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'messenger' && (
        <SmoothReveal>
          <View style={[styles.messengerSplit, !isWide && { flexDirection: 'column' }]}>
            {/* Channel List Pane (On mobile: cleanly hidden while inside an open chat room!) */}
            {showChannelListPane && (
              <Card style={[styles.channelPane, isWide && { width: 310 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={[typography.label, { color: palette.indigo }]}>
                    NHÓM HỌC TẬP & TIN NHẮN ({channels.length})
                  </Text>
                  <Pressable
                    onPress={() => setNewGroupModal(true)}
                    style={[styles.smallNewGrpBtn, { backgroundColor: palette.indigoTint }]}
                  >
                    <Ionicons name="add-circle" size={15} color={palette.indigo} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>Tạo nhóm</Text>
                  </Pressable>
                </View>

                {onlineScholars.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
                    {onlineScholars.map((os) => (
                      <Pressable
                        key={os.id}
                        onPress={() => {
                          const dm = ensureDirectChannel({ id: os.id, name: os.displayName });
                          setSelectedChannelId(dm.id);
                          setMobileChatOpen(true);
                        }}
                        style={[styles.onlinePeerChip, { backgroundColor: palette.paper, borderColor: palette.mint }]}
                      >
                        <View style={styles.greenDot} />
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }} numberOfLines={1}>
                          {os.displayName}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                <View style={{ gap: 8 }}>
                  {channels.map((ch) => {
                    const active = isWide && ch.id === activeChannel?.id;
                    const lastMsg = [...messages].reverse().find((m) => m.channelId === ch.id);
                    return (
                      <Pressable
                        key={ch.id}
                        onPress={() => {
                          setSelectedChannelId(ch.id);
                          setMobileChatOpen(true);
                        }}
                        style={[
                          styles.channelRow,
                          {
                            backgroundColor: active ? palette.indigoTint : palette.paper,
                            borderColor: active ? palette.indigo : palette.paperMuted,
                          },
                        ]}
                      >
                        <View style={[styles.chIconCircle, { backgroundColor: ch.accentColor }]}>
                          <Ionicons name={(ch.icon as 'people') || 'people'} size={18} color="#FFFFFF" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[typography.body, { color: palette.ink, fontWeight: '800', fontSize: 14 }]} numberOfLines={1}>
                            {ch.name}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: palette.inkMuted, marginTop: 1 }} numberOfLines={1}>
                            {lastMsg ? `${lastMsg.senderName}: ${lastMsg.text}` : `${ch.memberCount} thành viên · ${ch.topic}`}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            )}

            {/* Dedicated Active Chat Room Pane */}
            {showChatRoomPane && activeChannel && (
              <Card style={[styles.chatRoomCard, { flex: 1 }]}>
                {/* Chat Header with Mobile Back-to-List Button */}
                <View style={[styles.chatRoomHeader, { borderBottomColor: palette.paperMuted }]}>
                  {!isWide && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quay lại danh sách nhóm"
                      onPress={() => setMobileChatOpen(false)}
                      style={[styles.backToListBtn, { backgroundColor: palette.paper }]}
                    >
                      <Ionicons name="arrow-back" size={18} color={palette.indigo} />
                    </Pressable>
                  )}
                  <View style={{ flex: 1, minWidth: 120 }}>
                    <Text style={[typography.title, { color: palette.ink, fontSize: 15.5 }]} numberOfLines={1}>
                      {activeChannel.name}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11 }]} numberOfLines={1}>
                      🟢 {activeChannel.memberCount} học giả · {activeChannel.topic}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Pressable
                      onPress={() => setGroupPollOpen((v) => !v)}
                      style={[styles.chatToolChip, { backgroundColor: palette.indigoTint }]}
                    >
                      <Ionicons name="stats-chart" size={13} color={palette.indigo} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>Bình chọn</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleShareQuizToGroup}
                      style={[styles.chatToolChip, { backgroundColor: palette.goldTint }]}
                    >
                      <Ionicons name="school" size={13} color={palette.gold} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: palette.gold }}>Gửi Đề</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Zalo-Style Pinned Announcement Banner */}
                {pinnedMessage && (
                  <View style={[styles.pinnedBanner, { backgroundColor: palette.goldTint, borderColor: palette.gold }]}>
                    <Ionicons name="pin" size={16} color={palette.gold} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '900', color: palette.gold }}>
                        TIN NHẮN ĐÃ GHIM BỞI {pinnedMessage.senderName.toUpperCase()}
                      </Text>
                      <Text style={[typography.caption, { color: palette.ink }]} numberOfLines={2}>
                        {pinnedMessage.text}
                      </Text>
                    </View>
                    <Pressable onPress={() => pinChannelMessage(activeChannel.id, null)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={palette.inkMuted} />
                    </Pressable>
                  </View>
                )}

                {/* Non-Overflowing Zalo Group Poll Creator (`minWidth: 0` prevents right-edge overflow!) */}
                {groupPollOpen && (
                  <View style={[styles.inlinePollBuilder, { backgroundColor: palette.paper, borderColor: palette.indigo }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                      📊 Tạo Bình Chọn Nhóm (Zalo Poll)
                    </Text>
                    <TextInput
                      value={groupPollQ}
                      onChangeText={setGroupPollQ}
                      placeholder="Câu hỏi bình chọn (vd: Tối nay ôn môn nào?)..."
                      placeholderTextColor={palette.inkMuted}
                      style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                    />
                    <View style={{ flexDirection: width < 390 ? 'column' : 'row', gap: 6 }}>
                      <TextInput
                        value={groupPollA}
                        onChangeText={setGroupPollA}
                        placeholder="Lựa chọn 1"
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.pollSmallInput,
                          { flex: 1, minWidth: 0, color: palette.ink, borderColor: palette.paperMuted },
                        ]}
                      />
                      <TextInput
                        value={groupPollB}
                        onChangeText={setGroupPollB}
                        placeholder="Lựa chọn 2"
                        placeholderTextColor={palette.inkMuted}
                        style={[
                          styles.pollSmallInput,
                          { flex: 1, minWidth: 0, color: palette.ink, borderColor: palette.paperMuted },
                        ]}
                      />
                    </View>
                    <Button onPress={handleCreateZaloPollInChat} fullWidth>
                      Đăng bình chọn vào nhóm
                    </Button>
                  </View>
                )}

                {/* Messages Stream */}
                <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
                  {channelMessages.map((msg) => {
                    const isMine = msg.senderId === viewerId;
                    return (
                      <View
                        key={msg.id}
                        style={[
                          styles.msgBubbleWrap,
                          { alignSelf: isMine ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        {!isMine && (
                          <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo, marginBottom: 2 }}>
                            {msg.senderName}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.msgBubble,
                            {
                              backgroundColor: isMine ? palette.indigo : palette.paper,
                              borderColor: isMine ? palette.indigo : palette.paperMuted,
                            },
                          ]}
                        >
                          {msg.replyTo && (
                            <View style={styles.replyQuoteBox}>
                              <Text style={{ fontSize: 10.5, fontWeight: '800', color: isMine ? '#FDE68A' : palette.indigo }}>
                                ↩ Trả lời {msg.replyTo.senderName}
                              </Text>
                              <Text
                                style={{ fontSize: 11, color: isMine ? '#E0E7FF' : palette.inkMuted }}
                                numberOfLines={1}
                              >
                                {msg.replyTo.preview}
                              </Text>
                            </View>
                          )}

                          <Text style={{ color: isMine ? '#FFFFFF' : palette.ink, fontSize: 14, lineHeight: 20 }}>
                            {msg.text}
                          </Text>

                          {msg.quizCard && (
                            <Pressable
                              onPress={() =>
                                router.push({ pathname: '/study/[setId]', params: { setId: msg.quizCard!.setId } })
                              }
                              style={styles.chatQuizCard}
                            >
                              <Ionicons name="play-circle" size={22} color="#FDE68A" />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }} numberOfLines={1}>
                                  {msg.quizCard.title}
                                </Text>
                                <Text style={{ color: '#CBD5E1', fontSize: 11 }}>
                                  {msg.quizCard.questionCount} câu · Chạm vào làm ngay
                                </Text>
                              </View>
                            </Pressable>
                          )}

                          {msg.poll && (
                            <View style={{ marginTop: 6, gap: 5 }}>
                              {msg.poll.options.map((op) => (
                                <Pressable
                                  key={op.id}
                                  onPress={() => voteGroupPoll(msg.id, op.id, viewerId)}
                                  style={styles.chatPollBtn}
                                >
                                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                                    {op.voterIds.includes(viewerId) ? '✓ ' : '○ '}
                                    {op.text} ({op.voterIds.length})
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>

                        <View style={styles.msgActionStrip}>
                          {(['❤️', '🔥', '👍'] as const).map((emo) => {
                            const cnt = msg.reactions[emo]?.length ?? 0;
                            return (
                              <Pressable
                                key={emo}
                                onPress={() => toggleMessageReaction(msg.id, emo, viewerId)}
                                style={styles.miniEmoBtn}
                              >
                                <Text style={{ fontSize: 11 }}>
                                  {emo}
                                  {cnt > 0 ? ` ${cnt}` : ''}
                                </Text>
                              </Pressable>
                            );
                          })}
                          <Pressable
                            onPress={() =>
                              setReplyTarget({
                                id: msg.id,
                                senderName: msg.senderName,
                                preview: msg.text.slice(0, 60),
                              })
                            }
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.inkMuted }}>↩ Trả lời</Text>
                          </Pressable>
                          <Pressable onPress={() => pinChannelMessage(activeChannel.id, msg.id)}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.gold }}>📌 Ghim</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>

                {replyTarget && (
                  <View style={[styles.activeReplyBar, { backgroundColor: palette.indigoTint }]}>
                    <Text style={{ fontSize: 11.5, color: palette.indigoDeep, flex: 1 }} numberOfLines={1}>
                      ↩ Đang trả lời {replyTarget.senderName}: {replyTarget.preview}
                    </Text>
                    <Pressable onPress={() => setReplyTarget(null)}>
                      <Ionicons name="close-circle" size={17} color={palette.indigoDeep} />
                    </Pressable>
                  </View>
                )}

                <View style={styles.chatInputRow}>
                  <TextInput
                    value={chatText}
                    onChangeText={setChatText}
                    onSubmitEditing={handleSendChatMessage}
                    placeholder={`Nhắn tin tới ${activeChannel.name}...`}
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.chatInput,
                      { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                    ]}
                  />
                  <Pressable
                    disabled={!chatText.trim()}
                    onPress={handleSendChatMessage}
                    style={[
                      styles.chatSendBtn,
                      { backgroundColor: palette.indigo, opacity: chatText.trim() ? 1 : 0.45 },
                    ]}
                  >
                    <Ionicons name="send" size={17} color="#FFFFFF" />
                  </Pressable>
                </View>
              </Card>
            )}
          </View>
        </SmoothReveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 3: SOCIAL NETWORK FRIENDS DISCOVERY HUB
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'friends' && (
        <SmoothReveal>
          <FriendsDiscoveryHub
            onOpenDirectChat={(peer) => {
              const dm = ensureDirectChannel(peer);
              setSelectedChannelId(dm.id);
              setMobileChatOpen(true);
              setMainTab('messenger');
            }}
          />
        </SmoothReveal>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODULE 4: LIVE REAL-TIME SEARCH ENGINE & SYNCHRONIZED LATEST NEWS
      ═══════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'search' && (
        <SmoothReveal>
          <Card style={{ marginBottom: spacing.md, borderColor: palette.indigoBorder, borderWidth: 1.5, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Badge tone="primary">🔎 SEARCH ENGINE THỜI GIAN THỰC</Badge>
              <Text style={{ fontSize: 11, fontWeight: '700', color: palette.mint }}>
                🟢 Google News · Wikipedia · OpenAlex · Hacker News
              </Text>
            </View>
            <Text style={[typography.title, { color: palette.ink }]}>
              Tìm Kiếm Mọi Tin Mới Nhất, Công Nghệ & Học Thuật
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              Gõ bất kỳ chủ đề nào (vd: Google Neon, Gemini AI, Lượng tử, kinh tế, sự kiện vừa diễn ra...) để lấy tin tức & tài liệu cập nhật mới nhất ngay tức thì!
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={[styles.searchBoxWrap, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}>
                <Ionicons name="search" size={18} color={palette.indigo} />
                <TextInput
                  value={searchQuery}
                  onChangeText={(v) => {
                    setSearchQuery(v);
                    if (v.trim().length < 2) setLiveResults([]);
                  }}
                  onSubmitEditing={() => void runLiveSearchNow()}
                  returnKeyType="search"
                  placeholder="Tìm kiếm bất kỳ tin mới hoặc khái niệm nào..."
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.searchEngineInput, { color: palette.ink }]}
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      setLiveResults([]);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                  </Pressable>
                )}
              </View>
              <Button icon="search" disabled={searching || searchQuery.trim().length < 2} onPress={() => void runLiveSearchNow()}>
                {searching ? 'Đang tìm…' : 'Tìm'}
              </Button>
            </View>

            {/* Quick Live Trending Topic Chips synced directly with Search Engine */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
              {['Trí tuệ nhân tạo AI', 'Google Gemini', 'Bán dẫn & Lượng tử', 'Kỹ thuật Phần mềm', 'Khoa học Vũ trụ', 'Lịch sử Việt Nam'].map(
                (kw) => (
                  <Pressable
                    key={kw}
                    onPress={() => void runLiveSearchNow(kw)}
                    style={[styles.tagChip, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>⚡ {kw}</Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          </Card>

          {/* Local Papyrus University Sets Matches */}
          {localMatchedSets.length > 0 && (
            <View style={{ marginBottom: spacing.md, gap: 6 }}>
              <Text style={[typography.label, { color: palette.indigo }]}>
                📜 BỘ ĐỀ ĐẠI HỌC TRONG KHO PAPYRUS ({localMatchedSets.length})
              </Text>
              {localMatchedSets.map((s) => (
                <Card
                  key={s.id}
                  onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: s.id } })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md }}
                >
                  <Ionicons name="school" size={22} color={palette.indigo} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                      {s.title}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      {s.subject} · {s.questions.length} câu hỏi
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={26} color={palette.indigo} />
                </Card>
              ))}
            </View>
          )}

          {/* Live Search Engine Web & News Results */}
          {searching ? (
            <PapyrusPageSkeleton variant="library" label={`Đang tìm kết quả mới nhất cho "${searchQuery}"…`} />
          ) : searchQuery.trim().length >= 2 ? (
            <View style={{ marginBottom: spacing.lg, gap: 10 }}>
              <Text style={[typography.label, { color: palette.gold }]}>
                🌐 KẾT QUẢ MỚI NHẤT CHO «{searchQuery.toUpperCase()}» ({liveResults.length})
              </Text>
              {liveResults.length === 0 ? (
                <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Không tìm thấy bài viết khớp chính xác với từ khóa này. Hãy thử từ khóa cụ thể hơn!
                  </Text>
                </Card>
              ) : (
                liveResults.map((art) => (
                  <Card key={art.id} style={{ gap: 8, padding: spacing.md }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Badge tone={art.source === 'Google News' ? 'fire' : art.source === 'OpenAlex Khoa Học' ? 'success' : 'primary'}>
                        {art.source} · {art.category}
                      </Badge>
                      <Text style={{ fontSize: 11, color: palette.inkMuted, fontWeight: '700' }}>{art.publishedLabel}</Text>
                    </View>
                    {art.thumbnailUrl ? (
                      <Image source={{ uri: art.thumbnailUrl }} style={styles.newsThumb} resizeMode="cover" />
                    ) : null}
                    <Text style={[typography.title, { color: palette.ink }]}>{art.title}</Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, lineHeight: 19 }]}>{art.summary}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <Button
                        variant="reward"
                        icon="sparkles"
                        onPress={() => {
                          usePapyrusStore.getState().saveSourceDocument({
                            id: `search-${Date.now()}`,
                            title: art.title,
                            text: `${art.title}\n\n${art.summary}\nNguồn: ${art.url}`,
                            createdAt: new Date().toISOString(),
                          });
                          router.push('/create/generate');
                        }}
                      >
                        Tạo Quiz AI
                      </Button>
                      <Button variant="primary" icon="add-circle-outline" onPress={() => shareArticleToStory(art)}>
                        Đăng lên Story
                      </Button>
                      <Button variant="secondary" icon="share-social-outline" onPress={() => shareArticleToThread(art)}>
                        Đăng Thread
                      </Button>
                      <Pressable onPress={() => void Linking.openURL(art.url)} style={styles.readOriginalBtn}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>Đọc bài gốc ↗</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
            </View>
          ) : null}

          {/* Real-Time Latest News Stream (Synchronized with Search Engine) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typography.title, { color: palette.ink, flex: 1 }]}>
              🗞️ Tin Tức Khoa Học, AI & Công Nghệ Mới Nhất Hôm Nay
            </Text>
            <Pressable onPress={() => void reloadDailyTrending()} style={{ padding: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>Làm mới</Text>
            </Pressable>
          </View>
          {loadingDaily ? (
            <PapyrusPageSkeleton variant="library" label="Đang đồng bộ tin tức thời gian thực…" />
          ) : (
            <View style={{ gap: 10 }}>
              {dailyFeed.map((item) => (
                <Card key={item.id} style={{ gap: 8, padding: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <Badge tone={item.source === 'Google News' ? 'fire' : item.source === 'Dev.to Tech' ? 'success' : 'primary'}>
                      {item.source} · {item.category}
                    </Badge>
                    <Text style={{ fontSize: 11, color: palette.inkMuted, fontWeight: '700' }}>{item.publishedLabel}</Text>
                  </View>
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.newsThumb} resizeMode="cover" />
                  ) : null}
                  <Text style={[typography.title, { color: palette.ink }]}>{item.title}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, lineHeight: 19 }]}>{item.summary}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      variant="reward"
                      icon="sparkles-outline"
                      onPress={() => {
                        usePapyrusStore.getState().saveSourceDocument({
                          id: `daily-${Date.now()}`,
                          title: item.title,
                          text: `${item.title}\n\n${item.summary}`,
                          createdAt: new Date().toISOString(),
                        });
                        router.push('/create/generate');
                      }}
                    >
                      Biến thành Quiz
                    </Button>
                    <Button variant="primary" icon="add-circle-outline" onPress={() => shareArticleToStory(item)}>
                      Đăng Story
                    </Button>
                    <Button variant="secondary" icon="chatbubbles-outline" onPress={() => shareArticleToThread(item)}>
                      Đăng Thread
                    </Button>
                    <Pressable onPress={() => void Linking.openURL(item.url)} style={styles.readOriginalBtn}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>Mở nguồn ↗</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </SmoothReveal>
      )}

      {/* ── MODAL 1: THREADS + FACEBOOK MULTI-PART COMPOSER WITH 10 VIRAL TEMPLATES ── */}
      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={[styles.composerModalCard, { backgroundColor: palette.paper }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[typography.title, { color: palette.ink, flex: 1 }]}>
                🧵 Đăng Bài Viết & Chuỗi Thread (+30 XP)
              </Text>
              <Pressable onPress={() => setComposerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={palette.inkMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 490 }} showsVerticalScrollIndicator={false}>
              <Text style={[typography.label, { color: palette.gold, marginBottom: 6 }]}>
                ⚡ CHỌN NHANH 1 TRONG 10 MẪU VIRAL THREAD HỌC THUẬT:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                {VIRAL_THREAD_TEMPLATES.map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    onPress={() => applyViralTemplate(tpl.id)}
                    style={[
                      styles.tplCard,
                      {
                        backgroundColor:
                          selectedTemplateBadge === tpl.badge ? palette.indigoTint : palette.paperRaised,
                        borderColor: selectedTemplateBadge === tpl.badge ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '900', color: palette.indigo }}>{tpl.badge}</Text>
                    <Text style={{ fontSize: 11, color: palette.ink, marginTop: 2 }} numberOfLines={2}>
                      {tpl.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {threadParts.map((val, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ alignItems: 'center', width: 22, paddingTop: 8 }}>
                    <View style={[styles.stepCircle, { backgroundColor: palette.indigo }]}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>{idx + 1}</Text>
                    </View>
                    {idx < threadParts.length - 1 && (
                      <View style={{ width: 2, flex: 1, backgroundColor: palette.indigoBorder, marginTop: 4 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TextInput
                      value={val}
                      onChangeText={(txt) =>
                        setThreadParts((prev) => prev.map((item, i) => (i === idx ? txt : item)))
                      }
                      multiline
                      placeholder={
                        idx === 0
                          ? 'Mở đầu thu hút (Hook) hoặc nội dung bài đăng của bạn...'
                          : `Đoạn nối chuỗi Thread #${idx + 1} (chi tiết, công thức, TL;DR)...`
                      }
                      placeholderTextColor={palette.inkMuted}
                      style={[
                        styles.threadArea,
                        { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                      ]}
                    />
                  </View>
                  {threadParts.length > 1 && (
                    <Pressable
                      onPress={() => setThreadParts((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ paddingTop: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={palette.danger} />
                    </Pressable>
                  )}
                </View>
              ))}

              <Pressable
                onPress={() => setThreadParts((prev) => [...prev, ''])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}
              >
                <Ionicons name="add-circle" size={18} color={palette.indigo} />
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.indigo }}>
                  + Nối thêm đoạn vào chuỗi Thread
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <Pressable
                  onPress={async () => {
                    const img = await pickCoverImageDataUrl().catch(() => null);
                    if (img) setPostImageUri(img);
                  }}
                  style={[styles.attachPill, { borderColor: palette.paperMuted }]}
                >
                  <Ionicons name="image-outline" size={15} color="#10B981" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Ảnh</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowCodeField((v) => !v)}
                  style={[styles.attachPill, { borderColor: palette.paperMuted }]}
                >
                  <Ionicons name="code-slash" size={15} color={palette.indigo} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Code</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowPollBuilder((v) => !v)}
                  style={[styles.attachPill, { borderColor: palette.paperMuted }]}
                >
                  <Ionicons name="stats-chart" size={15} color="#F59E0B" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Khảo sát Poll</Text>
                </Pressable>

                <Pressable
                  onPress={() => setAttachedSetId((prev) => (prev ? '' : allSets[0]?.id ?? ''))}
                  style={[
                    styles.attachPill,
                    { borderColor: attachedSetId ? palette.indigo : palette.paperMuted },
                  ]}
                >
                  <Ionicons name="school-outline" size={15} color={palette.indigo} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                    {attachedSetId ? '✓ Đã gắn Bộ đề' : 'Đính kèm Bộ đề'}
                  </Text>
                </Pressable>
              </View>

              {postImageUri ? (
                <Image source={{ uri: postImageUri }} style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 8 }} />
              ) : null}

              {showCodeField && (
                <TextInput
                  value={postCode}
                  onChangeText={setPostCode}
                  multiline
                  placeholder="Dán đoạn code minh họa..."
                  placeholderTextColor="#64748B"
                  style={styles.codeEditorInput}
                />
              )}

              {showPollBuilder && (
                <View style={{ gap: 6, marginBottom: 8 }}>
                  <TextInput
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    placeholder="Câu hỏi khảo sát..."
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                  />
                  <TextInput
                    value={pollOpt1}
                    onChangeText={setPollOpt1}
                    placeholder="Phương án 1"
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                  />
                  <TextInput
                    value={pollOpt2}
                    onChangeText={setPollOpt2}
                    placeholder="Phương án 2"
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                  />
                </View>
              )}

              {!!attachedSetId && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                  {allSets.slice(0, 8).map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setAttachedSetId(s.id)}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: attachedSetId === s.id ? palette.indigoTint : palette.paperRaised,
                          borderColor: attachedSetId === s.id ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <TextInput
                value={postTagsText}
                onChangeText={setPostTagsText}
                placeholder="Hashtags (cách nhau bằng dấu phẩy: CNTT, ÔnThi...)"
                placeholderTextColor={palette.inkMuted}
                style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted, marginBottom: 10 }]}
              />
            </ScrollView>

            <Button
              variant="primary"
              icon="paper-plane"
              disabled={!threadParts.some((p) => p.trim().length > 0)}
              onPress={publishThreadPost}
              fullWidth
            >
              Đăng lên Bảng Tin & Trang Cá Nhân
            </Button>
          </Card>
        </View>
      </Modal>

      {/* ── MODAL 2: CREATE NEW STUDY GROUP ── */}
      <Modal visible={newGroupModal} transparent animationType="fade" onRequestClose={() => setNewGroupModal(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={{ width: '100%', maxWidth: 420, gap: 10, backgroundColor: palette.paper }}>
            <Text style={[typography.title, { color: palette.ink }]}>➕ Tạo Nhóm Học Tập Mới</Text>
            <TextInput
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Tên nhóm (vd: Ôn thi Giải tích 2 K26)..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
            />
            <TextInput
              value={newGroupTopic}
              onChangeText={setNewGroupTopic}
              placeholder="Chuyên đề môn học..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.pollSmallInput, { color: palette.ink, borderColor: palette.paperMuted }]}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button variant="ghost" onPress={() => setNewGroupModal(false)} fullWidth>
                  Hủy
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={!newGroupName.trim()}
                  onPress={() => {
                    const created = createStudyGroup({
                      name: newGroupName,
                      subtitle: `Nhóm học tập tạo bởi ${viewerName}`,
                      topic: newGroupTopic,
                      accentColor: '#8B5CF6',
                    });
                    setSelectedChannelId(created.id);
                    setMobileChatOpen(true);
                    setNewGroupName('');
                    setNewGroupModal(false);
                  }}
                  fullWidth
                >
                  Tạo nhóm
                </Button>
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Story Viewer & Composer */}
      <StoryViewerModal
        story={activeStory}
        viewerId={viewerId}
        onClose={() => setActiveStory(null)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
        onDirectMessage={(author) => {
          const dm = ensureDirectChannel(author);
          if (author.replyText) {
            sendGroupMessage({
              channelId: dm.id,
              senderId: viewerId,
              senderName: viewerName,
              senderAvatar: user?.avatarUrl ?? null,
              text: `💬 Phản hồi tin Story của bạn: "${author.replyText}"`,
            });
          }
          setSelectedChannelId(dm.id);
          setMobileChatOpen(true);
          setMainTab('messenger');
        }}
      />
      <StoryComposerModal
        visible={storyComposerOpen}
        initialDraft={storyDraft}
        onClose={() => {
          setStoryComposerOpen(false);
          setStoryDraft(null);
        }}
        onPublish={(data) => {
          addStory({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: user?.avatarUrl ?? null,
            authorLevel: rankInfo.level,
            badgeLabel: `${rankInfo.badge} ${rankInfo.titleVi}`,
            ...data,
          });
          addBonusXp(20);
          sfx.playLevelUp();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  composePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  hubTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    marginBottom: spacing.md,
  },
  hubTabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  storiesRow: { gap: 10, paddingBottom: spacing.md },
  quickComposeCard: { padding: spacing.md, marginBottom: spacing.md, gap: 10 },
  miniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeInputPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  quickComposeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  composeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterBarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  messengerSplit: { flexDirection: 'row', gap: spacing.md },
  channelPane: { padding: spacing.md },
  smallNewGrpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  onlinePeerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  chIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRoomCard: { padding: spacing.md, gap: 8 },
  chatRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backToListBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatToolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  inlinePollBuilder: {
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 8,
  },
  pollSmallInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  msgBubbleWrap: { maxWidth: '86%' },
  msgBubble: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
    paddingLeft: 8,
    marginBottom: 4,
  },
  chatQuizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  chatPollBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  msgActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    paddingHorizontal: 4,
  },
  miniEmoBtn: { paddingHorizontal: 4, paddingVertical: 1 },
  activeReplyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chatInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBoxWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchEngineInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 8,
  },
  readOriginalBtn: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newsThumb: {
    width: '100%',
    height: 156,
    borderRadius: radii.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 24, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  composerModalCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 24,
    gap: 10,
  },
  tplCard: {
    width: 156,
    padding: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadArea: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  attachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  codeEditorInput: {
    minHeight: 64,
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    borderRadius: radii.sm,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 8,
  },
});
