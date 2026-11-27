import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/shared/AppIcon';
import { Text, View } from 'react-native';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import {
  canViewerAccessPost,
  isFollowingAccepted,
  projectSafePostForViewer,
} from '@/features/social/domain/rankingAndPermissions';
import type { SocialPostItem } from '@/features/social/domain/models';
import { MetaThreadsPostCard } from '@/features/social/presentation/MetaThreadsPostCard';
import { AdvancedThreadComposerModal } from '@/features/social/presentation/AdvancedThreadComposerModal';

/**
 * Deep-Link Post Detail Page (`/post/[postId]`) — Section 6.5 & 8.5:
 * Renders exact target Post/Thread or a clean Content Unavailable state if deleted, expired, or private!
 */
export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName ?? 'Khách';

  const posts = useSocialStore((s) => s.posts);
  const profilesById = useSocialStore((s) => s.profilesById);
  const follows = useSocialStore((s) => s.follows);
  const friendRequests = useSocialStore((s) => s.friendRequests);
  const relations = useSocialStore((s) => s.relations);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const userSlices = useSocialStore((s) => s.userSlices);

  const toggleFollowUser = useSocialStore((s) => s.toggleFollowUser);
  const togglePostEmojiReaction = useSocialStore((s) => s.togglePostEmojiReaction);
  const togglePureRepost = useSocialStore((s) => s.togglePureRepost);
  const toggleSaveBookmark = useSocialStore((s) => s.toggleSaveBookmark);
  const toggleFavouritePost = useSocialStore((s) => s.toggleFavouritePost);
  const togglePinPost = useSocialStore((s) => s.togglePinPost);
  const editSocialPost = useSocialStore((s) => s.editSocialPost);
  const deleteOrArchivePost = useSocialStore((s) => s.deleteOrArchivePost);
  const summarizePostWithAi = useSocialStore((s) => s.summarizePostWithAi);
  const voteUnifiedPoll = useSocialStore((s) => s.voteUnifiedPoll);
  const addUnifiedPollOption = useSocialStore((s) => s.addUnifiedPollOption);
  const toggleCloseUnifiedPoll = useSocialStore((s) => s.toggleCloseUnifiedPoll);
  const voteDebateSide = useSocialStore((s) => s.voteDebateSide);
  const addDebateArgument = useSocialStore((s) => s.addDebateArgument);
  const addThreadedReply = useSocialStore((s) => s.addThreadedReply);
  const editOrDeleteComment = useSocialStore((s) => s.editOrDeleteComment);
  const toggleCommentReaction = useSocialStore((s) => s.toggleCommentReaction);
  const togglePinComment = useSocialStore((s) => s.togglePinComment);
  const sharePostToDestination = useSocialStore((s) => s.sharePostToDestination);
  const updateYourAlgo = useSocialStore((s) => s.updateYourAlgo);
  const toggleUserRelation = useSocialStore((s) => s.toggleUserRelation);
  const submitModerationReport = useSocialStore((s) => s.submitModerationReport);
  const createSocialPost = useSocialStore((s) => s.createSocialPost);
  const saveComposerDraft = useSocialStore((s) => s.saveComposerDraft);

  const [quotingPost, setQuotingPost] = useState<SocialPostItem | null>(null);

  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);

  const slice = userSlices[viewerId];
  const graph = { follows, friendRequests, relations, communities };
  const rawPost = posts.find((p) => p.id === postId);
  const accessible = rawPost ? canViewerAccessPost(rawPost, viewerId, graph) : false;

  return (
    <Screen bottomNav>
      <TopBar title="Chi tiết bài viết" />

      {!rawPost || !accessible ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: 10 }}>
          <AppIcon name="lock-closed-outline" size={40} color={palette.inkMuted} />
          <Text style={[typography.title, { color: palette.ink }]}>Nội dung không khả dụng</Text>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}>
            Bài viết này không tồn tại, đã hết hạn sau 24 giờ, bị gỡ bỏ hoặc bạn không có quyền xem.
          </Text>
          <Button variant="secondary" icon="arrow-back" onPress={() => router.back()}>
            Quay lại
          </Button>
        </Card>
      ) : (
        <MetaThreadsPostCard
          post={projectSafePostForViewer(rawPost, viewerId, false)}
          viewerId={viewerId}
          viewerName={viewerName}
          viewerAvatar={user?.avatarUrl ?? null}
          isSavedBookmark={Boolean(slice?.bookmarkedPostIds.includes(rawPost.id))}
          isFavourited={Boolean(slice?.favouritePostIds.includes(rawPost.id))}
          isFollowingAuthor={isFollowingAccepted(viewerId, rawPost.authorId, graph)}
          profilesById={profilesById}
          graph={graph}
          collections={slice?.collections ?? []}
          conversations={conversations}
          communities={communities}
          onToggleFollow={(tid) => toggleFollowUser(viewerId, tid)}
          onReactPost={(pid, rx) => togglePostEmojiReaction(pid, rx, viewerId)}
          onTogglePureRepost={(pid) => togglePureRepost(pid, viewerId)}
          onOpenQuoteComposer={(p) => setQuotingPost(p)}
          onToggleBookmark={(pid, colId) => toggleSaveBookmark(viewerId, pid, colId)}
          onToggleFavourite={(pid) => toggleFavouritePost(viewerId, pid)}
          onTogglePin={(pid, sc) => togglePinPost(pid, sc)}
          onEditPost={(pid, parts, lf) => editSocialPost(pid, viewerId, parts, lf)}
          onDeleteOrArchive={(pid, mode) => {
            deleteOrArchivePost(pid, viewerId, mode);
            router.back();
          }}
          onSummarizeAi={summarizePostWithAi}
          onVotePoll={(pid, oid) => voteUnifiedPoll('post', pid, oid, viewerId)}
          onAddPollOption={(pid, txt) => addUnifiedPollOption('post', pid, txt, { id: viewerId, name: viewerName })}
          onToggleClosePoll={(pid) => toggleCloseUnifiedPoll('post', pid, viewerId)}
          onVoteDebate={(pid, side) => voteDebateSide(pid, side, viewerId)}
          onAddDebateArgument={(pid, side, txt) =>
            addDebateArgument(pid, side, { id: viewerId, name: viewerName, avatar: user?.avatarUrl ?? null }, txt)
          }
          onAddReply={(inp) =>
            addThreadedReply({
              ...inp,
              authorId: viewerId,
              authorName: viewerName,
              authorAvatar: user?.avatarUrl ?? null,
            })
          }
          onEditOrDeleteComment={(pid, cid, txt) => editOrDeleteComment(pid, cid, viewerId, txt)}
          onReactComment={(pid, cid, rx) => toggleCommentReaction(pid, cid, rx, viewerId)}
          onPinComment={togglePinComment}
          onShareToTarget={(p, dest, note) =>
            sharePostToDestination(p, { id: viewerId, name: viewerName, avatar: user?.avatarUrl ?? null }, dest, note)
          }
          onAlgoFeedback={(act, p) => {
            if (act === 'not_interested') {
              updateYourAlgo(viewerId, {
                notInterestedPostIds: [...(slice?.algo.notInterestedPostIds ?? []), p.id],
              });
            }
          }}
          onBlockOrMuteAuthor={(aid, kind) => toggleUserRelation(viewerId, aid, kind)}
          onReportTarget={(tType, tId, prev, ownerId) =>
            submitModerationReport({
              reporterId: viewerId,
              reporterName: viewerName,
              targetType: tType,
              targetId: tId,
              targetPreview: prev,
              targetOwnerId: ownerId,
              reason: 'Nội dung không phù hợp',
              details: 'Báo cáo từ trang chi tiết bài viết',
            })
          }
        />
      )}

      <AdvancedThreadComposerModal
        visible={Boolean(quotingPost)}
        viewerId={viewerId}
        viewerName={viewerName}
        savedDraft={null}
        quotedPost={quotingPost}
        communities={communities}
        knownUsers={Object.values(profilesById)}
        questionSets={allSets}
        onSaveDraft={(d) => saveComposerDraft(viewerId, d)}
        onClose={() => setQuotingPost(null)}
        onPublish={(payload) =>
          createSocialPost({
            ...payload,
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: user?.avatarUrl ?? null,
          })
        }
      />
    </Screen>
  );
}
