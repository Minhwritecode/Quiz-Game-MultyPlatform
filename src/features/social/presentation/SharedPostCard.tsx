import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { SharedPostReference } from '../domain/models';
import { useSocialStore } from '../state/useSocialStore';
import { canViewerAccessPost, projectSafePostForViewer } from '../domain/rankingAndPermissions';

/**
 * Reusable Permission-Aware `SharedPostCard` (Section 8.5):
 * Used across Community Feed, Quote Posts, Direct Messages, and Group Chats.
 * NEVER displays a raw text snippet or raw URL — and re-verifies live post permissions
 * so deleted, expired Ghost, or private posts never leak!
 */
export const SharedPostCard = memo(function SharedPostCard({
  reference,
  postId,
  viewerId,
}: {
  reference?: SharedPostReference | null;
  postId?: string | null;
  viewerId: string;
}) {
  const palette = usePalette();
  const router = useRouter();

  const targetId = postId || reference?.postId || '';
  const livePost = useSocialStore((s) => s.posts.find((p) => p.id === targetId));
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const communities = useSocialStore((s) => s.communities);

  const graph = { follows, friendRequests, relations, communities };
  const accessible = livePost ? canViewerAccessPost(livePost, viewerId, graph) : false;

  if (!livePost || !accessible) {
    return (
      <View style={[styles.unavailableCard, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
        <Ionicons name="lock-closed-outline" size={18} color={palette.inkMuted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.caption, { color: palette.ink, fontWeight: '800' }]}>
            Nội dung không khả dụng
          </Text>
          <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
            Bài viết gốc đã hết hạn, bị xóa hoặc giới hạn quyền xem riêng tư.
          </Text>
        </View>
      </View>
    );
  }

  const safePost = projectSafePostForViewer(livePost, viewerId, false);
  const firstMedia = safePost.mediaItems[0];
  const coverUri = firstMedia?.thumbnailUri || firstMedia?.uri || reference?.thumbnailUri || null;
  const isVideo = firstMedia?.kind === 'video' || reference?.mediaKind === 'video';
  const previewCopy = safePost.isSpoiler
    ? `⚠️ Nội dung có cảnh báo Spoiler (${safePost.spoilerWarning || 'Chạm để mở bài viết gốc'})`
    : safePost.threadParts[0] || safePost.longFormBody || reference?.previewText || '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở bài viết của ${safePost.authorName}`}
      onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: safePost.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.paper,
          borderColor: palette.indigoBorder,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Author Header */}
      <View style={styles.authorRow}>
        <Pressable
          disabled={safePost.isAnonymous}
          onPress={(e) => {
            e.stopPropagation();
            if (!safePost.isAnonymous) {
              router.push({ pathname: '/user/[userId]', params: { userId: safePost.authorId } });
            }
          }}
          style={styles.authorHit}
        >
          {safePost.authorAvatar ? (
            <Image source={{ uri: safePost.authorAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: palette.indigo }]}>
              <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>
                {(safePost.authorName[0] || 'P').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink, flexShrink: 1 }} numberOfLines={1}>
            {safePost.authorName}
          </Text>
        </Pressable>

        <Badge tone="neutral">
          {safePost.postKind === 'thread'
            ? 'Chuỗi Thread'
            : safePost.postKind === 'debate'
            ? 'Tranh biện'
            : safePost.postKind === 'ghost'
            ? 'Ghost 24h'
            : 'Bài viết'}
        </Badge>
      </View>

      {/* Rich Text Preview */}
      <Text
        style={[
          typography.caption,
          {
            color: safePost.isSpoiler ? palette.gold : palette.ink,
            marginTop: 6,
            lineHeight: 18,
            fontStyle: safePost.isSpoiler ? 'italic' : 'normal',
          },
        ]}
        numberOfLines={3}
      >
        {previewCopy}
      </Text>

      {/* Video Cover / Photo Preview (hidden when Spoiler!) */}
      {!safePost.isSpoiler && coverUri ? (
        <View style={styles.mediaWrap}>
          <Image source={{ uri: coverUri }} style={styles.mediaImg} resizeMode="cover" />
          {isVideo && (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' }}>
                Video{firstMedia?.durationSec ? ` · ${firstMedia.durationSec}s` : ''}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Metadata Footer */}
      <View style={styles.metaFooter}>
        <Text style={{ fontSize: 11, color: palette.inkMuted }}>
          {new Date(safePost.createdAt).toLocaleDateString('vi-VN')} · 💬 {safePost.comments.length} phản hồi
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>Xem bài gốc</Text>
          <Ionicons name="arrow-forward" size={12} color={palette.indigo} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: 6,
  },
  unavailableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  authorHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  avatarImg: { width: 24, height: 24, borderRadius: 12 },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWrap: {
    marginTop: 8,
    width: '100%',
    height: 140,
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  mediaImg: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  metaFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
