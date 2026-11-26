import { createElement, memo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import {
  EMOJI_REACTION_CATALOG,
  type EmojiReactionType,
  type SocialMediaItem,
  type SocialPostItem,
  type SocialUserProfile,
} from '../domain/models';
import { canViewerReplyToPost, type SocialGraphSnapshot } from '../domain/rankingAndPermissions';
import { UnifiedZaloPollCard } from './UnifiedZaloPollCard';
import { SharedPostCard } from './SharedPostCard';
import { GifStickerEmojiPickerModal } from './GifStickerEmojiPickerModal';

function formatRelativeTimeVi(iso: string): string {
  const diffSec = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatGhostRemaining(expiresAt?: string | null): string {
  if (!expiresAt) return '';
  const ms = Math.max(0, Date.parse(expiresAt) - Date.now());
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hrs > 0 ? `Còn ${hrs}g ${mins}p` : `Còn ${mins} phút`;
}

/** Render inline backtick spans as highlighted monospace code without raw markdown ticks. */
function renderTextWithInlineCode(
  content: string,
  baseStyle: object,
  codeBg: string,
  codeFg: string
) {
  if (!content.includes('`')) {
    return <Text style={baseStyle}>{content}</Text>;
  }
  const segments = content.split(/(`[^`\n]+`)/g);
  return (
    <Text style={baseStyle}>
      {segments.map((seg, i) => {
        if (seg.length >= 2 && seg.startsWith('`') && seg.endsWith('`')) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
                backgroundColor: codeBg,
                color: codeFg,
                fontWeight: '700',
              }}
            >
              {` ${seg.slice(1, -1)} `}
            </Text>
          );
        }
        return seg;
      })}
    </Text>
  );
}

export const MetaThreadsPostCard = memo(function MetaThreadsPostCard({
  post,
  viewerId,
  viewerName,
  viewerAvatar,
  recommendationReason,
  isSavedBookmark,
  isFavourited,
  isFollowingAuthor,
  profilesById,
  graph,
  collections,
  conversations,
  communities,
  onToggleFollow,
  onReactPost,
  onTogglePureRepost,
  onOpenQuoteComposer,
  onToggleBookmark,
  onToggleFavourite,
  onTogglePin,
  onEditPost,
  onDeleteOrArchive,
  onSummarizeAi,
  onVotePoll,
  onAddPollOption,
  onToggleClosePoll,
  onVoteDebate,
  onAddDebateArgument,
  onAddReply,
  onEditOrDeleteComment,
  onReactComment,
  onPinComment,
  onShareToTarget,
  onAlgoFeedback,
  onBlockOrMuteAuthor,
  onReportTarget,
}: {
  post: SocialPostItem;
  viewerId: string;
  viewerName: string;
  viewerAvatar: string | null;
  recommendationReason?: string;
  isSavedBookmark: boolean;
  isFavourited: boolean;
  isFollowingAuthor: boolean;
  profilesById: Record<string, SocialUserProfile>;
  graph: SocialGraphSnapshot;
  collections: Array<{ id: string; name: string; coverEmoji: string }>;
  conversations: Array<{ id: string; title: string; kind: string }>;
  communities: Array<{ id: string; name: string }>;
  onToggleFollow: (targetId: string) => void;
  onReactPost: (postId: string, reaction: EmojiReactionType) => void;
  onTogglePureRepost: (postId: string) => void;
  onOpenQuoteComposer: (post: SocialPostItem) => void;
  onToggleBookmark: (postId: string, collectionId?: string) => void;
  onToggleFavourite: (postId: string) => void;
  onTogglePin: (postId: string, scope: 'profile' | 'community') => void;
  onEditPost: (postId: string, nextParts: string[], nextLongForm?: string) => void;
  onDeleteOrArchive: (postId: string, mode: 'delete' | 'archive') => void;
  onSummarizeAi: (postId: string) => Promise<void>;
  onVotePoll: (postId: string, optionId: string) => void;
  onAddPollOption: (postId: string, text: string) => void;
  onToggleClosePoll: (postId: string) => void;
  onVoteDebate: (postId: string, side: 'A' | 'B') => void;
  onAddDebateArgument: (postId: string, side: 'A' | 'B', content: string) => void;
  onAddReply: (input: {
    postId: string;
    parentCommentId: string | null;
    content: string;
    mediaItem?: SocialMediaItem | null;
  }) => void;
  onEditOrDeleteComment: (postId: string, commentId: string, newContent?: string | null) => void;
  onReactComment: (postId: string, commentId: string, reaction: EmojiReactionType) => void;
  onPinComment: (postId: string, commentId: string) => void;
  onShareToTarget: (
    post: SocialPostItem,
    dest: { type: 'conversation'; conversationId: string } | { type: 'community'; communityId: string },
    note: string
  ) => void;
  onAlgoFeedback: (action: 'more' | 'less' | 'not_interested' | 'hide_topic', post: SocialPostItem) => void;
  onBlockOrMuteAuthor: (authorId: string, kind: 'block' | 'mute') => void;
  onReportTarget: (targetType: 'post' | 'comment', targetId: string, preview: string, ownerId: string) => void;
}) {
  const palette = usePalette();
  const router = useRouter();

  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [longFormExpanded, setLongFormExpanded] = useState(false);
  const [summarizingAi, setSummarizingAi] = useState(false);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<SocialMediaItem | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const [reactionBarOpen, setReactionBarOpen] = useState(false);
  const [reactorsModalOpen, setReactorsModalOpen] = useState(false);
  const [repostSheetOpen, setRepostSheetOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editDraftText, setEditDraftText] = useState(post.threadParts.join('\n\n'));

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentSort, setCommentSort] = useState<'top' | 'newest'>('top');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyMedia, setReplyMedia] = useState<SocialMediaItem | null>(null);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);

  const [debateArgDraft, setDebateArgDraft] = useState('');
  const [debateSidePick, setDebateSidePick] = useState<'A' | 'B'>('A');
  const [debateArgsExpanded, setDebateArgsExpanded] = useState(false);

  const isOwnPost = (post.internalAuthorId || post.authorId) === viewerId;
  const canReply = canViewerReplyToPost(post, viewerId, graph);
  const hasReposted = post.repostedByIds.includes(viewerId);

  // Compute user's active reaction & total count
  let myReaction: EmojiReactionType | null = null;
  let totalReactions = 0;
  const activeEmojis: Array<{ type: EmojiReactionType; emoji: string; count: number }> = [];
  for (const meta of EMOJI_REACTION_CATALOG) {
    const arr = post.reactions[meta.type] ?? [];
    if (arr.length > 0) {
      totalReactions += arr.length;
      activeEmojis.push({ type: meta.type, emoji: meta.emoji, count: arr.length });
      if (arr.includes(viewerId)) myReaction = meta.type;
    }
  }
  const myReactionMeta = EMOJI_REACTION_CATALOG.find((m) => m.type === myReaction);

  const navigateToProfile = (targetUserId: string, anonymous = false) => {
    if (anonymous || !targetUserId || targetUserId === 'anonymous-member') return;
    router.push({ pathname: '/user/[userId]', params: { userId: targetUserId } });
  };

  const rootComments = post.comments
    .filter((c) => !c.parentCommentId)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (commentSort === 'newest') return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      const countA = Object.values(a.reactions).reduce((s, x) => s + (x?.length ?? 0), 0);
      const countB = Object.values(b.reactions).reduce((s, x) => s + (x?.length ?? 0), 0);
      return countB - countA;
    });

  const copyPostDeepLink = async () => {
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://papyrus-lyart-five.vercel.app';
    const url = `${origin}/post/${post.id}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => undefined);
    } else {
      await Share.share({ message: url }).catch(() => undefined);
    }
  };

  const engagementRate =
    post.impressionsCount > 0
      ? Math.min(
          100,
          Math.round(
            ((totalReactions + post.comments.length + post.repostedByIds.length + post.sharesCount) /
              post.impressionsCount) *
              1000
          ) / 10
        )
      : 12.5;

  return (
    <Card style={styles.card}>
      {/* Pinned / Recommendation / Community Context Pill */}
      {(post.isPinnedProfile || post.isPinnedCommunity || post.communityName || recommendationReason) && (
        <View style={styles.contextHeader}>
          {post.isPinnedProfile || post.isPinnedCommunity ? (
            <View style={styles.contextPill}>
              <Ionicons name="pin" size={12} color={palette.gold} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: palette.gold }}>Đã ghim</Text>
            </View>
          ) : null}
          {post.communityName ? (
            <View style={styles.contextPill}>
              <Ionicons name="people" size={12} color={palette.indigo} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }} numberOfLines={1}>
                {post.communityName}
              </Text>
            </View>
          ) : null}
          {recommendationReason ? (
            <Text style={{ fontSize: 10.5, color: palette.inkMuted, flexShrink: 1 }} numberOfLines={1}>
              {recommendationReason}
            </Text>
          ) : null}
        </View>
      )}

      {/* Top Author Identity Row — Uses Main Profile Name Only! */}
      <View style={styles.authorRow}>
        <Pressable
          accessibilityRole="button"
          disabled={post.isAnonymous}
          onPress={() => navigateToProfile(post.authorId, post.isAnonymous)}
          style={styles.authorLeft}
        >
          <View style={[styles.avatarCircle, { backgroundColor: post.isAnonymous ? '#475569' : palette.indigo }]}>
            {post.authorAvatar && !post.isAnonymous ? (
              <Image source={{ uri: post.authorAvatar }} style={styles.avatarImg} />
            ) : (
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>
                {post.isAnonymous ? '?' : (post.authorName[0] || 'P').toUpperCase()}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 15, flexShrink: 1 }]} numberOfLines={1}>
                {post.authorName}
              </Text>
              {post.authorBadges?.[0] ? <Badge tone="primary">{post.authorBadges[0]}</Badge> : null}
              {post.postKind === 'ghost' && post.expiresAt ? (
                <Badge tone="fire">Tự hủy · {formatGhostRemaining(post.expiresAt)}</Badge>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
              <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                {formatRelativeTimeVi(post.createdAt)}
                {post.editHistory.length > 0 ? ' · Đã chỉnh sửa' : ''}
                {post.locationLabel ? ` · ${post.locationLabel}` : ''}
              </Text>
              <Text style={{ fontSize: 11, color: palette.indigo }}>
                {post.audience === 'public'
                  ? 'Công khai'
                  : post.audience === 'friends'
                  ? 'Bạn bè'
                  : post.audience === 'followers'
                  ? 'Người theo dõi'
                  : post.audience === 'close_friends'
                  ? 'Bạn thân'
                  : post.audience === 'only_me'
                  ? 'Chỉ mình tôi'
                  : 'Trong nhóm'}
              </Text>
            </View>
          </View>
        </Pressable>

        {!isOwnPost && !post.isAnonymous && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onToggleFollow(post.authorId)}
            style={[
              styles.followPill,
              {
                backgroundColor: isFollowingAuthor ? palette.paperMuted : palette.indigoTint,
                borderColor: isFollowingAuthor ? palette.paperMuted : palette.indigo,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '800',
                color: isFollowingAuthor ? palette.inkMuted : palette.indigoDeep,
              }}
            >
              {isFollowingAuthor ? 'Đang theo dõi' : '+ Theo dõi'}
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tùy chọn bài viết"
          onPress={() => setMoreMenuOpen(true)}
          style={styles.moreIconBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={19} color={palette.inkMuted} />
        </Pressable>
      </View>

      {/* SPOILER GATE OR MAIN THREAD BODY */}
      {post.isSpoiler && !spoilerRevealed ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSpoilerRevealed(true)}
          style={[styles.spoilerCoverBox, { backgroundColor: palette.paper, borderColor: palette.gold }]}
        >
          <Ionicons name="eye-off" size={24} color={palette.gold} />
          <Text style={[typography.body, { color: palette.ink, fontWeight: '800', textAlign: 'center' }]}>
            ⚠️ Cảnh báo Spoiler: {post.spoilerWarning || 'Nội dung ẩn tránh lộ tình tiết/đáp án'}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}>
            Chạm vào đây để hiển thị toàn bộ bài viết & phương tiện
          </Text>
        </Pressable>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          {/* Meta Threads Connected Multi-Part Vertical Spine */}
          {post.threadParts.map((part, idx) => {
            const hasNext = idx < post.threadParts.length - 1;
            return (
              <View key={idx} style={styles.threadPartRow}>
                {post.threadParts.length > 1 && (
                  <View style={styles.threadRailCol}>
                    <View
                      style={[
                        styles.threadNode,
                        { backgroundColor: idx === 0 ? palette.indigo : palette.paperMuted },
                      ]}
                    >
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: idx === 0 ? '#FFF' : palette.ink }}>
                        {idx + 1}
                      </Text>
                    </View>
                    {hasNext && <View style={[styles.threadSpine, { backgroundColor: palette.indigoBorder }]} />}
                  </View>
                )}
                <Pressable
                  onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.id } })}
                  style={{ flex: 1, minWidth: 0, paddingBottom: hasNext ? 12 : 4 }}
                >
                  {renderTextWithInlineCode(
                    part,
                    [
                      typography.body,
                      {
                        color: palette.ink,
                        fontWeight: idx === 0 && post.threadParts.length > 1 ? '700' : '500',
                        lineHeight: 22,
                      },
                    ],
                    palette.indigoTint,
                    palette.indigoDeep
                  )}
                </Pressable>
              </View>
            );
          })}

          {/* Long-Form Rich Content with Read More + PapyAI Summary */}
          {post.longFormBody ? (
            <View style={[styles.longFormBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
              {renderTextWithInlineCode(
                longFormExpanded || post.longFormBody.length <= 220
                  ? post.longFormBody
                  : `${post.longFormBody.slice(0, 220)}…`,
                [typography.caption, { color: palette.ink, lineHeight: 20 }],
                palette.indigoTint,
                palette.indigoDeep
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                {post.longFormBody.length > 220 && (
                  <Pressable onPress={() => setLongFormExpanded((v) => !v)}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                      {longFormExpanded ? 'Thu gọn bài dài ▲' : 'Đọc toàn bộ bài dài ▼'}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  disabled={summarizingAi}
                  onPress={async () => {
                    setSummarizingAi(true);
                    try {
                      await onSummarizeAi(post.id);
                    } finally {
                      setSummarizingAi(false);
                    }
                  }}
                  style={[styles.aiSummarizeBtn, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
                >
                  <Ionicons name="sparkles" size={13} color={palette.indigo} />
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                    {summarizingAi ? 'PapyAI đang tóm tắt…' : 'Tóm tắt bằng PapyAI'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : post.threadParts.join(' ').length > 200 && !post.aiSummary ? (
            <Pressable
              disabled={summarizingAi}
              onPress={async () => {
                setSummarizingAi(true);
                try {
                  await onSummarizeAi(post.id);
                } finally {
                  setSummarizingAi(false);
                }
              }}
              style={[styles.aiSummarizeBtn, { alignSelf: 'flex-start', marginTop: 6, backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
            >
              <Ionicons name="sparkles" size={13} color={palette.indigo} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                {summarizingAi ? 'PapyAI đang tóm tắt…' : '✨ PapyAI Tóm tắt nhanh chuỗi Thread'}
              </Text>
            </Pressable>
          ) : null}

          {/* Clearly Labeled PapyAI Summary Card */}
          {post.aiSummary ? (
            <View style={[styles.aiSummaryCard, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 11.5, fontWeight: '900', color: palette.indigoDeep }}>
                  BẢN TÓM TẮT DO PAPYAI TẠO (KHÔNG THAY THẾ BÀI VIẾT GỐC)
                </Text>
              </View>
              <Text style={{ fontSize: 12.5, color: palette.ink, lineHeight: 19, marginTop: 4 }}>
                {post.aiSummary.summaryText}
              </Text>
            </View>
          ) : null}

          {/* Multi-Media Horizontal Swipeable Carousel + Video Cover Player */}
          {post.mediaItems.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <ScrollView
                horizontal
                pagingEnabled={post.mediaItems.length > 1}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const w = e.nativeEvent.layoutMeasurement.width || 300;
                  setActiveSlideIdx(Math.round(e.nativeEvent.contentOffset.x / w));
                }}
                contentContainerStyle={{ gap: 8 }}
              >
                {post.mediaItems.map((m) => {
                  const isVid = m.kind === 'video';
                  const isPlayingThis = playingVideoId === m.id;
                  const thumb = m.thumbnailUri || m.uri;
                  return (
                    <View
                      key={m.id}
                      style={[
                        styles.carouselSlide,
                        { width: post.mediaItems.length > 1 ? 285 : '100%' as unknown as number },
                      ]}
                    >
                      {isVid && isPlayingThis && Platform.OS === 'web' ? (
                        createElement('video', {
                          src: m.uri,
                          poster: thumb || undefined,
                          controls: true,
                          autoPlay: true,
                          playsInline: true,
                          width: 640,
                          height: 360,
                          style: { width: '100%', height: '100%', objectFit: 'cover' },
                        })
                      ) : (
                        <Pressable
                          onPress={() => {
                            if (isVid) setPlayingVideoId(m.id);
                            else setLightboxMedia(m);
                          }}
                          style={{ width: '100%', height: '100%' }}
                        >
                          <Image
                            source={{ uri: thumb }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={m.kind === 'sticker' ? 'contain' : 'cover'}
                          />
                          {isVid && (
                            <View style={styles.videoPlayOverlay}>
                              <View style={styles.playCircle}>
                                <Ionicons name="play" size={24} color="#FFFFFF" />
                              </View>
                              <View style={styles.durationTag}>
                                <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                                  🎬 Video{m.durationSec ? ` · ${m.durationSec}s` : ''}
                                </Text>
                              </View>
                            </View>
                          )}
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {post.mediaItems.length > 1 && (
                <View style={styles.dotsRow}>
                  {post.mediaItems.map((m, idx) => (
                    <Pressable
                      key={m.id}
                      accessibilityLabel={`Ảnh ${idx + 1} trên ${post.mediaItems.length}`}
                      onPress={() => setActiveSlideIdx(idx)}
                      style={[
                        styles.dot,
                        {
                          width: activeSlideIdx === idx ? 18 : 7,
                          backgroundColor: activeSlideIdx === idx ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Code Snippet */}
          {post.codeSnippet ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{post.codeSnippet}</Text>
            </View>
          ) : null}

          {/* Unified Zalo-Style Poll */}
          {post.poll ? (
            <UnifiedZaloPollCard
              poll={post.poll}
              viewerId={viewerId}
              viewerName={viewerName}
              profilesById={profilesById}
              onVote={(optId) => onVotePoll(post.id, optId)}
              onAddOption={(txt) => onAddPollOption(post.id, txt)}
              onToggleClose={() => onToggleClosePoll(post.id)}
            />
          ) : null}

          {/* Debate Mode Structured Arguments & Viewpoint Voting (Section 10.5) */}
          {post.debate ? (
            <View style={[styles.debateBox, { backgroundColor: palette.paper, borderColor: palette.indigoBorder }]}>
              <Badge tone="reward">⚖️ Chế độ Tranh biện Đa chiều</Badge>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => onVoteDebate(post.id, 'A')}
                  style={[
                    styles.debateVoteBtn,
                    {
                      borderColor: palette.indigo,
                      backgroundColor: post.debate.sideAVoterIds.includes(viewerId)
                        ? palette.indigoTint
                        : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigoDeep }} numberOfLines={2}>
                    A · {post.debate.sideALabel} ({post.debate.sideAVoterIds.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onVoteDebate(post.id, 'B')}
                  style={[
                    styles.debateVoteBtn,
                    {
                      borderColor: palette.fire,
                      backgroundColor: post.debate.sideBVoterIds.includes(viewerId)
                        ? palette.fireTint
                        : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.fire }} numberOfLines={2}>
                    B · {post.debate.sideBLabel} ({post.debate.sideBVoterIds.length})
                  </Text>
                </Pressable>
              </View>

              {post.debate.aiNeutralSummary ? (
                <Text style={{ fontSize: 11.5, color: palette.inkMuted, marginTop: 6, lineHeight: 17 }}>
                  🤖 {post.debate.aiNeutralSummary}
                </Text>
              ) : null}

              <View style={{ gap: 6, marginTop: 8 }}>
                {(debateArgsExpanded ? post.debate.arguments : post.debate.arguments.slice(0, 2)).map((arg) => (
                  <View
                    key={arg.id}
                    style={[
                      styles.debateArgItem,
                      {
                        borderLeftColor: arg.side === 'A' ? palette.indigo : palette.fire,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  >
                    <Pressable onPress={() => navigateToProfile(arg.authorId)}>
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '800',
                          color: arg.side === 'A' ? palette.indigoDeep : palette.fire,
                        }}
                      >
                        [{arg.side === 'A' ? post.debate!.sideALabel : post.debate!.sideBLabel}] · {arg.authorName}
                      </Text>
                    </Pressable>
                    <Text style={{ fontSize: 12, color: palette.ink, marginTop: 2 }}>{arg.content}</Text>
                  </View>
                ))}
                {post.debate.arguments.length > 2 ? (
                  <Pressable onPress={() => setDebateArgsExpanded((v) => !v)} style={{ paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                      {debateArgsExpanded
                        ? 'Thu gọn lập luận ▲'
                        : `Xem thêm ${post.debate.arguments.length - 2} lập luận ▼`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => setDebateSidePick((s) => (s === 'A' ? 'B' : 'A'))}
                  style={[styles.sideToggle, { borderColor: palette.indigo }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>Phe {debateSidePick}</Text>
                </Pressable>
                <TextInput
                  value={debateArgDraft}
                  onChangeText={setDebateArgDraft}
                  placeholder={`Đóng góp lập luận cho Phe ${debateSidePick}...`}
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.inlineInput, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
                />
                <Pressable
                  onPress={() => {
                    if (debateArgDraft.trim()) {
                      onAddDebateArgument(post.id, debateSidePick, debateArgDraft);
                      setDebateArgDraft('');
                    }
                  }}
                  style={[styles.sendMiniBtn, { backgroundColor: palette.indigo }]}
                >
                  <Ionicons name="send" size={14} color={palette.onPrimary} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Embedded Playable Quiz Card */}
          {post.attachedQuiz ? (
            <Pressable
              onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: post.attachedQuiz!.setId } })}
              style={[styles.quizCard, { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder }]}
            >
              <Ionicons name="school" size={22} color={palette.indigo} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: palette.indigoDeep }} numberOfLines={1}>
                  📜 {post.attachedQuiz.title}
                </Text>
                <Text style={{ fontSize: 11, color: palette.indigo }}>
                  {post.attachedQuiz.subject} · {post.attachedQuiz.questionCount} câu hỏi · Chạm làm thử ngay!
                </Text>
              </View>
              <Ionicons name="play-circle" size={26} color={palette.indigo} />
            </Pressable>
          ) : null}

          {/* Link Preview */}
          {post.linkPreview ? (
            <Pressable
              onPress={() => void Linking.openURL(post.linkPreview!.url)}
              style={[styles.linkCard, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
            >
              <Ionicons name="link" size={18} color={palette.indigo} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, color: palette.indigo, fontWeight: '800' }}>{post.linkPreview.siteName}</Text>
                <Text style={{ fontSize: 13, color: palette.ink, fontWeight: '800' }} numberOfLines={1}>
                  {post.linkPreview.title}
                </Text>
                {post.linkPreview.description ? (
                  <Text style={{ fontSize: 11.5, color: palette.inkMuted }} numberOfLines={2}>
                    {post.linkPreview.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          {/* Embedded Original Post Card on Quote / Repost (Permission-Aware SharedPostCard!) */}
          {post.repostOfId ? (
            <SharedPostCard postId={post.repostOfId} viewerId={viewerId} />
          ) : null}

          {/* Hashtags & Topic Pills */}
          {(post.hashtags.length > 0 || post.topics.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {Array.from(new Set([...post.topics, ...post.hashtags])).map((tag) => (
                <Text key={tag} style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                  #{tag}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Floating Multi-Emoji Reaction Bar (on click/long-press) */}
      {reactionBarOpen && (
        <View style={[styles.reactionPickerBar, { backgroundColor: palette.paperRaised, borderColor: palette.indigo }]}>
          {EMOJI_REACTION_CATALOG.map((item) => (
            <Pressable
              key={item.type}
              accessibilityLabel={item.label}
              onPress={() => {
                onReactPost(post.id, item.type);
                setReactionBarOpen(false);
              }}
              style={[
                styles.reactionEmojiOption,
                myReaction === item.type && { backgroundColor: palette.indigoTint },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Reaction Summary Strip */}
      {totalReactions > 0 && (
        <Pressable onPress={() => setReactorsModalOpen(true)} style={styles.reactionSummaryRow}>
          <Text style={{ fontSize: 12.5 }}>
            {activeEmojis
              .slice(0, 4)
              .map((a) => a.emoji)
              .join(' ')}
          </Text>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>
            {totalReactions} cảm xúc · {post.viewsCount} lượt xem
          </Text>
        </Pressable>
      )}

      {/* Primary Meta Threads + Facebook Action Bar */}
      <View style={[styles.actionBar, { borderTopColor: palette.paperMuted }]}>
        {/* 1. Like / Multi-Emoji Reaction */}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (myReaction) onReactPost(post.id, myReaction);
            else setReactionBarOpen((o) => !o);
          }}
          onLongPress={() => setReactionBarOpen(true)}
          style={styles.actionBtn}
        >
          {myReactionMeta ? (
            <Text style={{ fontSize: 15 }}>{myReactionMeta.emoji}</Text>
          ) : (
            <Ionicons name="heart-outline" size={18} color={palette.inkMuted} />
          )}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: myReactionMeta ? myReactionMeta.color : palette.inkMuted,
            }}
          >
            {myReactionMeta ? myReactionMeta.label : 'Thích'}
          </Text>
        </Pressable>

        {/* 2. Comment / Threaded Reply */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setCommentsOpen((o) => !o)}
          style={styles.actionBtn}
        >
          <Ionicons name="chatbubble-outline" size={17} color={palette.inkMuted} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.inkMuted }}>
            {post.comments.length}
          </Text>
        </Pressable>

        {/* 3. Repost / Quote Post (Two-Arrows Icon + Bottom Sheet!) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng lại hoặc Trích dẫn"
          onPress={() => setRepostSheetOpen(true)}
          style={styles.actionBtn}
        >
          <Ionicons name="repeat" size={19} color={hasReposted ? palette.mint : palette.inkMuted} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: hasReposted ? palette.mint : palette.inkMuted }}>
            {post.repostedByIds.length + post.quoteCount || ''}
          </Text>
        </Pressable>

        {/* 4. Share to Chat / Community / Link */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chia sẻ bài viết"
          onPress={() => setShareSheetOpen(true)}
          style={styles.actionBtn}
        >
          <Ionicons name="paper-plane-outline" size={17} color={palette.inkMuted} />
        </Pressable>

        {/* 5. Distinct Save Bookmark vs Favourite Star */}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đánh dấu Yêu thích đặc biệt"
            onPress={() => onToggleFavourite(post.id)}
          >
            <Ionicons
              name={isFavourited ? 'star' : 'star-outline'}
              size={18}
              color={isFavourited ? '#F59E0B' : palette.inkMuted}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lưu vào Bộ sưu tập Bookmark"
            onPress={() => onToggleBookmark(post.id)}
          >
            <Ionicons
              name={isSavedBookmark ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSavedBookmark ? palette.indigo : palette.inkMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* Expandable Nested Threaded Comments with Curved Connectors */}
      {commentsOpen && (
        <View style={[styles.commentsWrap, { borderTopColor: palette.paperMuted }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
              Thảo luận ({post.comments.length})
            </Text>
            <Pressable onPress={() => setCommentSort((s) => (s === 'top' ? 'newest' : 'top'))}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                Sắp xếp: {commentSort === 'top' ? 'Hàng đầu' : 'Mới nhất'} ⇅
              </Text>
            </Pressable>
          </View>

          {rootComments.map((rootCmt) => {
            const childReplies = post.comments.filter((c) => c.parentCommentId === rootCmt.id);
            const isCollapsed = collapsedCommentIds.includes(rootCmt.id);
            const cmtReactions = Object.values(rootCmt.reactions).reduce((s, a) => s + (a?.length ?? 0), 0);

            return (
              <View key={rootCmt.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ alignItems: 'center', width: 28 }}>
                    <Pressable onPress={() => navigateToProfile(rootCmt.authorId)}>
                      <View style={[styles.cmtAvatar, { backgroundColor: palette.indigo }]}>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                          {(rootCmt.authorName[0] || 'U').toUpperCase()}
                        </Text>
                      </View>
                    </Pressable>
                    {childReplies.length > 0 && !isCollapsed && (
                      <View style={[styles.cmtSpine, { backgroundColor: palette.paperMuted }]} />
                    )}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={[styles.cmtBubble, { backgroundColor: palette.paper }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Pressable onPress={() => navigateToProfile(rootCmt.authorId)}>
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink }}>
                            {rootCmt.authorName}
                          </Text>
                        </Pressable>
                        {rootCmt.isPinned && <Badge tone="reward">📌 Đã ghim</Badge>}
                        {rootCmt.isEdited && (
                          <Text style={{ fontSize: 10.5, color: palette.inkMuted }}>(đã sửa)</Text>
                        )}
                      </View>

                      {editingCommentId === rootCmt.id ? (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          <TextInput
                            value={editingCommentText}
                            onChangeText={setEditingCommentText}
                            style={[styles.inlineInput, { color: palette.ink, borderColor: palette.indigo }]}
                          />
                          <Pressable
                            onPress={() => {
                              onEditOrDeleteComment(post.id, rootCmt.id, editingCommentText);
                              setEditingCommentId(null);
                            }}
                            style={[styles.sendMiniBtn, { backgroundColor: palette.indigo }]}
                          >
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 13, color: palette.ink, marginTop: 3, lineHeight: 19 }}>
                          {rootCmt.content}
                        </Text>
                      )}

                      {rootCmt.mediaItem ? (
                        <Image
                          source={{ uri: rootCmt.mediaItem.uri }}
                          style={{ width: 96, height: 96, marginTop: 6, borderRadius: 10 }}
                          resizeMode="contain"
                        />
                      ) : null}
                    </View>

                    {/* Comment Action Strip */}
                    <View style={styles.cmtMetaStrip}>
                      <Pressable onPress={() => onReactComment(post.id, rootCmt.id, 'love')}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                          ❤️ Thích{cmtReactions > 0 ? ` (${cmtReactions})` : ''}
                        </Text>
                      </Pressable>
                      {canReply && (
                        <Pressable
                          onPress={() => {
                            setReplyParentId(rootCmt.id);
                            setReplyDraft(`@${rootCmt.authorName} `);
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>Trả lời</Text>
                        </Pressable>
                      )}
                      {isOwnPost && (
                        <Pressable onPress={() => onPinComment(post.id, rootCmt.id)}>
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.gold }}>
                            {rootCmt.isPinned ? 'Bỏ ghim' : 'Ghim'}
                          </Text>
                        </Pressable>
                      )}
                      {rootCmt.authorId === viewerId && (
                        <>
                          <Pressable
                            onPress={() => {
                              setEditingCommentId(rootCmt.id);
                              setEditingCommentText(rootCmt.content);
                            }}
                          >
                            <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>Sửa</Text>
                          </Pressable>
                          <Pressable onPress={() => onEditOrDeleteComment(post.id, rootCmt.id, null)}>
                            <Text style={{ fontSize: 11.5, color: palette.danger }}>Xóa</Text>
                          </Pressable>
                        </>
                      )}
                      {rootCmt.authorId !== viewerId && (
                        <Pressable
                          onPress={() =>
                            onReportTarget('comment', rootCmt.id, rootCmt.content, rootCmt.authorId)
                          }
                        >
                          <Text style={{ fontSize: 11, color: palette.inkMuted }}>Báo cáo</Text>
                        </Pressable>
                      )}
                      {childReplies.length > 0 && (
                        <Pressable
                          onPress={() =>
                            setCollapsedCommentIds((prev) =>
                              prev.includes(rootCmt.id)
                                ? prev.filter((x) => x !== rootCmt.id)
                                : [...prev, rootCmt.id]
                            )
                          }
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                            {isCollapsed ? `Xem ${childReplies.length} phản hồi` : 'Thu gọn'}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Indented Nested Replies with Threads Curved L-Connector (capped depth for 320px safety!) */}
                    {!isCollapsed &&
                      childReplies.map((sub) => (
                        <View key={sub.id} style={styles.nestedReplyRow}>
                          <View style={[styles.lCurveConnector, { borderColor: palette.paperMuted }]} />
                          <View style={[styles.cmtBubble, { flex: 1, backgroundColor: palette.paper }]}>
                            <Pressable onPress={() => navigateToProfile(sub.authorId)}>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                                {sub.authorName}
                              </Text>
                            </Pressable>
                            <Text style={{ fontSize: 12.5, color: palette.ink, marginTop: 2 }}>{sub.content}</Text>
                            {sub.mediaItem ? (
                              <Image
                                source={{ uri: sub.mediaItem.uri }}
                                style={{ width: 76, height: 76, marginTop: 4, borderRadius: 8 }}
                                resizeMode="contain"
                              />
                            ) : null}
                          </View>
                        </View>
                      ))}
                  </View>
                </View>
              </View>
            );
          })}

          {/* Reply Composer OR Reply Permission Gate */}
          {canReply ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {replyParentId && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 11, color: palette.indigo, fontWeight: '700' }}>
                    Đang trả lời bình luận ·
                  </Text>
                  <Pressable onPress={() => setReplyParentId(null)}>
                    <Text style={{ fontSize: 11, color: palette.danger, fontWeight: '800' }}>Hủy</Text>
                  </Pressable>
                </View>
              )}
              {replyMedia && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image source={{ uri: replyMedia.uri }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                  <Pressable onPress={() => setReplyMedia(null)}>
                    <Ionicons name="close-circle" size={18} color={palette.danger} />
                  </Pressable>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pressable
                  accessibilityLabel="Chèn Sticker, GIF hoặc Emoji"
                  onPress={() => setStickerPickerOpen(true)}
                  style={[styles.stickerBtn, { backgroundColor: palette.paper }]}
                >
                  <Ionicons name="happy-outline" size={19} color={palette.indigo} />
                </Pressable>
                <TextInput
                  value={replyDraft}
                  onChangeText={setReplyDraft}
                  placeholder="Viết phản hồi, nhắc tên @Bạn bè hoặc gửi Sticker..."
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.inlineInput,
                    { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                  ]}
                />
                <Pressable
                  disabled={!replyDraft.trim() && !replyMedia}
                  onPress={() => {
                    onAddReply({
                      postId: post.id,
                      parentCommentId: replyParentId,
                      content: replyDraft,
                      mediaItem: replyMedia,
                    });
                    setReplyDraft('');
                    setReplyMedia(null);
                    setReplyParentId(null);
                  }}
                  style={[
                    styles.sendMiniBtn,
                    {
                      backgroundColor: palette.indigo,
                      opacity: replyDraft.trim() || replyMedia ? 1 : 0.4,
                    },
                  ]}
                >
                  <Ionicons name="send" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 11.5, color: palette.inkMuted, fontStyle: 'italic', marginTop: 4 }}>
              🔒 Tác giả đã giới hạn quyền bình luận trên bài viết này ({post.replyPermission}).
            </Text>
          )}
        </View>
      )}

      {/* Ghost Post Direct Reply-to-DM Shortcut */}
      {post.postKind === 'ghost' && !isOwnPost && !post.isAnonymous && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/messages',
              params: { dmUserId: post.authorId, dmName: post.authorName },
            })
          }
          style={[styles.ghostDmBtn, { borderColor: palette.indigoBorder }]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.indigo} />
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
            Phản hồi riêng tư Ghost Post qua Tin nhắn cho {post.authorName}
          </Text>
        </Pressable>
      )}

      {/* 1. REPOST & QUOTE BOTTOM SHEET */}
      {repostSheetOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setRepostSheetOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setRepostSheetOpen(false)}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>Đăng lại hoặc trích dẫn</Text>
              <Pressable
                onPress={() => {
                  onTogglePureRepost(post.id);
                  setRepostSheetOpen(false);
                }}
                style={[styles.sheetActionRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="repeat" size={20} color={hasReposted ? palette.danger : palette.mint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink }}>
                    {hasReposted ? 'Hoàn tác đăng lại' : 'Đăng lại'}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                    Chia sẻ bài viết gốc lên trang cá nhân của bạn
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setRepostSheetOpen(false);
                  onOpenQuoteComposer(post);
                }}
                style={[styles.sheetActionRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="create-outline" size={20} color={palette.indigo} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink }}>
                    Trích dẫn bài viết
                  </Text>
                  <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                    Thêm bình luận cá nhân kèm bài viết gốc
                  </Text>
                </View>
              </Pressable>
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* 2. SHARE TO CHAT / COMMUNITY / DEEP LINK MODAL */}
      {shareSheetOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShareSheetOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[typography.title, { color: palette.ink }]}>Chia sẻ bài viết</Text>
                <Pressable onPress={() => setShareSheetOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <TextInput
                value={shareNote}
                onChangeText={setShareNote}
                placeholder="Lời nhắn đính kèm..."
                placeholderTextColor={palette.inkMuted}
                style={[styles.inlineInput, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
              />

              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                Gửi qua tin nhắn:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {conversations.map((conv) => (
                  <Pressable
                    key={conv.id}
                    onPress={() => {
                      onShareToTarget(post, { type: 'conversation', conversationId: conv.id }, shareNote);
                      setShareNote('');
                      setShareSheetOpen(false);
                      router.push({ pathname: '/messages', params: { conversationId: conv.id } });
                    }}
                    style={[styles.destPill, { borderColor: palette.indigo, backgroundColor: palette.indigoTint }]}
                  >
                    <Ionicons name="chatbubbles" size={14} color={palette.indigo} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }} numberOfLines={1}>
                      {conv.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                Chia sẻ vào nhóm:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {communities.map((cm) => (
                  <Pressable
                    key={cm.id}
                    onPress={() => {
                      onShareToTarget(post, { type: 'community', communityId: cm.id }, shareNote);
                      setShareNote('');
                      setShareSheetOpen(false);
                    }}
                    style={[styles.destPill, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
                  >
                    <Ionicons name="people" size={14} color={palette.ink} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }} numberOfLines={1}>
                      {cm.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                Lưu vào thư mục:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {collections.map((col) => (
                  <Pressable
                    key={col.id}
                    onPress={() => {
                      onToggleBookmark(post.id, col.id);
                      setShareSheetOpen(false);
                    }}
                    style={[styles.destPill, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {col.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Button
                variant="secondary"
                icon="link-outline"
                onPress={() => {
                  void copyPostDeepLink();
                  setShareSheetOpen(false);
                }}
              >
                Sao chép liên kết bài viết
              </Button>
            </Card>
          </View>
        </Modal>
      )}

      {/* 3. MORE OPTIONS MENU */}
      {moreMenuOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMoreMenuOpen(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setMoreMenuOpen(false)}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>Tùy chọn bài viết</Text>

              <Pressable
                onPress={() => {
                  onAlgoFeedback('more', post);
                  setMoreMenuOpen(false);
                }}
                style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="trending-up" size={18} color={palette.mint} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                  Ưu tiên nội dung tương tự
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onAlgoFeedback('less', post);
                  setMoreMenuOpen(false);
                }}
                style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="trending-down" size={18} color={palette.gold} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                  Giảm hiển thị nội dung này
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onAlgoFeedback('not_interested', post);
                  setMoreMenuOpen(false);
                }}
                style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="eye-off-outline" size={18} color={palette.inkMuted} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                  Không quan tâm bài viết này
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMoreMenuOpen(false);
                  setInsightsOpen(true);
                }}
                style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
              >
                <Ionicons name="analytics-outline" size={18} color={palette.indigo} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                  Số liệu bài viết
                </Text>
              </Pressable>

              {post.editHistory.length > 0 && (
                <Pressable
                  onPress={() => {
                    setMoreMenuOpen(false);
                    setHistoryOpen(true);
                  }}
                  style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
                >
                  <Ionicons name="time-outline" size={18} color={palette.indigo} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                    Lịch sử chỉnh sửa ({post.editHistory.length})
                  </Text>
                </Pressable>
              )}

              {isOwnPost ? (
                <>
                  <Pressable
                    onPress={() => {
                      onTogglePin(post.id, 'profile');
                      setMoreMenuOpen(false);
                    }}
                    style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
                  >
                    <Ionicons name="pin-outline" size={18} color={palette.gold} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                      {post.isPinnedProfile ? 'Bỏ ghim khỏi trang cá nhân' : 'Ghim lên đầu trang cá nhân'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMoreMenuOpen(false);
                      setEditDraftText(post.threadParts.join('\n\n'));
                      setEditingOpen(true);
                    }}
                    style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
                  >
                    <Ionicons name="create-outline" size={18} color={palette.indigo} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>Chỉnh sửa bài viết</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onDeleteOrArchive(post.id, 'archive');
                      setMoreMenuOpen(false);
                    }}
                    style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
                  >
                    <Ionicons name="archive-outline" size={18} color={palette.inkMuted} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>Lưu trữ bài viết</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      onDeleteOrArchive(post.id, 'delete');
                      setMoreMenuOpen(false);
                    }}
                    style={[styles.menuItemRow, { borderColor: palette.danger }]}
                  >
                    <Ionicons name="trash-outline" size={18} color={palette.danger} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: palette.danger }}>Xóa bài viết</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {!post.isAnonymous && (
                    <>
                      <Pressable
                        onPress={() => {
                          onBlockOrMuteAuthor(post.authorId, 'mute');
                          setMoreMenuOpen(false);
                        }}
                        style={[styles.menuItemRow, { borderColor: palette.paperMuted }]}
                      >
                        <Ionicons name="volume-mute-outline" size={18} color={palette.inkMuted} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                          Tạm ẩn bài từ {post.authorName}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          onBlockOrMuteAuthor(post.authorId, 'block');
                          setMoreMenuOpen(false);
                        }}
                        style={[styles.menuItemRow, { borderColor: palette.danger }]}
                      >
                        <Ionicons name="ban-outline" size={18} color={palette.danger} />
                        <Text style={{ fontSize: 13, fontWeight: '800', color: palette.danger }}>
                          Chặn {post.authorName}
                        </Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    onPress={() => {
                      setMoreMenuOpen(false);
                      onReportTarget(
                        'post',
                        post.id,
                        post.threadParts[0] || '',
                        post.internalAuthorId || post.authorId
                      );
                    }}
                    style={[styles.menuItemRow, { borderColor: palette.danger }]}
                  >
                    <Ionicons name="flag-outline" size={18} color={palette.danger} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: palette.danger }}>
                      Báo cáo bài viết
                    </Text>
                  </Pressable>
                </>
              )}
            </Card>
          </Pressable>
        </Modal>
      )}

      {/* 4. POST INSIGHTS ANALYTICS MODAL (Section 12.1) */}
      {insightsOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setInsightsOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>📈 Phân tích Hiệu quả Bài viết (Post Insights)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'Lượt hiển thị (Impressions)', val: post.impressionsCount },
                  { label: 'Tiếp cận duy nhất (Reach)', val: Math.max(1, Math.round(post.impressionsCount * 0.78)) },
                  { label: 'Lượt xem chi tiết', val: post.viewsCount },
                  { label: 'Tỷ lệ tương tác', val: `${engagementRate}%` },
                  { label: 'Cảm xúc & Bình luận', val: totalReactions + post.comments.length },
                  { label: 'Đăng lại & Chia sẻ', val: post.repostedByIds.length + post.quoteCount + post.sharesCount },
                ].map((m) => (
                  <View key={m.label} style={[styles.metricBox, { backgroundColor: palette.paperRaised }]}>
                    <Text style={{ fontSize: 17, fontWeight: '900', color: palette.indigo }}>{m.val}</Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>{m.label}</Text>
                  </View>
                ))}
              </View>
              <Button variant="secondary" onPress={() => setInsightsOpen(false)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      )}

      {/* 5. EDIT POST MODAL & EDIT HISTORY MODAL */}
      {editingOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>✏️ Chỉnh sửa bài viết</Text>
              <TextInput
                value={editDraftText}
                onChangeText={setEditDraftText}
                multiline
                style={[styles.editArea, { color: palette.ink, borderColor: palette.indigo, backgroundColor: palette.paperRaised }]}
              />
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setEditingOpen(false)}>
                  Hủy
                </Button>
                <Button
                  onPress={() => {
                    const parts = editDraftText
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean);
                    if (parts.length > 0) {
                      onEditPost(post.id, parts);
                      setEditingOpen(false);
                    }
                  }}
                >
                  Lưu thay đổi
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      )}

      {historyOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>🕒 Lịch sử chỉnh sửa bài viết</Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {post.editHistory.map((ver) => (
                  <View key={ver.id} style={[styles.verRow, { borderColor: palette.paperMuted }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>
                      Phiên bản trước lúc {new Date(ver.editedAt).toLocaleString('vi-VN')}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: palette.ink, marginTop: 4 }}>
                      {ver.previousParts.join('\n\n')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Button variant="secondary" onPress={() => setHistoryOpen(false)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      )}

      {/* 6. REACTION BREAKDOWN LIST WITH PROFILE LINKS */}
      {reactorsModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setReactorsModalOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>❤️ Danh sách tương tác cảm xúc</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {EMOJI_REACTION_CATALOG.map((meta) => {
                  const ids = post.reactions[meta.type] ?? [];
                  if (ids.length === 0) return null;
                  return ids.map((uid) => {
                    const prof = profilesById[uid];
                    const name = prof?.displayName || (uid === viewerId ? viewerName : 'Thành viên Papyrus');
                    return (
                      <Pressable
                        key={`${meta.type}-${uid}`}
                        onPress={() => {
                          setReactorsModalOpen(false);
                          navigateToProfile(uid);
                        }}
                        style={styles.reactorUserRow}
                      >
                        <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink, flex: 1 }}>{name}</Text>
                        <Ionicons name="chevron-forward" size={16} color={palette.inkMuted} />
                      </Pressable>
                    );
                  });
                })}
              </ScrollView>
              <Button variant="secondary" onPress={() => setReactorsModalOpen(false)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      )}

      {/* 7. FULLSCREEN MEDIA LIGHTBOX */}
      {lightboxMedia && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxMedia(null)}>
          <View style={styles.lightboxBackdrop}>
            <Pressable onPress={() => setLightboxMedia(null)} style={styles.lightboxClose}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
            <Image source={{ uri: lightboxMedia.uri }} style={{ width: '94%', height: '82%' }} resizeMode="contain" />
          </View>
        </Modal>
      )}

      <GifStickerEmojiPickerModal
        visible={stickerPickerOpen}
        onClose={() => setStickerPickerOpen(false)}
        onSelectEmoji={(em) => setReplyDraft((d) => `${d}${em}`)}
        onSelectMedia={(media) => setReplyMedia(media)}
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, padding: spacing.md },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  contextPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  followPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  moreIconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  spoilerCoverBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 6,
  },
  threadPartRow: { flexDirection: 'row', gap: 10 },
  threadRailCol: { width: 22, alignItems: 'center' },
  threadNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadSpine: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  longFormBox: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  aiSummarizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  aiSummaryCard: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  carouselSlide: {
    height: 210,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2,6,23,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(79,70,229,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(2,6,23,0.78)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 6 },
  dot: { height: 7, borderRadius: 4 },
  codeBox: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  codeText: { color: '#E2E8F0', fontSize: 12, fontFamily: 'monospace' },
  debateBox: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  debateVoteBtn: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  debateArgItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 6,
    paddingRight: 8,
    borderRadius: 6,
  },
  sideToggle: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: radii.sm, borderWidth: 1 },
  quizCard: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkCard: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reactionPickerBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  reactionEmojiOption: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  actionBar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  commentsWrap: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  cmtAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cmtSpine: { width: 2, flex: 1, marginTop: 4 },
  cmtBubble: { padding: 8, borderRadius: radii.sm },
  cmtMetaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    paddingLeft: 4,
  },
  nestedReplyRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, paddingLeft: 4 },
  lCurveConnector: {
    width: 14,
    height: 18,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: 10,
    marginRight: 6,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  stickerBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendMiniBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ghostDmBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheetCard: { width: '100%', maxWidth: 460, gap: 10 },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  destPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    maxWidth: 210,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  metricBox: { width: '47%', padding: 10, borderRadius: radii.sm, gap: 2 },
  editArea: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 13.5,
    textAlignVertical: 'top',
  },
  verRow: { paddingVertical: 8, borderBottomWidth: 1 },
  reactorUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxClose: { position: 'absolute', top: 44, right: 20, zIndex: 10, padding: 8 },
});
