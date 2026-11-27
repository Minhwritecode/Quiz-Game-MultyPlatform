import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { Button, Card, usePalette } from '@/shared/ui';
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

const AUDIENCE_LABELS: Record<Exclude<PostAudience, 'community' | 'selected'>, string> = {
  public: 'Công khai',
  followers: 'Người theo dõi',
  friends: 'Bạn bè',
  close_friends: 'Bạn thân',
  only_me: 'Chỉ mình tôi',
};

/**
 * Clean, Focused Meta Threads Composer (Warm Paper & Egyptian Ink):
 * Primary surface stays calm and uncluttered; advanced controls live inside a collapsible drawer.
 */
export function AdvancedThreadComposerModal({
  visible,
  viewerId,
  viewerName,
  savedDraft,
  quotedPost,
  initialPrefill,
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
  initialPrefill?: { text: string; topics?: string; communityId?: string | null } | null;
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
  const modalKey = `${viewerId}-${quotedPost?.id ?? 'new'}-${initialPrefill?.text?.slice(0, 24) ?? ''}`;
  return (
    <ComposerInner
      key={modalKey}
      viewerId={viewerId}
      viewerName={viewerName}
      savedDraft={quotedPost || initialPrefill ? null : savedDraft}
      quotedPost={quotedPost}
      initialPrefill={initialPrefill}
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
  viewerName,
  savedDraft,
  quotedPost,
  initialPrefill,
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
  initialPrefill?: { text: string; topics?: string; communityId?: string | null } | null;
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
    initialPrefill?.text
      ? [initialPrefill.text]
      : savedDraft?.threadParts?.length
      ? savedDraft.threadParts
      : ['']
  );
  const [longFormBody, setLongFormBody] = useState(savedDraft?.longFormBody ?? '');
  const [showLongForm, setShowLongForm] = useState(Boolean(savedDraft?.longFormBody));
  const [mediaItems, setMediaItems] = useState<SocialMediaItem[]>(savedDraft?.mediaItems ?? []);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [topicsText, setTopicsText] = useState(
    initialPrefill?.topics ?? savedDraft?.topicsText ?? ''
  );
  const [audience, setAudience] = useState<Exclude<PostAudience, 'community' | 'selected'>>(
    savedDraft?.audience && savedDraft.audience !== 'community' && savedDraft.audience !== 'selected'
      ? savedDraft.audience
      : 'public'
  );
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>(
    savedDraft?.replyPermission ?? 'everyone'
  );
  const [communityId, setCommunityId] = useState<string | null>(
    initialPrefill?.communityId ?? savedDraft?.communityId ?? null
  );
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [showDestinationMenu, setShowDestinationMenu] = useState(false);

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
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);

  const [stickerOpen, setStickerOpen] = useState(false);
  const [editingVideoCoverItem, setEditingVideoCoverItem] = useState<SocialMediaItem | null>(null);

  useEffect(() => {
    if (quotedPost || initialPrefill) return;
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
    initialPrefill,
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
  const activeCommunityName = communities.find((c) => c.id === communityId)?.name ?? null;
  const chosenSet = attachedSetId ? questionSets.find((s) => s.id === attachedSetId) : undefined;

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
      setTimeout(() => setUploadProgress(null), 350);
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
      cleanedParts.push('');
    }
    if (cleanedParts.length === 0 && mediaItems.length === 0) return;

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

    const scheduledFor =
      showSchedule && Number(scheduleMinutesFromNow) > 0
        ? new Date(Date.now() + Number(scheduleMinutesFromNow) * 60_000).toISOString()
        : null;

    onPublish({
      postKind: isAnonymous ? 'anonymous' : postKind,
      threadParts: cleanedParts.filter(Boolean).length > 0 ? cleanedParts.filter(Boolean) : ['Chia sẻ mới'],
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
              sideALabel: debateSideA.trim() || 'Quan điểm A',
              sideBLabel: debateSideB.trim() || 'Quan điểm B',
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

    if (!quotedPost && !initialPrefill) {
      onSaveDraft(null);
    }
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          {/* Minimal Clean Header */}
          <View style={[styles.topHeader, { borderBottomColor: palette.paperMuted }]}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.inkMuted }}>Hủy</Text>
            </Pressable>

            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink }]}>
                {quotedPost ? 'Trích dẫn bài viết' : 'Bài viết mới'}
              </Text>
              {totalChars > 0 ? (
                <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                  Đã lưu nháp · {totalChars}/4.000
                </Text>
              ) : null}
            </View>

            {savedDraft && !quotedPost ? (
              <Pressable
                onPress={() => {
                  onSaveDraft(null);
                  setThreadParts(['']);
                  setMediaItems([]);
                  setLongFormBody('');
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.danger }}>
                  Xóa nháp
                </Text>
              </Pressable>
            ) : (
              <View style={{ width: 32 }} />
            )}
          </View>

          <ScrollView
            style={{ maxHeight: 490 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12, paddingTop: 4 }}
          >
            {/* Author & Compact Audience / Destination Selectors */}
            <View style={styles.authorMetaRow}>
              <View style={[styles.authorCircle, { backgroundColor: palette.indigo }]}>
                <Text style={{ color: palette.onPrimary, fontSize: 13, fontWeight: '800' }}>
                  {(isAnonymous ? '?' : viewerName[0] || 'P').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: palette.ink }} numberOfLines={1}>
                  {isAnonymous ? 'Thành viên ẩn danh' : viewerName}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Pressable
                    onPress={() => {
                      setShowAudienceMenu((v) => !v);
                      setShowDestinationMenu(false);
                    }}
                    style={[
                      styles.selectorPill,
                      { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                      {communityId ? 'Trong nhóm' : AUDIENCE_LABELS[audience]}
                    </Text>
                    <AppIcon name="chevron-down" size={12} color={palette.indigo} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setShowDestinationMenu((v) => !v);
                      setShowAudienceMenu(false);
                    }}
                    style={[
                      styles.selectorPill,
                      { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                    ]}
                  >
                    <Text
                      style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}
                      numberOfLines={1}
                    >
                      {activeCommunityName || 'Trang cá nhân'}
                    </Text>
                    <AppIcon name="chevron-down" size={12} color={palette.inkMuted} />
                  </Pressable>

                  {postKind !== 'thread' ? (
                    <View
                      style={[
                        styles.selectorPill,
                        { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.indigo }}>
                        {postKind === 'ghost'
                          ? 'Tự hủy 24h'
                          : postKind === 'debate'
                          ? 'Tranh biện'
                          : 'Bài viết dài'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {showAudienceMenu ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(AUDIENCE_LABELS) as Array<keyof typeof AUDIENCE_LABELS>).map((aud) => (
                  <Pressable
                    key={aud}
                    onPress={() => {
                      setCommunityId(null);
                      setAudience(aud);
                      setShowAudienceMenu(false);
                    }}
                    style={[
                      styles.miniChip,
                      {
                        borderColor:
                          !communityId && audience === aud ? palette.indigo : palette.paperMuted,
                        backgroundColor:
                          !communityId && audience === aud
                            ? palette.indigoTint
                            : palette.paperRaised,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {AUDIENCE_LABELS[aud]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {showDestinationMenu ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                <Pressable
                  onPress={() => {
                    setCommunityId(null);
                    setShowDestinationMenu(false);
                  }}
                  style={[
                    styles.miniChip,
                    {
                      borderColor: !communityId ? palette.indigo : palette.paperMuted,
                      backgroundColor: !communityId ? palette.indigoTint : palette.paperRaised,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                    Trang cá nhân
                  </Text>
                </Pressable>
                {communities.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCommunityId(c.id);
                      setShowDestinationMenu(false);
                    }}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: communityId === c.id ? palette.indigo : palette.paperMuted,
                        backgroundColor:
                          communityId === c.id ? palette.indigoTint : palette.paperRaised,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Clean Connected Thread Inputs */}
            {threadParts.map((val, idx) => (
              <View key={idx} style={{ flexDirection: 'row', gap: 10 }}>
                {threadParts.length > 1 ? (
                  <View style={{ width: 18, alignItems: 'center', paddingTop: 10 }}>
                    <View
                      style={[
                        styles.threadDot,
                        { backgroundColor: palette.indigoBorder },
                      ]}
                    />
                    {idx < threadParts.length - 1 ? (
                      <View
                        style={{
                          width: 2,
                          flex: 1,
                          backgroundColor: palette.paperMuted,
                          marginTop: 4,
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}

                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextInput
                    value={val}
                    onChangeText={(txt) =>
                      setThreadParts((prev) => prev.map((p, i) => (i === idx ? txt : p)))
                    }
                    multiline
                    placeholder={
                      idx === 0 ? 'Bạn đang nghĩ gì?' : `Thêm vào chuỗi (${idx + 1})...`
                    }
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.partInput,
                      {
                        color: palette.ink,
                        borderColor: palette.paperMuted,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  />
                </View>

                {threadParts.length > 1 ? (
                  <View style={{ gap: 4, paddingTop: 4 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Di chuyển lên" disabled={idx === 0} onPress={() => movePart(idx, -1)}>
                      <AppIcon
                        name="chevron-up"
                        size={17}
                        color={idx === 0 ? palette.paperMuted : palette.inkMuted}
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Di chuyển xuống"
                      disabled={idx === threadParts.length - 1}
                      onPress={() => movePart(idx, 1)}
                    >
                      <AppIcon
                        name="chevron-down"
                        size={17}
                        color={
                          idx === threadParts.length - 1 ? palette.paperMuted : palette.inkMuted
                        }
                      />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa mục này"
                      onPress={() => setThreadParts((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <AppIcon name="close-circle-outline" size={17} color={palette.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}

            <Pressable
              onPress={() => setThreadParts((prev) => [...prev, ''])}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <AppIcon name="add-circle-outline" size={17} color={palette.indigo} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.indigo }}>
                Thêm vào chuỗi
              </Text>
            </Pressable>

            {/* Debate Side Labels */}
            {postKind === 'debate' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={debateSideA}
                  onChangeText={setDebateSideA}
                  placeholder="Quan điểm A"
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.halfInput,
                    {
                      color: palette.ink,
                      borderColor: palette.indigoBorder,
                      backgroundColor: palette.paperRaised,
                    },
                  ]}
                />
                <TextInput
                  value={debateSideB}
                  onChangeText={setDebateSideB}
                  placeholder="Quan điểm B"
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.halfInput,
                    {
                      color: palette.ink,
                      borderColor: palette.goldBorder,
                      backgroundColor: palette.paperRaised,
                    },
                  ]}
                />
              </View>
            ) : null}

            {/* Long-Form Editor */}
            {showLongForm ? (
              <TextInput
                value={longFormBody}
                onChangeText={setLongFormBody}
                multiline
                placeholder="Nội dung chi tiết cho bài viết dài..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.longInput,
                  {
                    color: palette.ink,
                    borderColor: palette.indigoBorder,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
            ) : null}

            {uploadProgress !== null ? (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.indigo }}>
                  Đang tải tệp lên: {uploadProgress}%
                </Text>
                <View
                  style={{
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: palette.paperMuted,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      backgroundColor: palette.indigo,
                    }}
                  />
                </View>
              </View>
            ) : null}

            {/* Media Previews */}
            {mediaItems.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {mediaItems.map((m) => (
                  <View key={m.id} style={styles.mediaThumbCard}>
                    <Image
                      source={{ uri: m.thumbnailUri || m.uri }}
                      style={styles.mediaThumbImg}
                      resizeMode="cover"
                    />
                    {m.kind === 'video' ? (
                      <Pressable
                        onPress={() => setEditingVideoCoverItem(m)}
                        style={[styles.editCoverBadge, { backgroundColor: palette.indigo }]}
                      >
                        <AppIcon name="film-outline" size={12} color={palette.onPrimary} />
                        <Text
                          style={{ color: palette.onPrimary, fontSize: 10, fontWeight: '800' }}
                        >
                          Ảnh bìa
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Đóng"
                      onPress={() => setMediaItems((prev) => prev.filter((x) => x.id !== m.id))}
                      style={[styles.removeMediaBtn, { backgroundColor: palette.danger }]}
                    >
                      <AppIcon name="close" size={13} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {chosenSet ? (
              <View
                style={[
                  styles.attachedQuizBanner,
                  { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                ]}
              >
                <AppIcon name="book-outline" size={16} color={palette.indigo} />
                <Text
                  style={{ fontSize: 12.5, fontWeight: '700', color: palette.ink, flex: 1 }}
                  numberOfLines={1}
                >
                  Bộ đề: {chosenSet.title} ({chosenSet.questions.length} câu)
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Bỏ chọn" onPress={() => setAttachedSetId('')}>
                  <AppIcon name="close-circle" size={17} color={palette.inkMuted} />
                </Pressable>
              </View>
            ) : null}

            {quotedPost ? <SharedPostCard postId={quotedPost.id} viewerId={viewerId} /> : null}

            {/* Interactive Poll Builder */}
            {showPoll ? (
              <View
                style={[
                  styles.subPanel,
                  { borderColor: palette.indigoBorder, backgroundColor: palette.paperRaised },
                ]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                    Tạo khảo sát
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setShowPoll(false)}>
                    <AppIcon name="close" size={17} color={palette.inkMuted} />
                  </Pressable>
                </View>
                <TextInput
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  placeholder="Đặt câu hỏi khảo sát..."
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.singleInput,
                    { color: palette.ink, borderColor: palette.paperMuted },
                  ]}
                />
                {pollOptions.map((opt, idx) => (
                  <TextInput
                    key={idx}
                    value={opt}
                    onChangeText={(txt) =>
                      setPollOptions((prev) => prev.map((o, i) => (i === idx ? txt : o)))
                    }
                    placeholder={`Lựa chọn ${idx + 1}`}
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.singleInput,
                      { color: palette.ink, borderColor: palette.paperMuted },
                    ]}
                  />
                ))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <Pressable onPress={() => setPollOptions((p) => [...p, ''])}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}>
                      + Thêm lựa chọn
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setPollMulti((v) => !v)}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: pollMulti ? palette.mint : palette.inkMuted,
                      }}
                    >
                      {pollMulti ? 'Chọn nhiều: Bật' : 'Chọn nhiều: Tắt'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setPollAnon((v) => !v)}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: pollAnon ? palette.mint : palette.inkMuted,
                      }}
                    >
                      {pollAnon ? 'Ẩn danh: Bật' : 'Ẩn danh: Tắt'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setPollAllowAdd((v) => !v)}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: pollAllowAdd ? palette.mint : palette.inkMuted,
                      }}
                    >
                      {pollAllowAdd ? 'Cho thêm mục: Bật' : 'Cho thêm mục: Tắt'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Quiz Set Picker */}
            {showQuizPicker ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {questionSets.slice(0, 12).map((qs) => (
                  <Pressable
                    key={qs.id}
                    onPress={() => {
                      setAttachedSetId(attachedSetId === qs.id ? '' : qs.id);
                      setShowQuizPicker(false);
                    }}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: attachedSetId === qs.id ? palette.indigo : palette.paperMuted,
                        backgroundColor:
                          attachedSetId === qs.id ? palette.indigoTint : palette.paperRaised,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, color: palette.ink }} numberOfLines={1}>
                      {qs.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Code Block */}
            {showCode ? (
              <TextInput
                value={codeSnippet}
                onChangeText={setCodeSnippet}
                multiline
                placeholder="Dán đoạn mã nguồn..."
                placeholderTextColor="#94A3B8"
                style={styles.codeArea}
              />
            ) : null}

            {/* Primary Uncluttered Attachment Toolbar */}
            <View style={[styles.primaryToolbar, { borderTopColor: palette.paperMuted }]}>
              <Pressable
                onPress={() => void handlePickPhotos()}
                style={[styles.toolChip, { borderColor: palette.paperMuted }]}
              >
                <AppIcon name="images-outline" size={16} color={palette.indigo} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>Ảnh</Text>
              </Pressable>

              <Pressable
                onPress={() => void handlePickVideo()}
                style={[styles.toolChip, { borderColor: palette.paperMuted }]}
              >
                <AppIcon name="videocam-outline" size={16} color={palette.indigo} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>Video</Text>
              </Pressable>

              <Pressable
                onPress={() => setStickerOpen(true)}
                style={[styles.toolChip, { borderColor: palette.paperMuted }]}
              >
                <AppIcon name="happy-outline" size={16} color={palette.gold} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>GIF</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowPoll((v) => !v)}
                style={[
                  styles.toolChip,
                  {
                    borderColor: showPoll ? palette.indigo : palette.paperMuted,
                    backgroundColor: showPoll ? palette.indigoTint : 'transparent',
                  },
                ]}
              >
                <AppIcon name="stats-chart-outline" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                  Khảo sát
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowQuizPicker((v) => !v)}
                style={[
                  styles.toolChip,
                  {
                    borderColor: attachedSetId ? palette.indigo : palette.paperMuted,
                    backgroundColor: attachedSetId ? palette.indigoTint : 'transparent',
                  },
                ]}
              >
                <AppIcon name="book-outline" size={15} color={palette.indigo} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>Bộ đề</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowAdvancedDrawer((v) => !v)}
                style={[
                  styles.toolChip,
                  {
                    borderColor: showAdvancedDrawer ? palette.indigo : palette.paperMuted,
                    backgroundColor: showAdvancedDrawer ? palette.indigoTint : 'transparent',
                  },
                ]}
              >
                <AppIcon name="options-outline" size={15} color={palette.inkMuted} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                  Tùy chọn khác
                </Text>
              </Pressable>
            </View>

            {/* Collapsible Secondary Options Drawer */}
            {showAdvancedDrawer ? (
              <View
                style={[
                  styles.subPanel,
                  { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.inkMuted }}>
                  Định dạng bài viết
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {(
                    [
                      { id: 'thread', label: 'Chuỗi bài' },
                      { id: 'ghost', label: 'Tự hủy 24h' },
                      { id: 'debate', label: 'Tranh biện' },
                      { id: 'article', label: 'Bài viết dài' },
                    ] as const
                  ).map((k) => {
                    const active = postKind === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        onPress={() => {
                          setPostKind(k.id);
                          setShowLongForm(k.id === 'article');
                        }}
                        style={[
                          styles.miniChip,
                          {
                            backgroundColor: active ? palette.indigo : palette.paper,
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
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  <Pressable
                    onPress={() => setIsSpoiler((v) => !v)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: isSpoiler ? palette.gold : palette.paperMuted,
                        backgroundColor: isSpoiler ? palette.goldTint : palette.paper,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {isSpoiler ? 'Ẩn nội dung: Bật' : 'Ẩn nội dung'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsAnonymous((v) => !v)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: isAnonymous ? palette.indigo : palette.paperMuted,
                        backgroundColor: isAnonymous ? palette.indigoTint : palette.paper,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {isAnonymous ? 'Ẩn danh: Bật' : 'Đăng ẩn danh'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowSchedule((v) => !v)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: showSchedule ? palette.indigo : palette.paperMuted,
                        backgroundColor: showSchedule ? palette.indigoTint : palette.paper,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      Hẹn giờ đăng
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowCode((v) => !v)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: showCode ? palette.indigo : palette.paperMuted,
                        backgroundColor: showCode ? palette.indigoTint : palette.paper,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      Đoạn code
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowLocationPicker((v) => !v)}
                    style={[
                      styles.miniChip,
                      {
                        borderColor: locationLabel ? palette.indigo : palette.paperMuted,
                        backgroundColor: locationLabel ? palette.indigoTint : palette.paper,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                      {locationLabel || 'Vị trí'}
                    </Text>
                  </Pressable>

                  {knownUsers.filter((u) => u.id !== viewerId).length > 0 ? (
                    <Pressable
                      onPress={() => setShowMentionPicker((v) => !v)}
                      style={[
                        styles.miniChip,
                        { borderColor: palette.paperMuted, backgroundColor: palette.paper },
                      ]}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink }}>
                        Nhắc tên @
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {isSpoiler ? (
                  <TextInput
                    value={spoilerWarning}
                    onChangeText={setSpoilerWarning}
                    placeholder="Ghi chú trước khi mở nội dung ẩn..."
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.singleInput,
                      { color: palette.ink, borderColor: palette.goldBorder },
                    ]}
                  />
                ) : null}

                {showSchedule ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: palette.ink }}>Đăng sau (phút):</Text>
                    <TextInput
                      value={scheduleMinutesFromNow}
                      onChangeText={setScheduleMinutesFromNow}
                      keyboardType="numeric"
                      style={[
                        styles.smallNumInput,
                        { color: palette.ink, borderColor: palette.indigoBorder },
                      ]}
                    />
                  </View>
                ) : null}

                {showLocationPicker ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {LOCATION_OPTIONS.map((loc) => (
                      <Pressable
                        key={loc}
                        onPress={() => {
                          setLocationLabel(locationLabel === loc ? '' : loc);
                          setShowLocationPicker(false);
                        }}
                        style={[
                          styles.miniChip,
                          {
                            borderColor:
                              locationLabel === loc ? palette.indigo : palette.paperMuted,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, color: palette.ink }}>{loc}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                {showMentionPicker ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
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
                          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.indigo }}>
                            @{u.displayName}
                          </Text>
                        </Pressable>
                      ))}
                  </ScrollView>
                ) : null}

                <TextInput
                  value={topicsText}
                  onChangeText={setTopicsText}
                  placeholder="Chủ đề (cách nhau bằng dấu phẩy, ví dụ: CNTT, AI)"
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.singleInput,
                    { color: palette.ink, borderColor: palette.paperMuted },
                  ]}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>
                    Ai có thể bình luận:
                  </Text>
                  {(['everyone', 'followers', 'friends', 'mentioned', 'nobody'] as const).map(
                    (rp) => (
                      <Pressable
                        key={rp}
                        onPress={() => setReplyPermission(rp)}
                        style={[
                          styles.miniChip,
                          {
                            borderColor:
                              replyPermission === rp ? palette.indigo : palette.paperMuted,
                            backgroundColor:
                              replyPermission === rp ? palette.indigoTint : palette.paper,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                          {rp === 'everyone'
                            ? 'Mọi người'
                            : rp === 'followers'
                            ? 'Người theo dõi'
                            : rp === 'friends'
                            ? 'Bạn bè'
                            : rp === 'mentioned'
                            ? 'Người được nhắc'
                            : 'Tắt bình luận'}
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <Button
            icon="paper-plane"
            disabled={!validToSubmit}
            onPress={handlePublishClick}
            fullWidth
          >
            {showSchedule ? 'Hẹn giờ đăng' : 'Đăng bài'}
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
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  sheet: { width: '100%', maxWidth: 540, gap: 10, padding: spacing.md },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  miniChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  threadDot: { width: 8, height: 8, borderRadius: 4 },
  partInput: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 14.5,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  halfInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  longInput: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 13.5,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedQuizBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  subPanel: { padding: 12, borderRadius: radii.md, borderWidth: 1, gap: 8 },
  singleInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 13,
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
  primaryToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
