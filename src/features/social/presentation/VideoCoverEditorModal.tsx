import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { pickCoverImageDataUrl } from '@/composition/platform';
import { captureVideoFrameAtTime, extractVideoCoverFilmstrip } from '@/composition/social';

/**
 * Video Cover / Thumbnail Editor Modal (Section 5.3):
 * Used in both Story Composer (9:16) and Thread/Post Video Composer (16:9, 1:1, 4:5, 9:16).
 * Lets user select any frame from the video filmstrip, scrub exact seconds, crop aspect ratio,
 * OR upload a custom cover image so videos never appear as a black screen!
 */
export function VideoCoverEditorModal({
  visible,
  videoUri,
  initialThumbnailUri,
  defaultAspect = '16:9',
  onClose,
  onApplyCover,
}: {
  visible: boolean;
  videoUri: string | null;
  initialThumbnailUri?: string | null;
  defaultAspect?: '9:16' | '16:9' | '1:1' | '4:5';
  onClose: () => void;
  onApplyCover: (result: {
    thumbnailUri: string;
    coverTimestampSec: number;
    aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  }) => void;
}) {
  const palette = usePalette();
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1' | '4:5'>(defaultAspect);
  const [selectedThumb, setSelectedThumb] = useState<string>(initialThumbnailUri || '');
  const [selectedSecond, setSelectedSecond] = useState<number>(0.15);
  const [frames, setFrames] = useState<Array<{ second: number; uri: string }>>([]);
  const [durationSec, setDurationSec] = useState<number>(8);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !videoUri) return;
    let active = true;
    void extractVideoCoverFilmstrip(videoUri, aspect, 5).then((res) => {
      if (!active) return;
      setFrames(res.frames);
      setDurationSec(res.durationSec);
      if (res.frames[0] && !initialThumbnailUri) {
        setSelectedThumb(res.frames[0].uri);
      }
    });
    return () => {
      active = false;
    };
  }, [aspect, initialThumbnailUri, videoUri, visible]);

  if (!visible || !videoUri) return null;

  const handleScrubSecond = async (sec: number) => {
    setBusy(true);
    try {
      const snap = await captureVideoFrameAtTime(videoUri, sec, aspect);
      setSelectedSecond(sec);
      setSelectedThumb(snap.thumbnailUri);
    } finally {
      setBusy(false);
    }
  };

  const handleUploadCustomCover = async () => {
    setBusy(true);
    try {
      const customImg = await pickCoverImageDataUrl();
      if (customImg) {
        setSelectedThumb(customImg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.card, { backgroundColor: palette.paper }]}>
          <View style={styles.header}>
            <Text style={[typography.title, { color: palette.ink }]}>Chọn ảnh bìa video</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} hitSlop={8}>
              <AppIcon name="close" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>

          {/* Aspect Ratio Crop Selector */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                { id: '9:16', label: '9:16 Story dọc' },
                { id: '16:9', label: '16:9 Ngang Feed' },
                { id: '4:5', label: '4:5 Chân dung' },
                { id: '1:1', label: '1:1 Vuông' },
              ] as const
            ).map((ar) => (
              <Pressable
                key={ar.id}
                onPress={() => setAspect(ar.id)}
                style={[
                  styles.arBtn,
                  {
                    backgroundColor: aspect === ar.id ? palette.indigo : palette.paperRaised,
                    borderColor: aspect === ar.id ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: aspect === ar.id ? '#FFF' : palette.ink }}>
                  {ar.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cover Preview Box */}
          <View style={styles.previewBox}>
            {selectedThumb ? (
              <Image source={{ uri: selectedThumb }} style={styles.previewImg} resizeMode="contain" />
            ) : null}
            <View style={styles.previewTag}>
              <AppIcon name="sparkles" size={12} color="#FDE68A" />
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                Khung hình {selectedSecond.toFixed(1)}s / {durationSec}s · Tỷ lệ {aspect}
              </Text>
            </View>
          </View>

          {/* Filmstrip Frame Selector */}
          <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
            Chọn khung hình bất kỳ từ Video:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {frames.map((fr) => {
              const active = Math.abs(fr.second - selectedSecond) < 0.2;
              return (
                <Pressable
                  key={fr.second}
                  onPress={() => void handleScrubSecond(fr.second)}
                  style={[
                    styles.frameThumbWrap,
                    { borderColor: active ? '#F59E0B' : palette.paperMuted },
                  ]}
                >
                  <Image source={{ uri: fr.uri }} style={styles.frameThumb} resizeMode="cover" />
                  <Text style={styles.frameSecLabel}>{fr.second}s</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              disabled={busy}
              onPress={() => void handleUploadCustomCover()}
              style={[styles.customCoverBtn, { borderColor: palette.indigo, backgroundColor: palette.indigoTint }]}
            >
              <AppIcon name="image-outline" size={16} color={palette.indigo} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                Tải ảnh bìa tùy chỉnh từ thiết bị
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onPress={onClose}>
              Hủy
            </Button>
            <Button
              icon="checkmark-circle"
              disabled={!selectedThumb || busy}
              onPress={() => {
                onApplyCover({
                  thumbnailUri: selectedThumb,
                  coverTimestampSec: selectedSecond,
                  aspectRatio: aspect,
                });
                onClose();
              }}
            >
              Áp dụng Ảnh bìa Video
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: { width: '100%', maxWidth: 480, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1 },
  previewBox: {
    width: '100%',
    height: 190,
    borderRadius: radii.md,
    backgroundColor: '#020617',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  previewImg: { width: '100%', height: '100%' },
  previewTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  frameThumbWrap: {
    width: 72,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  frameThumb: { width: '100%', height: '100%' },
  frameSecLabel: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  customCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
