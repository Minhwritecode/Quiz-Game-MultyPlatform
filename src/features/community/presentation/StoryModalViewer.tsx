import { createElement, useCallback, useEffect, useRef, useState } from 'react';
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
import { useCommunityStore } from '../state/useCommunityStore';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { pickStoryMedia } from '@/composition/platform';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { VideoCoverEditorModal } from '@/features/social/presentation/VideoCoverEditorModal';
import { GifStickerEmojiPickerModal } from '@/features/social/presentation/GifStickerEmojiPickerModal';

/**
 * Single-Box Multi-Story Viewer:
 * - Groups all slides of a user inside ONE single Story Box with segmented progress bars at top.
 * - Tap LEFT side to flip backward, tap RIGHT side to flip forward.
 * - Plays 100% of a video's REAL duration (driven by `<video>` `onTimeUpdate` & `onEnded`, ZERO 10s/20s truncation!).
 */
export function StoryViewerModal({
  story,
  stories,
  initialIndex = 0,
  viewerId,
  onClose,
  onMarkViewed,
  onReact,
  onDirectMessage,
}: {
  story?: ScholarStory | null;
  stories?: ScholarStory[] | null;
  initialIndex?: number;
  viewerId: string;
  onClose: () => void;
  onMarkViewed?: (storyId: string) => void;
  onReact: (storyId: string, emoji: string) => void;
  onDirectMessage?: (author: { id: string; name: string; replyText?: string }) => void;
}) {
  const slideList = stories && stories.length > 0 ? stories : story ? [story] : [];
  if (slideList.length === 0) return null;
  const groupKey = slideList.map((s) => s.id).join('|');
  return (
    <StoryViewerModalInner
      key={groupKey}
      slides={slideList}
      initialIndex={Math.min(Math.max(0, initialIndex), slideList.length - 1)}
      viewerId={viewerId}
      onClose={onClose}
      onMarkViewed={onMarkViewed}
      onReact={onReact}
      onDirectMessage={onDirectMessage}
    />
  );
}

function StoryViewerModalInner({
  slides,
  initialIndex,
  viewerId,
  onClose,
  onMarkViewed,
  onReact,
  onDirectMessage,
}: {
  slides: ScholarStory[];
  initialIndex: number;
  viewerId: string;
  onClose: () => void;
  onMarkViewed?: (storyId: string) => void;
  onReact: (storyId: string, emoji: string) => void;
  onDirectMessage?: (author: { id: string; name: string; replyText?: string }) => void;
}) {
  const router = useRouter();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const storeStories = useCommunityStore((s) => s.stories);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);
  const [progressAnim] = useState(() => new Animated.Value(0));
  const [flipAnim] = useState(() => new Animated.Value(1));
  const [burstAnim] = useState(() => new Animated.Value(0));
  const onMarkViewedRef = useRef(onMarkViewed);
  useEffect(() => {
    onMarkViewedRef.current = onMarkViewed;
  }, [onMarkViewed]);

  const rawSlide = slides[activeIndex] ?? slides[0]!;
  const story = storeStories.find((s) => s.id === rawSlide.id) ?? rawSlide;
  const safeAuthorName = story.authorName?.trim() || 'Thành viên Papyrus';
  const safeGrad: [string, string] =
    Array.isArray(story.gradient) && story.gradient.length >= 2
      ? [story.gradient[0] || '#312E81', story.gradient[1] || '#7C3AED']
      : ['#312E81', '#7C3AED'];
  const safeViewedByIds = Array.isArray(story.viewedByIds) ? story.viewedByIds : [];
  const safeReactions =
    story.reactions && typeof story.reactions === 'object' && !Array.isArray(story.reactions)
      ? story.reactions
      : {};
  const isVideo = Boolean(story.mediaType === 'video' || story.videoUri);
  const isWebVideo = Boolean(isVideo && story.videoUri && Platform.OS === 'web');

  const goNext = useCallback(() => {
    if (activeIndex < slides.length - 1) {
      progressAnim.setValue(0);
      if (!reduceMotion) {
        flipAnim.setValue(0.92);
        Animated.spring(flipAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 220,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
      setActiveIndex((idx) => Math.min(slides.length - 1, idx + 1));
    } else {
      onClose();
    }
  }, [activeIndex, flipAnim, onClose, progressAnim, reduceMotion, slides.length]);

  const goPrev = useCallback(() => {
    progressAnim.setValue(0);
    if (activeIndex > 0) {
      if (!reduceMotion) {
        flipAnim.setValue(0.92);
        Animated.spring(flipAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 220,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      }
      setActiveIndex((idx) => Math.max(0, idx - 1));
    } else if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const videoEl = document.getElementById('papyrus-story-video-el') as HTMLVideoElement | null;
      if (videoEl) videoEl.currentTime = 0;
    }
  }, [activeIndex, flipAnim, progressAnim, reduceMotion]);

  useEffect(() => {
    if (story?.id) {
      onMarkViewedRef.current?.(story.id);
    }
  }, [story?.id]);

  // Timer ONLY runs for image/text slides (or non-web fallback).
  // Web video slides are driven 100% by the `<video>` element's real duration (`onTimeUpdate` & `onEnded`)!
  useEffect(() => {
    if (isWebVideo) {
      progressAnim.stopAnimation();
      return undefined;
    }
    if (paused) {
      progressAnim.stopAnimation();
      return undefined;
    }
    const slideDurationMs = isVideo
      ? Math.max(6000, (story.durationSec ?? 15) * 1000)
      : 6500;
    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: slideDurationMs,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [activeIndex, goNext, isVideo, isWebVideo, paused, progressAnim, story.durationSec, story.id]);

  useEffect(() => {
    if (!isWebVideo || typeof document === 'undefined') return;
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
  }, [isWebVideo, muted, paused, reduceMotion, story.id]);

  const triggerEmojiBurst = (emo: string) => {
    if (!viewerId || viewerId === 'guest') return;
    onReact(story.id, emo);
    setBurstEmoji(emo);
    burstAnim.setValue(0);
    Animated.timing(burstAnim, {
      toValue: 1,
      duration: 720,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => setBurstEmoji(null));
  };

  const fullPhoto = story.imageUri || story.thumbnailUri || null;
  const bgStyle =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(160deg, ${safeGrad[0]} 0%, ${safeGrad[1]} 100%)`,
        } as unknown as ViewStyle)
      : { backgroundColor: safeGrad[0] };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Animated.View
          style={[
            styles.storyCanvas,
            bgStyle,
            { transform: [{ scale: flipAnim }] },
          ]}
        >
          {/* Full-bleed Photo OR Full-Length Video Player (ZERO duration cap!) */}
          {isWebVideo ? (
            createElement('video', {
              key: story.id,
              id: 'papyrus-story-video-el',
              src: story.videoUri,
              poster: story.thumbnailUri || undefined,
              width: 390,
              height: 690,
              playsInline: true,
              autoPlay: !reduceMotion && !paused,
              muted,
              onLoadedMetadata: () => {
                progressAnim.setValue(0);
              },
              onTimeUpdate: (e: { currentTarget: HTMLVideoElement }) => {
                const el = e.currentTarget;
                if (el && Number.isFinite(el.duration) && el.duration > 0) {
                  progressAnim.setValue(Math.min(1, el.currentTime / el.duration));
                }
              },
              onEnded: () => {
                progressAnim.setValue(1);
                goNext();
              },
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

          {/* Top Segmented Progress Bars + Header Controls */}
          <View style={{ zIndex: 4 }}>
            <View style={styles.segmentedRow}>
              {slides.map((sl, idx) => (
                <View key={sl.id} style={styles.progressTrack}>
                  {idx < activeIndex ? (
                    <View style={[styles.progressFill, { width: '100%' }]} />
                  ) : idx > activeIndex ? null : (
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
                  )}
                </View>
              ))}
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
                      {(safeAuthorName[0] || 'P').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                    {safeAuthorName}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11 }} numberOfLines={1}>
                    {slides.length > 1 ? `Tin ${activeIndex + 1}/${slides.length} · ` : ''}
                    {safeViewedByIds.length} lượt xem
                  </Text>
                </View>
              </Pressable>

              {isVideo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                  onPress={() => setMuted((m) => !m)}
                  style={styles.ctrlBtn}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={paused ? 'Tiếp tục phát' : 'Tạm dừng'}
                onPress={() => setPaused((p) => !p)}
                style={styles.ctrlBtn}
              >
                <Ionicons name={paused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                onPress={onClose}
                style={styles.ctrlBtn}
              >
                <Ionicons name="close" size={21} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Left / Right Tap Flip Zones inside the Single Story Box */}
          <View style={styles.storyTapZone}>
            <View style={styles.flipTouchOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tin trước"
                onPress={goPrev}
                onLongPress={() => setPaused(true)}
                onPressOut={() => {
                  if (paused) setPaused(false);
                }}
                style={styles.leftFlipZone}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tin tiếp theo"
                onPress={goNext}
                onLongPress={() => setPaused(true)}
                onPressOut={() => {
                  if (paused) setPaused(false);
                }}
                style={styles.rightFlipZone}
              />
            </View>

            {story.text ? (
              <View
                pointerEvents="none"
                style={fullPhoto || isVideo ? styles.captionPillOverlay : undefined}
              >
                <Text style={fullPhoto || isVideo ? styles.captionOnMedia : styles.storyHeadline}>
                  {story.text}
                </Text>
                {story.subtext ? <Text style={styles.storySubtext}>{story.subtext}</Text> : null}
              </View>
            ) : null}

            {burstEmoji ? (
              <Animated.Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 60,
                  fontSize: 54,
                  opacity: burstAnim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [1, 1, 0],
                  }),
                  transform: [
                    {
                      translateY: burstAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -160],
                      }),
                    },
                    {
                      scale: burstAnim.interpolate({
                        inputRange: [0, 0.4, 1],
                        outputRange: [0.6, 1.35, 1.1],
                      }),
                    },
                  ],
                }}
              >
                {burstEmoji}
              </Animated.Text>
            ) : null}
          </View>

          {/* Bottom Reply Input + Quick Reactions */}
          {viewerId !== 'guest' ? (
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
                        onDirectMessage({
                          id: story.authorId,
                          name: story.authorName,
                          replyText: msg,
                        });
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
                  const arr = Array.isArray(safeReactions[emo]) ? safeReactions[emo]! : [];
                  const count = arr.length;
                  const reacted = arr.includes(viewerId);
                  return (
                    <Pressable
                      key={emo}
                      onPress={() => triggerEmojiBurst(emo)}
                      style={[
                        styles.emojiBtn,
                        reacted && {
                          backgroundColor: 'rgba(59, 130, 246, 0.42)',
                          borderColor: '#93C5FD',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 19 }}>{emo}</Text>
                      {count > 0 ? (
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                          {count}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Clean Story Composer Modal (Photo, Full-Length Video + Cover Image Picker, or Gradient Text Story)
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
    pinnedOnProfile: boolean;
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
    pinnedOnProfile: boolean;
  }) => void;
}) {
  const palette = usePalette();
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [subtext, setSubtext] = useState(initialDraft?.subtext ?? '');
  const [gradIdx, setGradIdx] = useState(0);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video'>(
    initialDraft?.imageUri ? 'image' : 'text'
  );
  const [imageUri, setImageUri] = useState<string | null>(initialDraft?.imageUri ?? null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(initialDraft?.imageUri ?? null);
  const [durationSec, setDurationSec] = useState<number | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [pinnedOnProfile, setPinnedOnProfile] = useState(false);
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
        setDurationSec(picked.durationSec);
      } else {
        setMediaType('image');
        setImageUri(picked.uri);
        setThumbnailUri(picked.thumbnailUri || picked.uri);
        setVideoUri(null);
        setDurationSec(undefined);
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
            <Text style={[typography.title, { color: palette.ink }]}>Tạo tin mới (24h)</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>

          {/* Media Picker Buttons */}
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
              <Ionicons
                name="image-outline"
                size={16}
                color={mediaType === 'image' ? '#FFFFFF' : palette.indigo}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: mediaType === 'image' ? '#FFFFFF' : palette.indigo,
                }}
              >
                Ảnh
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
              <Ionicons
                name="videocam-outline"
                size={16}
                color={mediaType === 'video' ? '#FFFFFF' : '#E11D48'}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: mediaType === 'video' ? '#FFFFFF' : '#E11D48',
                }}
              >
                Video
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStickerModalOpen(true)}
              style={[
                styles.mediaPickBtn,
                { backgroundColor: palette.paperRaised, borderColor: palette.indigo },
              ]}
            >
              <Ionicons name="happy-outline" size={16} color={palette.indigo} />
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                GIF & Nhãn dán
              </Text>
            </Pressable>

            {mediaType === 'video' && videoUri ? (
              <Pressable
                onPress={() => setCoverEditorOpen(true)}
                style={[
                  styles.mediaPickBtn,
                  { backgroundColor: palette.goldTint, borderColor: palette.gold },
                ]}
              >
                <Ionicons name="film-outline" size={15} color={palette.gold} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.gold }}>
                  Chọn ảnh bìa
                </Text>
              </Pressable>
            ) : null}

            {(imageUri || videoUri) && (
              <Pressable
                onPress={() => {
                  setMediaType('text');
                  setImageUri(null);
                  setVideoUri(null);
                  setThumbnailUri(null);
                  setDurationSec(undefined);
                }}
                style={[
                  styles.mediaPickBtn,
                  { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                ]}
              >
                <Ionicons name="trash-outline" size={15} color={palette.inkMuted} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.inkMuted }}>
                  Chỉ văn bản
                </Text>
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
              <Image
                source={{ uri: previewThumb }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: previewThumb ? 'rgba(2,6,23,0.28)' : 'transparent' },
              ]}
            />
            {mediaType === 'video' ? (
              <View style={styles.previewVidTag}>
                <Ionicons name="play-circle" size={15} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                  Ảnh bìa video{durationSec ? ` · Thời lượng gốc ${durationSec}s` : ''}
                </Text>
              </View>
            ) : null}
            <Text style={styles.previewText} numberOfLines={3}>
              {text.trim() || (previewThumb ? '' : 'Nhập nội dung hoặc chọn ảnh, video...')}
            </Text>
            {!!subtext && <Text style={styles.previewSub}>{subtext}</Text>}
          </View>

          {!previewThumb && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
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
            placeholder="Thêm chú thích..."
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.storyInput,
              {
                color: palette.ink,
                borderColor: palette.paperMuted,
                backgroundColor: palette.paperRaised,
              },
            ]}
          />
          <TextInput
            value={subtext}
            onChangeText={setSubtext}
            maxLength={70}
            placeholder="Thẻ chủ đề (tùy chọn)..."
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.subInput,
              {
                color: palette.ink,
                borderColor: palette.paperMuted,
                backgroundColor: palette.paperRaised,
              },
            ]}
          />

          <Pressable
            onPress={() => setPinnedOnProfile((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Ionicons
              name={pinnedOnProfile ? 'checkbox' : 'square-outline'}
              size={20}
              color={palette.indigo}
            />
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
              Gắn tin này lên trang cá nhân sau khi hết 24 giờ
            </Text>
          </Pressable>

          <Button
            variant="primary"
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
                isHighlight: pinnedOnProfile,
                pinnedOnProfile,
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
            {picking ? 'Đang tải tệp...' : 'Đăng tin'}
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
              setText((prev) => `${prev} ${media.altText || ''}`.trim());
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
  segmentedRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
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
    position: 'relative',
  },
  flipTouchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  leftFlipZone: {
    width: '34%',
    height: '100%',
  },
  rightFlipZone: {
    width: '66%',
    height: '100%',
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
    zIndex: 4,
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
    justifyContent: 'space-between',
    gap: 6,
  },
  emojiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  composerCard: {
    width: '100%',
    maxWidth: 460,
    gap: 10,
    maxHeight: '92%',
  },
  mediaPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  preview916Box: {
    width: '100%',
    height: 205,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  previewVidTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  storyInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
  },
  subInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 12.5,
  },
});
