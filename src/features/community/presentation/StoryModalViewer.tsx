import { createElement, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { STORY_GRADIENTS, type ScholarStory } from '../domain/models';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { pickStoryMedia } from '@/composition/platform';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { VideoCoverEditorModal } from '@/features/social/presentation/VideoCoverEditorModal';
import { GifStickerEmojiPickerModal } from '@/features/social/presentation/GifStickerEmojiPickerModal';

/**
 * Fullscreen Facebook-Style 9:16 Story Viewer:
 * Supports full-bleed Photos, real Video playback (with sound toggle, pause/play & duration bar),
 * flying emoji bursts, and quick Direct Message reply!
 */
export function StoryViewerModal({
  story,
  viewerId,
  onClose,
  onReact,
  onDirectMessage,
}: {
  story: ScholarStory | null;
  viewerId: string;
  onClose: () => void;
  onReact: (storyId: string, emoji: string) => void;
  onDirectMessage?: (author: { id: string; name: string; replyText?: string }) => void;
}) {
  if (!story) return null;
  return (
    <StoryViewerModalInner
      key={story.id}
      story={story}
      viewerId={viewerId}
      onClose={onClose}
      onReact={onReact}
      onDirectMessage={onDirectMessage}
    />
  );
}

function StoryViewerModalInner({
  story,
  viewerId,
  onClose,
  onReact,
  onDirectMessage,
}: {
  story: ScholarStory;
  viewerId: string;
  onClose: () => void;
  onReact: (storyId: string, emoji: string) => void;
  onDirectMessage?: (author: { id: string; name: string; replyText?: string }) => void;
}) {
  const router = useRouter();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);
  const [progressAnim] = useState(() => new Animated.Value(0));
  const [burstAnim] = useState(() => new Animated.Value(0));

  const isVideo = Boolean(story.mediaType === 'video' || story.videoUri);
  const durationMs = Math.max(5000, Math.min(20000, (story.durationSec ?? 7) * 1000));

  useEffect(() => {
    if (paused) {
      progressAnim.stopAnimation();
      return;
    }
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) onClose();
    });
    return () => anim.stop();
  }, [durationMs, onClose, paused, progressAnim]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const videoEl = document.getElementById('papyrus-story-video-el') as HTMLVideoElement | null;
    if (!videoEl) return;
    videoEl.muted = muted;
    if (paused || reduceMotion) {
      videoEl.pause();
    } else {
      void videoEl.play().catch(() => {
        videoEl.muted = true;
        setMuted(true);
        void videoEl.play().catch(() => undefined);
      });
    }
  }, [muted, paused, reduceMotion, story.id]);

  const triggerEmojiBurst = (emo: string) => {
    onReact(story.id, emo);
    setBurstEmoji(emo);
    burstAnim.setValue(0);
    Animated.timing(burstAnim, {
      toValue: 1,
      duration: 720,
      useNativeDriver: true,
    }).start(() => setBurstEmoji(null));
  };

  const fullPhoto = story.imageUri || story.thumbnailUri || null;
  const bgStyle =
    Platform.OS === 'web'
      ? ({
        backgroundImage: `linear-gradient(160deg, ${story.gradient[0]} 0%, ${story.gradient[1]} 100%)`,
      } as unknown as ViewStyle)
      : { backgroundColor: story.gradient[0] };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <View style={[styles.storyCanvas, bgStyle]}>
          {/* Full-bleed Photo OR Video Player */}
          {isVideo && story.videoUri && Platform.OS === 'web' ? (
            createElement('video', {
              id: 'papyrus-story-video-el',
              src: story.videoUri,
              poster: story.thumbnailUri || undefined,
              width: 390,
              height: 690,
              playsInline: true,
              autoPlay: !reduceMotion,
              muted,
              style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              },
            })
          ) : fullPhoto ? (
            <Image source={{ uri: fullPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : null}

          {/* Scrim for Header & Footer legibility */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              Platform.OS === 'web'
                ? ({
                  backgroundImage:
                    'linear-gradient(180deg, rgba(2,6,23,0.68) 0%, rgba(2,6,23,0.06) 28%, rgba(2,6,23,0.08) 68%, rgba(2,6,23,0.86) 100%)',
                } as unknown as ViewStyle)
                : { backgroundColor: 'rgba(2,6,23,0.28)' },
            ]}
          />

          {/* Top Progress + Controls */}
          <View style={{ zIndex: 3 }}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            <View style={styles.viewerHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xem trang cá nhân của ${story.authorName}`}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/user/[userId]', params: { userId: story.authorId } });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}
              >
                <View style={styles.authorBadgeAvatar}>
                  {story.authorAvatar ? (
                    <Image source={{ uri: story.authorAvatar }} style={styles.authorAvatarImg} />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>
                      {(story.authorName[0] || 'S').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                    {story.authorName}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11 }} numberOfLines={1}>
                    {story.badgeLabel ? `${story.badgeLabel} · ` : ''}👁️ {story.viewedByIds.length} lượt xem
                  </Text>
                </View>
              </Pressable>

              {isVideo && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                  onPress={() => setMuted((m) => !m)}
                  style={styles.ctrlBtn}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={paused ? 'Tiếp tục phát' : 'Tạm dừng'}
                onPress={() => setPaused((p) => !p)}
                style={styles.ctrlBtn}
              >
                <Ionicons name={paused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable accessibilityRole="button" accessibilityLabel="Đóng Story" onPress={onClose} style={styles.ctrlBtn}>
                <Ionicons name="close" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Center / Lower Caption Overlay */}
          <Pressable
            onPress={() => setPaused((p) => !p)}
            style={styles.storyTapZone}
          >
            {story.text ? (
              <View style={fullPhoto || isVideo ? styles.captionPillOverlay : undefined}>
                <Text style={fullPhoto || isVideo ? styles.captionOnMedia : styles.storyHeadline}>
                  {story.text}
                </Text>
                {story.subtext ? <Text style={styles.storySubtext}>{story.subtext}</Text> : null}
              </View>
            ) : null}

            {burstEmoji ? (
              <Animated.Text
                style={{
                  position: 'absolute',
                  bottom: 60,
                  fontSize: 54,
                  opacity: burstAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    {
                      translateY: burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -160] }),
                    },
                    {
                      scale: burstAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.6, 1.35, 1.1] }),
                    },
                  ],
                }}
              >
                {burstEmoji}
              </Animated.Text>
            ) : null}
          </Pressable>

          {/* Facebook Bottom Reply Input + Emoji Bar */}
          <View style={styles.viewerFooter}>
            {onDirectMessage && story.authorId !== viewerId ? (
              <View style={styles.replyRow}>
                <TextInput
                  value={replyText}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  onChangeText={setReplyText}
                  placeholder={`Gửi tin nhắn cho ${story.authorName}...`}
                  placeholderTextColor="rgba(255,255,255,0.72)"
                  style={styles.replyInput}
                />
                {replyText.trim().length > 0 ? (
                  <Pressable
                    onPress={() => {
                      const msg = replyText.trim();
                      onClose();
                      onDirectMessage({ id: story.authorId, name: story.authorName, replyText: msg });
                    }}
                    style={styles.sendStoryReplyBtn}
                  >
                    <Ionicons name="send" size={16} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={styles.emojiBar}>
              {(['❤️', '🔥', '😂', '😮', '👏'] as const).map((emo) => {
                const count = story.reactions[emo]?.length ?? 0;
                const reacted = story.reactions[emo]?.includes(viewerId);
                return (
                  <Pressable
                    key={emo}
                    onPress={() => triggerEmojiBurst(emo)}
                    style={[
                      styles.emojiBtn,
                      reacted && { backgroundColor: 'rgba(59, 130, 246, 0.42)', borderColor: '#93C5FD' },
                    ]}
                  >
                    <Text style={{ fontSize: 19 }}>{emo}</Text>
                    {count > 0 ? (
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Facebook-Style Story Composer Modal (Supports Photo Story, Video Story with auto First-Frame Thumbnail, or Gradient Text Story!)
 */
export function StoryComposerModal({
  visible,
  initialDraft,
  onClose,
  onPublish,
}: {
  visible: boolean;
  initialDraft?: {
    text?: string;
    subtext?: string;
    imageUri?: string | null;
  } | null;
  onClose: () => void;
  onPublish: (data: {
    text: string;
    subtext: string;
    gradient: [string, string];
    mediaType: 'text' | 'image' | 'video';
    imageUri: string | null;
    videoUri?: string | null;
    thumbnailUri?: string | null;
    durationSec?: number;
    isHighlight: boolean;
  }) => void;
}) {
  if (!visible) return null;
  const draftKey = `${initialDraft?.text ?? ''}::${initialDraft?.imageUri ?? ''}`;
  return (
    <StoryComposerModalInner
      key={draftKey}
      initialDraft={initialDraft}
      onClose={onClose}
      onPublish={onPublish}
    />
  );
}

function StoryComposerModalInner({
  initialDraft,
  onClose,
  onPublish,
}: {
  initialDraft?: {
    text?: string;
    subtext?: string;
    imageUri?: string | null;
  } | null;
  onClose: () => void;
  onPublish: (data: {
    text: string;
    subtext: string;
    gradient: [string, string];
    mediaType: 'text' | 'image' | 'video';
    imageUri: string | null;
    videoUri?: string | null;
    thumbnailUri?: string | null;
    durationSec?: number;
    isHighlight: boolean;
  }) => void;
}) {
  const palette = usePalette();
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [subtext, setSubtext] = useState(
    initialDraft?.subtext ?? (initialDraft ? '#TriThứcHômNay · Papyrus' : '#StudyWithMe · Papyrus')
  );
  const [gradIdx, setGradIdx] = useState(0);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>(
    initialDraft?.imageUri ? 'image' : 'text'
  );
  const [imageUri, setImageUri] = useState<string | null>(initialDraft?.imageUri ?? null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(initialDraft?.imageUri ?? null);
  const [durationSec, setDurationSec] = useState<number>(8);
  const [picking, setPicking] = useState(false);
  const [isHighlight, setIsHighlight] = useState(true);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [stickerModalOpen, setStickerModalOpen] = useState(false);

  const activeGrad = STORY_GRADIENTS[gradIdx] ?? STORY_GRADIENTS[0]!;

  const handleChooseMedia = async (kind: 'image' | 'video') => {
    if (picking) return;
    setPicking(true);
    try {
      const picked = await pickStoryMedia(kind);
      if (!picked) return;
      if (picked.mediaType === 'video') {
        setMediaType('video');
        setVideoUri(picked.uri);
        setThumbnailUri(picked.thumbnailUri || null);
        setImageUri(picked.thumbnailUri || null);
        setDurationSec(picked.durationSec ?? 10);
      } else {
        setMediaType('image');
        setImageUri(picked.uri);
        setThumbnailUri(picked.thumbnailUri || picked.uri);
        setVideoUri(null);
        setDurationSec(7);
      }
    } finally {
      setPicking(false);
    }
  };

  const previewThumb = thumbnailUri || imageUri;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Card style={[styles.composerCard, { backgroundColor: palette.paper }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.title, { color: palette.ink }]}>✨ Tạo Tin Story 24h (Ảnh / Video)</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>

          {/* Media Picker Buttons (Facebook Story Style: Photo | Video | Clear Media) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              disabled={picking}
              onPress={() => void handleChooseMedia('image')}
              style={[
                styles.mediaPickBtn,
                {
                  backgroundColor: mediaType === 'image' ? palette.indigo : palette.indigoTint,
                  borderColor: palette.indigo,
                },
              ]}
            >
              <Ionicons name="image" size={16} color={mediaType === 'image' ? '#FFFFFF' : palette.indigo} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: mediaType === 'image' ? '#FFFFFF' : palette.indigo,
                }}
              >
                Chọn Ảnh Story
              </Text>
            </Pressable>

            <Pressable
              disabled={picking}
              onPress={() => void handleChooseMedia('video')}
              style={[
                styles.mediaPickBtn,
                {
                  backgroundColor: mediaType === 'video' ? '#E11D48' : palette.dangerTint,
                  borderColor: '#E11D48',
                },
              ]}
            >
              <Ionicons name="videocam" size={16} color={mediaType === 'video' ? '#FFFFFF' : '#E11D48'} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: mediaType === 'video' ? '#FFFFFF' : '#E11D48',
                }}
              >
                Chọn Video Story
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStickerModalOpen(true)}
              style={[styles.mediaPickBtn, { backgroundColor: palette.paperRaised, borderColor: palette.indigo }]}
            >
              <Ionicons name="happy-outline" size={16} color={palette.indigo} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>Sticker / GIF</Text>
            </Pressable>

            {mediaType === 'video' && videoUri ? (
              <Pressable
                onPress={() => setCoverEditorOpen(true)}
                style={[styles.mediaPickBtn, { backgroundColor: palette.goldTint, borderColor: palette.gold }]}
              >
                <Ionicons name="film-outline" size={15} color={palette.gold} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.gold }}>Chọn Ảnh Bìa Video</Text>
              </Pressable>
            ) : null}

            {(imageUri || videoUri) && (
              <Pressable
                onPress={() => {
                  setMediaType('text');
                  setImageUri(null);
                  setVideoUri(null);
                  setThumbnailUri(null);
                }}
                style={[styles.mediaPickBtn, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
              >
                <Ionicons name="trash-outline" size={15} color={palette.inkMuted} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>Chỉ chữ</Text>
              </Pressable>
            )}
          </View>

          {/* Live 9:16 Vertical Preview */}
          <View
            style={[
              styles.preview916Box,
              Platform.OS === 'web'
                ? ({
                  backgroundImage: `linear-gradient(150deg, ${activeGrad.colors[0]} 0%, ${activeGrad.colors[1]} 100%)`,
                } as unknown as ViewStyle)
                : { backgroundColor: activeGrad.colors[0] },
            ]}
          >
            {previewThumb ? (
              <Image source={{ uri: previewThumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: previewThumb ? 'rgba(2,6,23,0.28)' : 'transparent' }]} />
            {mediaType === 'video' && (
              <View style={styles.previewVidTag}>
                <Ionicons name="play-circle" size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                  Thumbnail khung đầu Video ({durationSec}s)
                </Text>
              </View>
            )}
            <Text style={styles.previewText} numberOfLines={3}>
              {text.trim() || (previewThumb ? '' : 'Chia sẻ khoảnh khắc học tập, ảnh hoặc video lên Tin 24h…')}
            </Text>
            {!!subtext && <Text style={styles.previewSub}>{subtext}</Text>}
          </View>

          {/* Background Gradients when posting text */}
          {!previewThumb && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {STORY_GRADIENTS.map((g, idx) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGradIdx(idx)}
                  style={[
                    styles.gradChip,
                    {
                      backgroundColor: g.colors[0],
                      borderColor: idx === gradIdx ? '#FBBF24' : 'transparent',
                    },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{g.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={240}
            placeholder="Thêm dòng chú thích trên Story (tùy chọn khi đã có Ảnh/Video)..."
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.storyInput,
              { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
            ]}
          />
          <TextInput
            value={subtext}
            onChangeText={setSubtext}
            maxLength={70}
            placeholder="Hashtag hoặc ghi chú phụ..."
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.subInput,
              { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
            ]}
          />

          <Pressable
            onPress={() => setIsHighlight((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons
              name={isHighlight ? 'checkbox' : 'square-outline'}
              size={20}
              color={palette.indigo}
            />
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
              Lưu vào dải «Tin Nổi Bật» trên Trang Cá Nhân
            </Text>
          </Pressable>

          <Button
            variant="primary"
            icon="sparkles"
            disabled={picking || (!text.trim() && !imageUri && !videoUri)}
            onPress={() => {
              onPublish({
                text: text.trim(),
                subtext: subtext.trim(),
                gradient: activeGrad.colors,
                mediaType,
                imageUri,
                videoUri,
                thumbnailUri: thumbnailUri || imageUri,
                durationSec,
                isHighlight,
              });
              setText('');
              setImageUri(null);
              setVideoUri(null);
              setThumbnailUri(null);
              setMediaType('text');
              onClose();
            }}
            fullWidth
          >
            {picking ? 'Đang xử lý ảnh/video…' : 'Đăng lên Story 24h (+20 XP)'}
          </Button>
        </Card>

        <VideoCoverEditorModal
          visible={coverEditorOpen}
          videoUri={videoUri}
          initialThumbnailUri={thumbnailUri}
          defaultAspect="9:16"
          onClose={() => setCoverEditorOpen(false)}
          onApplyCover={(res) => {
            setThumbnailUri(res.thumbnailUri);
            setImageUri(res.thumbnailUri);
          }}
        />

        <GifStickerEmojiPickerModal
          visible={stickerModalOpen}
          onClose={() => setStickerModalOpen(false)}
          onSelectEmoji={(em) => setText((prev) => `${prev} ${em}`.trim())}
          onSelectMedia={(media) => {
            if (!videoUri) {
              setMediaType('image');
              setImageUri(media.uri);
              setThumbnailUri(media.thumbnailUri || media.uri);
            } else {
              setText((prev) => `${prev} ✨ ${media.altText || ''}`.trim());
            }
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  storyCanvas: {
    width: '100%',
    maxWidth: 392,
    height: '92%',
    maxHeight: 710,
    borderRadius: 24,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    position: 'relative',
  },
  progressTrack: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  authorBadgeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  ctrlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTapZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.lg,
    zIndex: 2,
  },
  captionPillOverlay: {
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '94%',
    gap: 4,
  },
  captionOnMedia: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  storyHeadline: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 30,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  storySubtext: {
    color: '#FDE68A',
    fontSize: 12.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  viewerFooter: {
    gap: 10,
    zIndex: 3,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 13.5,
  },
  sendStoryReplyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  emojiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  composerCard: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    gap: 10,
  },
  mediaPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  preview916Box: {
    height: 220,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    gap: 4,
  },
  previewVidTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(225, 29, 72, 0.86)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 2,
  },
  previewSub: {
    color: '#FDE68A',
    fontSize: 11.5,
    fontWeight: '800',
    zIndex: 2,
  },
  gradChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  storyInput: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 14,
  },
  subInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 13,
  },
});
