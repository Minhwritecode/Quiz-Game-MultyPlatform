import { useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STORY_GRADIENTS, type ScholarStory } from '../domain/models';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { dependencies } from '@/composition/dependencies';

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
  onDirectMessage?: (author: { id: string; name: string }) => void;
}) {
  if (!story) return null;
  const bgStyle =
    Platform.OS === 'web'
      ? ({
          backgroundImage: `linear-gradient(155deg, ${story.gradient[0]} 0%, ${story.gradient[1]} 100%)`,
        } as object)
      : { backgroundColor: story.gradient[0] };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <View style={[styles.storyCanvas, bgStyle]}>
          {/* Top Story Progress Bar */}
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          {/* Author Header */}
          <View style={styles.viewerHeader}>
            <View style={styles.authorBadgeAvatar}>
              {story.authorAvatar ? (
                <Image source={{ uri: story.authorAvatar }} style={styles.authorAvatarImg} />
              ) : (
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>
                  {(story.authorName[0] || 'S').toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                {story.authorName} · Lv.{story.authorLevel}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11 }}>
                {story.badgeLabel || 'Tin Học Giả 24h'} · 👁️ {story.viewedByIds.length + 1} lượt xem
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Story Content */}
          <View style={styles.storyBody}>
            {story.imageUri ? (
              <Image source={{ uri: story.imageUri }} style={styles.storyPhoto} resizeMode="cover" />
            ) : null}
            <Text style={styles.storyHeadline}>{story.text}</Text>
            {story.subtext ? <Text style={styles.storySubtext}>{story.subtext}</Text> : null}
          </View>

          {/* Bottom Reactions & Direct Message */}
          <View style={styles.viewerFooter}>
            <View style={styles.emojiBar}>
              {(['❤️', '🔥', '👏', '💯'] as const).map((emo) => {
                const count = story.reactions[emo]?.length ?? 0;
                const reacted = story.reactions[emo]?.includes(viewerId);
                return (
                  <Pressable
                    key={emo}
                    onPress={() => onReact(story.id, emo)}
                    style={[
                      styles.emojiBtn,
                      reacted && { backgroundColor: 'rgba(255,255,255,0.32)', borderColor: '#FDE68A' },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{emo}</Text>
                    {count > 0 && (
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{count}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {onDirectMessage && story.authorId !== viewerId && (
              <Pressable
                onPress={() => {
                  onClose();
                  onDirectMessage({ id: story.authorId, name: story.authorName });
                }}
                style={styles.dmReplyBtn}
              >
                <Ionicons name="paper-plane" size={14} color="#0F172A" />
                <Text style={{ color: '#0F172A', fontSize: 12, fontWeight: '900' }}>Phản hồi qua Tin nhắn</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function StoryComposerModal({
  visible,
  onClose,
  onPublish,
}: {
  visible: boolean;
  onClose: () => void;
  onPublish: (data: {
    text: string;
    subtext: string;
    gradient: [string, string];
    imageUri: string | null;
    isHighlight: boolean;
  }) => void;
}) {
  const palette = usePalette();
  const [text, setText] = useState('');
  const [subtext, setSubtext] = useState('#StudyWithMe · Papyrus');
  const [gradIdx, setGradIdx] = useState(0);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isHighlight, setIsHighlight] = useState(true);

  const activeGrad = STORY_GRADIENTS[gradIdx] ?? STORY_GRADIENTS[0]!;

  const pickPhoto = async () => {
    try {
      const uris = await dependencies.intake.pickSourceImages();
      if (uris[0]) setImageUri(uris[0]);
    } catch {
      // Ignore
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Card style={[styles.composerCard, { backgroundColor: palette.paper }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[typography.title, { color: palette.ink }]}>✨ Đăng Tin (Story 24h) Mới</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>

          {/* Live Story Preview */}
          <View
            style={[
              styles.previewBox,
              Platform.OS === 'web'
                ? ({
                    backgroundImage: `linear-gradient(145deg, ${activeGrad.colors[0]} 0%, ${activeGrad.colors[1]} 100%)`,
                  } as object)
                : { backgroundColor: activeGrad.colors[0] },
            ]}
          >
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImg} /> : null}
            <Text style={styles.previewText} numberOfLines={4}>
              {text.trim() || 'Chia sẻ thành tựu ôn tập, câu nói truyền cảm hứng hoặc mẹo nhớ bài của bạn…'}
            </Text>
            {!!subtext && <Text style={styles.previewSub}>{subtext}</Text>}
          </View>

          {/* Gradient Picker */}
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
            <Pressable
              onPress={() => void pickPhoto()}
              style={[styles.gradChip, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
            >
              <Ionicons name="image-outline" size={14} color={palette.indigo} />
              <Text style={{ color: palette.indigo, fontSize: 11, fontWeight: '800' }}>Ảnh</Text>
            </Pressable>
          </ScrollView>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={220}
            placeholder="Nội dung chính trên Story của bạn..."
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
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
              Ghim vào mục «Tin Nổi Bật» trên Trang Cá Nhân của tôi
            </Text>
          </Pressable>

          <Button
            variant="reward"
            icon="sparkles"
            disabled={!text.trim() && !imageUri}
            onPress={() => {
              onPublish({
                text: text.trim() || 'Khoảnh khắc học tập trên Papyrus ✨',
                subtext: subtext.trim(),
                gradient: activeGrad.colors,
                imageUri,
                isHighlight,
              });
              setText('');
              setImageUri(null);
              onClose();
            }}
            fullWidth
          >
            Đăng lên Tin Cộng Đồng & Trang Cá Nhân
          </Button>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 24, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  storyCanvas: {
    width: '100%',
    maxWidth: 400,
    minHeight: 540,
    borderRadius: 26,
    padding: spacing.lg,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.sm,
  },
  authorBadgeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  authorAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 14,
  },
  storyPhoto: {
    width: '100%',
    height: 210,
    borderRadius: 16,
  },
  storyHeadline: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 31,
    fontWeight: '900',
    textAlign: 'center',
  },
  storySubtext: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  viewerFooter: {
    gap: 10,
    alignItems: 'center',
  },
  emojiBar: {
    flexDirection: 'row',
    gap: 10,
  },
  emojiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dmReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  composerCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    gap: spacing.sm,
  },
  previewBox: {
    minHeight: 165,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewImg: {
    width: 90,
    height: 64,
    borderRadius: 10,
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  previewSub: {
    color: '#FDE68A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  gradChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 2,
  },
  storyInput: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  subInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
  },
});
