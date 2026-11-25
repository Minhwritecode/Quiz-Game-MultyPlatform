import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { QuestionSet } from '@/core/domain/models';
import { pickMultipleMediaImages, pickVideoWithAutoCover } from '@/composition/social';
import type {
  PostAudience,
  PostKind,
  ReplyPermission,
  SocialCommunityGroup,
  SocialMediaItem,
  SocialPostItem,
  SocialUserProfile,
  UnifiedPoll,
} from '../domain/models';
import type { ComposerDraftPayload } from '../state/useSocialStore';
import { GifStickerEmojiPickerModal } from './GifStickerEmojiPickerModal';
import { VideoCoverEditorModal } from './VideoCoverEditorModal';
import { SharedPostCard } from './SharedPostCard';

const LOCATION_OPTIONS = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Huế', 'Quốc tế'];

/**
 * Advanced Meta Threads + Facebook Post Composer (Section 5.1–5.6):
 * Supports connected Thread parts (add/delete/reorder), Auto-saved Drafts,
 * Multi-Image Carousel + Upload Progress, Video + Video Cover Frame Editor,
 * GIF/Sticker/Emoji Library, Unified Zalo Poll, Long-form, Ghost 24h, Anonymous,
 * Spoiler, Debate Mode, Scheduled Post, @Mention Friend, Consented Location,
 * Audience Control, and Reply Permission!
 */
export function AdvancedThreadComposerModal({
  visible,
  viewerId,
  viewerName,
  savedDraft,
  quotedPost,
  communities,
  knownUsers,
  questionSets,
  onSaveDraft,
  onClose,
  onPublish,
}: {
  visible: boolean;
  viewerId: string;
  viewerName: string;
  savedDraft: ComposerDraftPayload | null;
  quotedPost?: SocialPostItem | null;
  communities: SocialCommunityGroup[];
  knownUsers: SocialUserProfile[];
  questionSets: QuestionSet[];
  onSaveDraft: (draft: ComposerDraftPayload | null) => void;
  onClose: () => void;
  onPublish: (payload: {
    postKind: PostKind;
    threadParts: string[];
    longFormBody?: string;
    mediaItems: SocialMediaItem[];
    poll?: UnifiedPoll | null;
    attachedQuiz?: SocialPostItem['attachedQuiz'];
    codeSnippet?: string;
    debate?: SocialPostItem['debate'];
    repostOfId?: string | null;
    isQuote?: boolean;
    isSpoiler: boolean;
    spoilerWarning: string;
    isAnonymous: boolean;
    audience: PostAudience;
    replyPermission: ReplyPermission;
    communityId: string | null;
    topics: string[];
    hashtags: string[];
    mentionedUserIds: string[];
    locationLabel: string | null;
    scheduledFor: string | null;
  }) => void;
}) {
  if (!visible) return null;
  const modalKey = `${viewerId}-${quotedPost?.id ?? 'new'}`;
  return (
    <ComposerInner
      key={modalKey}
      viewerId={viewerId}
      viewerName={viewerName}
      savedDraft={quotedPost ? null : savedDraft}
      quotedPost={quotedPost}
      communities={communities}
      knownUsers={knownUsers}
      questionSets={questionSets}
      onSaveDraft={onSaveDraft}
      onClose={onClose}
      onPublish={onPublish}
    />
  );
}

function ComposerInner({
  viewerId,
  savedDraft,
  quotedPost,
  communities,
  knownUsers,
  questionSets,
  onSaveDraft,
  onClose,
  onPublish,
}: {
  viewerId: string;
  viewerName: string;
  savedDraft: ComposerDraftPayload | null;
  quotedPost?: SocialPostItem | null;
  communities: SocialCommunityGroup[];
  knownUsers: SocialUserProfile[];
  questionSets: QuestionSet[];
  onSaveDraft: (draft: ComposerDraftPayload | null) => void;
  onClose: () => void;
  onPublish: Parameters<typeof AdvancedThreadComposerModal>[0]['onPublish'];
}) {
  const palette = usePalette();

  const [postKind, setPostKind] = useState<PostKind>(savedDraft?.postKind ?? 'thread');
  const [threadParts, setThreadParts] = useState<string[]>(
    savedDraft?.threadParts?.length ? savedDraft.threadParts : ['']
  );
  const [longFormBody, setLongFormBody] = useState(savedDraft?.longFormBody ?? '');
  const [showLongForm, setShowLongForm] = useState(Boolean(savedDraft?.longFormBody));
  const [mediaItems, setMediaItems] = useState<SocialMediaItem[]>(savedDraft?.mediaItems ?? []);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [topicsText, setTopicsText] = useState(savedDraft?.topicsText ?? 'CNTT, ChiaSẻKiếnThức');
  const [audience, setAudience] = useState<PostAudience>(savedDraft?.audience ?? 'public');
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>(
    savedDraft?.replyPermission ?? 'everyone'
  );
  const [communityId, setCommunityId] = useState<string | null>(savedDraft?.communityId ?? null);

  const [isSpoiler, setIsSpoiler] = useState(Boolean(savedDraft?.isSpoiler));
  const [spoilerWarning, setSpoilerWarning] = useState(savedDraft?.spoilerWarning ?? '');
  const [isAnonymous, setIsAnonymous] = useState(Boolean(savedDraft?.isAnonymous));
  const [locationLabel, setLocationLabel] = useState(savedDraft?.locationLabel ?? '');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [showSchedule, setShowSchedule] = useState(Boolean(savedDraft?.scheduledFor));
  const [scheduleMinutesFromNow, setScheduleMinutesFromNow] = useState('30');

  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  const [pollAnon, setPollAnon] = useState(false);
  const [pollAllowAdd, setPollAllowAdd] = useState(true);

  const [debateSideA, setDebateSideA] = useState(savedDraft?.debateSideA ?? 'Quan điểm A');
  const [debateSideB, setDebateSideB] = useState(savedDraft?.debateSideB ?? 'Quan điểm B');

  const [attachedSetId, setAttachedSetId] = useState(savedDraft?.attachedSetId ?? '');
  const [showQuizPicker, setShowQuizPicker] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState(savedDraft?.codeSnippet ?? '');
  const [showCode, setShowCode] = useState(Boolean(savedDraft?.codeSnippet));
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);

  const [stickerOpen, setStickerOpen] = useState(false);
  const [editingVideoCoverItem, setEditingVideoCoverItem] = useState<SocialMediaItem | null>(null);

  // Auto-save draft whenever content changes so closing keyboard, losing network, or navigating never loses work!
  useEffect(() => {
    if (quotedPost) return;
    const hasContent =
      threadParts.some((p) => p.trim().length > 0) ||
      longFormBody.trim().length > 0 ||
      mediaItems.length > 0;
    const timer = setTimeout(() => {
      if (!hasContent) return;
      onSaveDraft({
        postKind,
        threadParts,
        longFormBody,
        mediaItems,
        topicsText,
        audience,
        replyPermission,
        communityId,
        isSpoiler,
        spoilerWarning,
        isAnonymous,
        locationLabel,
        scheduledFor: '',
        attachedSetId,
        codeSnippet,
        debateSideA,
        debateSideB,
        updatedAt: new Date().toISOString(),
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    attachedSetId,
    audience,
    codeSnippet,
    communityId,
    debateSideA,
    debateSideB,
    isAnonymous,
    isSpoiler,
    locationLabel,
    longFormBody,
    mediaItems,
    onSaveDraft,
    postKind,
    quotedPost,
    replyPermission,
    spoilerWarning,
    threadParts,
    topicsText,
  ]);

  const totalChars = threadParts.reduce((s, p) => s + p.length, 0) + longFormBody.length;
  const validToSubmit = threadParts.some((p) => p.trim().length > 0) || mediaItems.length > 0;

  const movePart = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= threadParts.length) return;
    setThreadParts((prev) => {
      const copy = [...prev];
      const tmp = copy[index]!;
      copy[index] = copy[target]!;
      copy[target] = tmp;
      return copy;
    });
  };

  const handlePickPhotos = async () => {
    setUploadProgress(10);
    try {
      const imgs = await pickMultipleMediaImages(6, (pct) => setUploadProgress(pct));
      if (imgs.length > 0) {
        setMediaItems((prev) => [...prev, ...imgs].slice(0, 8));
      }
    } finally {
      setTimeout(() => setUploadProgress(null), 400);
    }
  };

  const handlePickVideo = async () => {
    setUploadProgress(25);
    try {
      const vid = await pickVideoWithAutoCover('16:9');
      if (vid) {
        setMediaItems((prev) => [...prev, vid]);
        setEditingVideoCoverItem(vid);
      }
    } finally {
      setUploadProgress(null);
    }
  };

  const handlePublishClick = () => {
    const cleanedParts = threadParts.map((p) => p.trim()).filter(Boolean);
    if (cleanedParts.length === 0 && mediaItems.length > 0) {
      cleanedParts.push('Chia sẻ khoảnh khắc mới ✨');
    }
    if (cleanedParts.length === 0) return;

    const tags = topicsText
      .split(/[,#\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    const validPollOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    const poll: UnifiedPoll | null =
      showPoll && pollQuestion.trim() && validPollOpts.length >= 2
        ? {
            id: `upoll-${Date.now()}`,
            scopeType: communityId ? 'community' : 'post',
            question: pollQuestion.trim(),
            options: validPollOpts.map((txt, idx) => ({
              id: `popt-${idx}-${Date.now()}`,
              text: txt,
              voterIds: [],
            })),
            allowMultiple: pollMulti,
            isAnonymous: pollAnon,
            allowAddOptions: pollAllowAdd,
            allowChangeVote: true,
            isClosed: false,
            createdBy: viewerId,
            createdAt: new Date().toISOString(),
          }
        : null;

    const chosenSet = attachedSetId ? questionSets.find((s) => s.id === attachedSetId) : undefined;
    const scheduledFor =
      showSchedule && Number(scheduleMinutesFromNow) > 0
        ? new Date(Date.now() + Number(scheduleMinutesFromNow) * 60_000).toISOString()
        : null;

    onPublish({
      postKind: isAnonymous ? 'anonymous' : postKind,
      threadParts: cleanedParts,
      longFormBody: showLongForm && longFormBody.trim() ? longFormBody.trim() : undefined,
      mediaItems,
      poll,
      attachedQuiz: chosenSet
        ? {
            setId: chosenSet.id,
            title: chosenSet.title,
            questionCount: chosenSet.questions.length,
            subject: chosenSet.subject,
          }
        : null,
      codeSnippet: showCode && codeSnippet.trim() ? codeSnippet.trim() : undefined,
      debate:
        postKind === 'debate'
          ? {
              sideALabel: debateSideA.trim() || 'Phe A',
              sideBLabel: debateSideB.trim() || 'Phe B',
              sideAVoterIds: [],
              sideBVoterIds: [],
              arguments: [],
            }
          : undefined,
      repostOfId: quotedPost?.id ?? null,
      isQuote: Boolean(quotedPost),
      isSpoiler,
      spoilerWarning: spoilerWarning.trim(),
      isAnonymous,
      audience: communityId ? 'community' : audience,
      replyPermission,
      communityId,
      topics: tags,
      hashtags: tags,
      mentionedUserIds: mentionedIds,
      locationLabel: locationLabel.trim() || null,
      scheduledFor,
    });

    if (!quotedPost) {
      onSaveDraft(null);
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          <View style={styles.topHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.title, { color: palette.ink }]}>
                {quotedPost ? '🔁 Trích dẫn Bài viết (Quote Post)' : '🧵 Trình soạn Bài viết & Chuỗi Threads'}
              </Text>
              <Text style={{ fontSize: 11, color: palette.mint, fontWeight: '700' }}>
                ✓ Tự động lưu nháp thời gian thực · {totalChars}/4.000 ký tự
              </Text>
            </View>
            {savedDraft && !quotedPost && (
              <Pressable
                onPress={() => {
                  onSaveDraft(null);
                  setThreadParts(['']);
                  setMediaItems([]);
                  setLongFormBody('');
                }}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.danger }}>Xóa nháp</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={23} color={palette.inkMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {/* Post Kind Modes: Thread / Ghost 24h / Anonymous / Debate */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(
                [
                  { id: 'thread', label: '🧵 Chuỗi Thread' },
                  { id: 'ghost', label: '👻 Ghost Post (24h)' },
                  { id: 'debate', label: '⚖️ Tranh biện (Debate)' },
                  { id: 'article', label: '📰 Bài viết chuyên sâu' },
                ] as const
              ).map((k) => {
                const active = postKind === k.id;
                return (
                  <Pressable
                    key={k.id}
                    onPress={() => {
                      setPostKind(k.id);
                      if (k.id === 'article') setShowLongForm(true);
                    }}
                    style={[
                      styles.modeChip,
                      {
                        backgroundColor: active ? palette.indigo : palette.paperRaised,
                        borderColor: active ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: active ? '#FFF' : palette.ink }}>
                      {k.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Audience, Reply Permission & Optional Target Community */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(['public', 'followers', 'friends', 'close_friends', 'only_me'] as const).map((aud) => (
                <Pressable
                  key={aud}
                  onPress={() => {
                    setCommunityId(null);
                    setAudience(aud);
                  }}
                  style={[
                    styles.miniChip,
                    {
                      borderColor: !communityId && audience === aud ? palette.indigo : palette.paperMuted,
                      backgroundColor: !communityId && audience === aud ? palette.indigoTint : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }}>
                    {aud === 'public'
                      ? '🌐 Công khai'
                      : aud === 'followers'
                      ? '👤 Followers'
                      : aud === 'friends'
                      ? '👥 Bạn bè'
                      : aud === 'close_friends'
                      ? '⭐ Bạn thân'
                      : '🔒 Chỉ mình tôi'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Optional Target Community Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Pressable
                onPress={() => setCommunityId(null)}
                style={[
                  styles.miniChip,
                  { borderColor: !communityId ? palette.indigo : palette.paperMuted },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }}>Đăng trên Bảng tin cá nhân</Text>
              </Pressable>
              {communities.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCommunityId(c.id)}
                  style={[
                    styles.miniChip,
                    {
                      borderColor: communityId === c.id ? palette.indigo : palette.paperMuted,
                      backgroundColor: communityId === c.id ? palette.indigoTint : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }}>
                    {c.avatarEmoji} {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Connected Thread Parts with Reorder ↑ / ↓ & Delete */}
            {threadParts.map((val, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 24, alignItems: 'center', paddingTop: 8 }}>
                  <View style={[styles.stepNode, { backgroundColor: palette.indigo }]}>
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
                      setThreadParts((prev) => prev.map((p, i) => (i === idx ? txt : p)))
                    }
                    multiline
                    placeholder={
                      idx === 0
                        ? 'Bạn đang suy nghĩ hoặc muốn chia sẻ điều gì hôm nay?'
                        : `Phần tiếp theo trong chuỗi Thread #${idx + 1}...`
                    }
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.partInput,
                      { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
                    ]}
                  />
                </View>

                {threadParts.length > 1 && (
                  <View style={{ gap: 4, paddingTop: 4 }}>
                    <Pressable disabled={idx === 0} onPress={() => movePart(idx, -1)}>
                      <Ionicons name="chevron-up" size={18} color={idx === 0 ? palette.paperMuted : palette.ink} />
                    </Pressable>
                    <Pressable disabled={idx === threadParts.length - 1} onPress={() => movePart(idx, 1)}>
                      <Ionicons
                        name="chevron-down"
                        size={18}
                        color={idx === threadParts.length - 1 ? palette.paperMuted : palette.ink}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setThreadParts((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="trash-outline" size={17} color={palette.danger} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}

            <Pressable
              onPress={() => setThreadParts((prev) => [...prev, ''])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="add-circle" size={18} color={palette.indigo} />
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.indigo }}>
                + Nối thêm bài vào chuỗi Thread
              </Text>
            </Pressable>

            {/* Debate Mode Side Labels */}
            {postKind === 'debate' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={debateSideA}
                  onChangeText={setDebateSideA}
                  placeholder="Tên Phe A..."
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.halfInput, { color: palette.ink, borderColor: '#3B82F6' }]}
                />
                <TextInput
                  value={debateSideB}
                  onChangeText={setDebateSideB}
                  placeholder="Tên Phe B..."
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.halfInput, { color: palette.ink, borderColor: '#EC4899' }]}
                />
              </View>
            )}

            {/* Long-Form Rich Content Editor */}
            {showLongForm && (
              <TextInput
                value={longFormBody}
                onChangeText={setLongFormBody}
                multiline
                placeholder="Nội dung bài viết dài (Long-form) — Hỗ trợ PapyAI tự động tóm tắt cho người đọc..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.longInput,
                  { color: palette.ink, borderColor: palette.indigoBorder, backgroundColor: palette.paperRaised },
                ]}
              />
            )}

            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: palette.indigo }}>
                  Đang tối ưu & tải phương tiện: {uploadProgress}%
                </Text>
                <View style={{ height: 6, borderRadius: 4, backgroundColor: palette.paperMuted, overflow: 'hidden' }}>
                  <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: palette.indigo }} />
                </View>
              </View>
            )}

            {/* Attached Media Preview Strip (with Video Cover Editor button!) */}
            {mediaItems.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {mediaItems.map((m) => (
                  <View key={m.id} style={styles.mediaThumbCard}>
                    <Image source={{ uri: m.thumbnailUri || m.uri }} style={styles.mediaThumbImg} resizeMode="cover" />
                    {m.kind === 'video' && (
                      <Pressable
                        onPress={() => setEditingVideoCoverItem(m)}
                        style={styles.editCoverBadge}
                      >
                        <Ionicons name="film-outline" size={12} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>Chọn bìa</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => setMediaItems((prev) => prev.filter((x) => x.id !== m.id))}
                      style={styles.removeMediaBtn}
                    >
                      <Ionicons name="close" size={13} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Embedded Quoted Post Preview */}
            {quotedPost && <SharedPostCard postId={quotedPost.id} viewerId={viewerId} />}

            {/* Unified Zalo Poll Builder */}
            {showPoll && (
              <View style={[styles.subPanel, { borderColor: palette.indigoBorder, backgroundColor: palette.paperRaised }]}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.indigo }}>
                  📊 Tạo Bình chọn Thống nhất (Zalo Poll)
                </Text>
                <TextInput
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  placeholder="Câu hỏi bình chọn..."
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.singleInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                />
                {pollOptions.map((opt, idx) => (
                  <TextInput
                    key={idx}
                    value={opt}
                    onChangeText={(txt) =>
                      setPollOptions((prev) => prev.map((o, i) => (i === idx ? txt : o)))
                    }
                    placeholder={`Phương án ${idx + 1}`}
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.singleInput, { color: palette.ink, borderColor: palette.paperMuted }]}
                  />
                ))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable onPress={() => setPollOptions((p) => [...p, ''])}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>+ Thêm lựa chọn</Text>
                  </Pressable>
                  <Pressable onPress={() => setPollMulti((v) => !v)}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: pollMulti ? palette.mint : palette.inkMuted }}>
                      {pollMulti ? '✓ Chọn nhiều' : '○ Chọn nhiều'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setPollAnon((v) => !v)}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: pollAnon ? palette.mint : palette.inkMuted }}>
                      {pollAnon ? '✓ Bỏ phiếu ẩn danh' : '○ Ẩn danh'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setPollAllowAdd((v) => !v)}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: pollAllowAdd ? palette.mint : palette.inkMuted }}>
                      {pollAllowAdd ? '✓ Cho phép thêm mục' : '○ Khóa mục'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Spoiler Warning Input */}
            {isSpoiler && (
              <TextInput
                value={spoilerWarning}
                onChangeText={setSpoilerWarning}
                placeholder="Nhập nhãn cảnh báo Spoiler (vd: Lời giải đề thi / Cốt truyện)..."
                placeholderTextColor={palette.inkMuted}
                style={[styles.singleInput, { color: palette.ink, borderColor: palette.gold }]}
              />
            )}

            {/* Scheduled Post Time Input */}
            {showSchedule && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar-outline" size={16} color={palette.indigo} />
                <Text style={{ fontSize: 12, color: palette.ink }}>Hẹn giờ tự động đăng sau (phút):</Text>
                <TextInput
                  value={scheduleMinutesFromNow}
                  onChangeText={setScheduleMinutesFromNow}
                  keyboardType="numeric"
                  style={[styles.smallNumInput, { color: palette.ink, borderColor: palette.indigo }]}
                />
              </View>
            )}

            {/* Consented Approximate Location Selector */}
            {showLocationPicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {LOCATION_OPTIONS.map((loc) => (
                  <Pressable
                    key={loc}
                    onPress={() => {
                      setLocationLabel(locationLabel === loc ? '' : loc);
                      setShowLocationPicker(false);
                    }}
                    style={[
                      styles.miniChip,
                      { borderColor: locationLabel === loc ? palette.indigo : palette.paperMuted },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, color: palette.ink }}>📍 {loc}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* @Mention Friend Picker */}
            {showMentionPicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {knownUsers
                  .filter((u) => u.id !== viewerId)
                  .slice(0, 12)
                  .map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => {
                        setMentionedIds((prev) => Array.from(new Set([...prev, u.id])));
                        setThreadParts((prev) => {
                          const copy = [...prev];
                          copy[0] = `${copy[0] || ''} @${u.displayName} `.trimStart();
                          return copy;
                        });
                        setShowMentionPicker(false);
                      }}
                      style={[styles.miniChip, { borderColor: palette.indigo }]}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                        @{u.displayName}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            )}

            {/* Code Block */}
            {showCode && (
              <TextInput
                value={codeSnippet}
                onChangeText={setCodeSnippet}
                multiline
                placeholder="Dán đoạn code minh họa..."
                placeholderTextColor="#94A3B8"
                style={styles.codeArea}
              />
            )}

            {/* Quiz Attachment Picker */}
            {showQuizPicker && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {questionSets.slice(0, 12).map((qs) => (
                  <Pressable
                    key={qs.id}
                    onPress={() => {
                      setAttachedSetId(attachedSetId === qs.id ? '' : qs.id);
                      setShowQuizPicker(false);
                    }}
                    style={[
                      styles.miniChip,
                      { borderColor: attachedSetId === qs.id ? palette.indigo : palette.paperMuted },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, color: palette.ink }} numberOfLines={1}>
                      📜 {qs.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Rich Attachment & Safety Toolbar */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pressable onPress={() => void handlePickPhotos()} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="images-outline" size={15} color="#10B981" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Ảnh Carousel</Text>
              </Pressable>

              <Pressable onPress={() => void handlePickVideo()} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="videocam-outline" size={15} color="#EC4899" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Video + Bìa</Text>
              </Pressable>

              <Pressable onPress={() => setStickerOpen(true)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="happy-outline" size={15} color="#F59E0B" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>GIF & Sticker</Text>
              </Pressable>

              <Pressable onPress={() => setShowPoll((v) => !v)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="stats-chart-outline" size={15} color="#6366F1" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Poll Zalo</Text>
              </Pressable>

              <Pressable onPress={() => setShowQuizPicker((v) => !v)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="school-outline" size={15} color="#8B5CF6" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Đính kèm Quiz</Text>
              </Pressable>

              <Pressable onPress={() => setShowCode((v) => !v)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="code-slash-outline" size={15} color="#06B6D4" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Code</Text>
              </Pressable>

              <Pressable onPress={() => setShowMentionPicker((v) => !v)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="at-outline" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Nhắc bạn</Text>
              </Pressable>

              <Pressable onPress={() => setShowLocationPicker((v) => !v)} style={[styles.toolChip, { borderColor: palette.paperMuted }]}>
                <Ionicons name="location-outline" size={15} color="#EF4444" />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                  {locationLabel || 'Vị trí'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setIsSpoiler((v) => !v)}
                style={[
                  styles.toolChip,
                  { borderColor: isSpoiler ? palette.gold : palette.paperMuted },
                ]}
              >
                <Ionicons name="eye-off-outline" size={15} color={palette.gold} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Spoiler</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsAnonymous((v) => !v)}
                style={[
                  styles.toolChip,
                  { borderColor: isAnonymous ? palette.indigo : palette.paperMuted },
                ]}
              >
                <Ionicons name="glasses-outline" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                  {isAnonymous ? '✓ Ẩn danh' : 'Ẩn danh'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowSchedule((v) => !v)}
                style={[
                  styles.toolChip,
                  { borderColor: showSchedule ? palette.indigo : palette.paperMuted },
                ]}
              >
                <Ionicons name="time-outline" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>Hẹn giờ</Text>
              </Pressable>
            </View>

            {/* Topic Tags & Reply Permission */}
            <TextInput
              value={topicsText}
              onChangeText={setTopicsText}
              placeholder="Chủ đề & Hashtag (vd: CNTT, AI, ÔnThi)..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.singleInput, { color: palette.ink, borderColor: palette.paperMuted }]}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>Ai có thể trả lời:</Text>
              {(['everyone', 'followers', 'friends', 'mentioned', 'nobody'] as const).map((rp) => (
                <Pressable
                  key={rp}
                  onPress={() => setReplyPermission(rp)}
                  style={[
                    styles.miniChip,
                    {
                      borderColor: replyPermission === rp ? palette.indigo : palette.paperMuted,
                      backgroundColor: replyPermission === rp ? palette.indigoTint : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }}>
                    {rp === 'everyone'
                      ? 'Mọi người'
                      : rp === 'followers'
                      ? 'Followers'
                      : rp === 'friends'
                      ? 'Bạn bè'
                      : rp === 'mentioned'
                      ? 'Người được nhắc'
                      : 'Không ai'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Button icon="paper-plane" disabled={!validToSubmit} onPress={handlePublishClick} fullWidth>
            {showSchedule ? 'Lên lịch đăng bài tự động' : 'Đăng lên Bảng tin Threads'}
          </Button>
        </Card>
      </View>

      <GifStickerEmojiPickerModal
        visible={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onSelectEmoji={(em) =>
          setThreadParts((prev) => prev.map((p, i) => (i === prev.length - 1 ? `${p}${em}` : p)))
        }
        onSelectMedia={(media) => setMediaItems((prev) => [...prev, media])}
      />

      <VideoCoverEditorModal
        visible={Boolean(editingVideoCoverItem)}
        videoUri={editingVideoCoverItem?.uri ?? null}
        initialThumbnailUri={editingVideoCoverItem?.thumbnailUri}
        defaultAspect={editingVideoCoverItem?.aspectRatio ?? '16:9'}
        onClose={() => setEditingVideoCoverItem(null)}
        onApplyCover={({ thumbnailUri, coverTimestampSec, aspectRatio }) => {
          if (!editingVideoCoverItem) return;
          setMediaItems((prev) =>
            prev.map((item) =>
              item.id === editingVideoCoverItem.id
                ? { ...item, thumbnailUri, coverTimestampSec, aspectRatio }
                : item
            )
          );
          setEditingVideoCoverItem(null);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  sheet: { width: '100%', maxWidth: 560, gap: 10, padding: spacing.md },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1 },
  miniChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  stepNode: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  partInput: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 13.5,
    textAlignVertical: 'top',
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  longInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  mediaThumbCard: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  mediaThumbImg: { width: '100%', height: '100%' },
  editCoverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(79,70,229,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPanel: { padding: 10, borderRadius: radii.md, borderWidth: 1, gap: 6 },
  singleInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  smallNumInput: {
    width: 64,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  codeArea: {
    minHeight: 80,
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontFamily: 'monospace',
    fontSize: 12,
    borderRadius: radii.sm,
    padding: 10,
    textAlignVertical: 'top',
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
