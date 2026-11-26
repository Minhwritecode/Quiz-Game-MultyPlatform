import { memo } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScholarStory } from '../domain/models';
import { usePalette } from '@/shared/ui';

/**
 * Facebook-Exact "Create Story" 9:16 Card (Top 66% user photo, bottom 34% dark panel with overlapping + badge).
 */
export const CreateStoryCard916 = memo(function CreateStoryCard916({
  avatarUrl,
  displayName,
  onPress,
}: {
  avatarUrl?: string | null;
  displayName: string;
  onPress: () => void;
}) {
  const palette = usePalette();
  const initial = (displayName.trim()[0] || 'P').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tạo tin Story 24h mới"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.paperRaised,
          borderColor: palette.paperMuted,
          opacity: pressed ? 0.88 : 1,
          transform: pressed ? [{ scale: 0.97 }] : undefined,
        },
      ]}
    >
      <View style={styles.createTopMedia}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.createFallbackBg,
              { backgroundColor: palette.indigoTint },
            ]}
          >
            <Text style={{ fontSize: 36, fontWeight: '800', color: palette.indigo }}>
              {initial}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.createBottomBar, { backgroundColor: palette.paperRaised }]}>
        <View style={[styles.plusCircle, { backgroundColor: palette.indigo, borderColor: palette.paperRaised }]}>
          <Ionicons name="add" size={20} color={palette.onPrimary} />
        </View>
        <Text style={[styles.createLabel, { color: palette.ink }]} numberOfLines={1}>
          Tạo tin
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * Facebook-Exact 9:16 Vertical Story Card (`112 × 192`).
 * Renders the full photo or video first-frame thumbnail crisp edge-to-edge,
 * with author's circular ringed avatar in top-left, video badge in top-right, and name over bottom gradient.
 */
export const StoryCard916 = memo(function StoryCard916({
  story,
  seen,
  onPress,
}: {
  story: ScholarStory;
  seen: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const thumb = story.thumbnailUri || story.imageUri || null;
  const isVideo = story.mediaType === 'video' || Boolean(story.videoUri);
  const initial = (story.authorName.trim()[0] || 'S').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem tin của ${story.authorName}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: story.gradient[0],
          borderColor: seen ? palette.paperMuted : palette.indigo,
          opacity: pressed ? 0.9 : 1,
          transform: pressed ? [{ scale: 0.97 }] : undefined,
        },
        !thumb && Platform.OS === 'web'
          ? ({
              backgroundImage: `linear-gradient(160deg, ${story.gradient[0]} 0%, ${story.gradient[1]} 100%)`,
            } as unknown as ViewStyle)
          : undefined,
      ]}
    >
      {/* Full-bleed Photo or Video First-Frame Thumbnail */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={styles.textOnlyCenter}>
          <Text style={styles.textOnlyQuote} numberOfLines={4}>
            {story.text}
          </Text>
        </View>
      )}

      {/* Subtle Top & Bottom Scrims for crisp readability over bright photos/videos */}
      <View
        pointerEvents="none"
        style={[
          styles.scrimOverlay,
          Platform.OS === 'web'
            ? ({
                backgroundImage:
                  'linear-gradient(180deg, rgba(2,6,23,0.42) 0%, rgba(2,6,23,0.04) 40%, rgba(2,6,23,0.82) 100%)',
              } as unknown as ViewStyle)
            : { backgroundColor: 'rgba(2, 6, 23, 0.24)' },
        ]}
      />

      {/* Top Row: Facebook Blue Ringed Avatar + Optional Video Pill */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: seen ? palette.paperMuted : palette.indigo,
            },
          ]}
        >
          {story.authorAvatar ? (
            <Image source={{ uri: story.authorAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: palette.indigo }]}>
              <Text style={{ color: palette.onPrimary, fontSize: 12, fontWeight: '900' }}>{initial}</Text>
            </View>
          )}
        </View>

        {isVideo ? (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' }}>
              {story.durationSec ? `${story.durationSec}s` : 'Video'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Author Name & Optional Short Caption */}
      <View style={styles.bottomMeta}>
        {thumb && story.text ? (
          <Text style={styles.microCaption} numberOfLines={1}>
            {story.text}
          </Text>
        ) : null}
        <Text style={styles.authorLabel} numberOfLines={1}>
          {story.authorName}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 112,
    height: 194,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    justifyContent: 'space-between',
    position: 'relative',
  },
  createTopMedia: {
    width: '100%',
    height: 128,
    position: 'relative',
    overflow: 'hidden',
  },
  createFallbackBg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBottomBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingHorizontal: 6,
    position: 'relative',
  },
  plusCircle: {
    position: 'absolute',
    top: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrimOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  textOnlyCenter: {
    position: 'absolute',
    top: 44,
    left: 8,
    right: 8,
    bottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textOnlyQuote: {
    color: '#FFFFFF',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 8,
    zIndex: 2,
  },
  avatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    padding: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
  },
  bottomMeta: {
    paddingHorizontal: 8,
    paddingBottom: 9,
    gap: 2,
    zIndex: 2,
  },
  microCaption: {
    color: 'rgba(226, 232, 240, 0.92)',
    fontSize: 10,
    fontWeight: '600',
  },
  authorLabel: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
