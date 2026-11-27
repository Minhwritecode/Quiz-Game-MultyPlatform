import { memo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import type { ReactionKey, ThreadPost } from '../domain/models';
import { Badge, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

const REACTION_META: Array<{ key: ReactionKey; emoji: string; label: string }> = [
  { key: 'heart', emoji: '❤️', label: 'Thích' },
  { key: 'bulb', emoji: '💡', label: 'Hữu ích' },
  { key: 'fire', emoji: '🔥', label: 'Đỉnh' },
  { key: 'clap', emoji: '👏', label: 'Cảm ơn' },
];

export const ThreadPostCard = memo(function ThreadPostCard({
  post,
  viewerId,
  isFollowing,
  onToggleFollow,
  onReact,
  onVotePoll,
  onToggleBookmark,
  onToggleRepost,
  onComment,
  onOpenQuiz,
  onShareToChat,
}: {
  post: ThreadPost;
  viewerId: string;
  isFollowing: boolean;
  onToggleFollow: (authorId: string) => void;
  onReact: (postId: string, key: ReactionKey) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onToggleBookmark: (postId: string) => void;
  onToggleRepost: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onOpenQuiz: (setId: string) => void;
  onShareToChat?: (post: ThreadPost) => void;
}) {
  const palette = usePalette();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');

  const bookmarked = post.bookmarkedByIds.includes(viewerId);
  const reposted = post.repostedByIds.includes(viewerId);

  const totalPollVotes = post.poll
    ? post.poll.options.reduce((sum, o) => sum + o.voterIds.length, 0)
    : 0;

  return (
    <Card style={styles.postCard}>
      {/* Top Author Row (Facebook + Threads style) */}
      <View style={styles.authorRow}>
        <View style={[styles.avatarCircle, { backgroundColor: palette.indigo }]}>
          {post.authorAvatar ? (
            <Image source={{ uri: post.authorAvatar }} style={styles.avatarImg} />
          ) : (
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>
              {(post.authorName[0] || 'H').toUpperCase()}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]} numberOfLines={1}>
              {post.authorName}
            </Text>
            <Badge tone="primary">Lv.{post.authorLevel}</Badge>
            {post.templateBadge ? <Badge tone="reward">{post.templateBadge}</Badge> : null}
          </View>
          <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11.5 }]} numberOfLines={1}>
            {post.authorHandle} · {post.authorRoleBadge || 'Học giả Papyrus'} ·{' '}
            {new Date(post.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {post.authorId !== viewerId && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onToggleFollow(post.authorId)}
            style={[
              styles.followBtn,
              {
                backgroundColor: isFollowing ? palette.paperMuted : palette.indigoTint,
                borderColor: isFollowing ? palette.paperMuted : palette.indigo,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '800',
                color: isFollowing ? palette.inkMuted : palette.indigoDeep,
              }}
            >
              {isFollowing ? 'Đang theo dõi' : '+ Theo dõi'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Connected Multi-Part Threads Chain with Signature Vertical Timeline Rail */}
      <View style={{ marginTop: spacing.sm }}>
        {post.threadParts.map((part, idx) => {
          const hasNext = idx < post.threadParts.length - 1;
          return (
            <View key={idx} style={styles.threadPartRow}>
              {post.threadParts.length > 1 && (
                <View style={styles.threadRailCol}>
                  <View
                    style={[
                      styles.threadStepNode,
                      { backgroundColor: idx === 0 ? palette.indigo : palette.paperMuted },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 9.5,
                        fontWeight: '900',
                        color: idx === 0 ? '#FFFFFF' : palette.ink,
                      }}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  {hasNext && (
                    <View style={[styles.threadRailLine, { backgroundColor: palette.indigoBorder }]} />
                  )}
                </View>
              )}
              <View style={{ flex: 1, paddingBottom: hasNext ? 12 : 4 }}>
                <Text
                  style={[
                    typography.body,
                    {
                      color: palette.ink,
                      fontWeight: idx === 0 && post.threadParts.length > 1 ? '700' : '500',
                      lineHeight: 22,
                    },
                  ]}
                >
                  {part}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Optional Photo Attachment */}
      {post.imageUri ? (
        <Image source={{ uri: post.imageUri }} style={styles.postPhoto} resizeMode="cover" />
      ) : null}

      {/* Optional Code Block */}
      {post.codeSnippet ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{post.codeSnippet}</Text>
        </View>
      ) : null}

      {/* Optional Interactive Poll */}
      {post.poll ? (
        <View style={[styles.pollBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
          <Text style={[typography.caption, { color: palette.ink, fontWeight: '800', marginBottom: 6 }]}>
            📊 {post.poll.question} ({totalPollVotes} lượt bình chọn)
          </Text>
          {post.poll.options.map((opt) => {
            const pct = totalPollVotes > 0 ? Math.round((opt.voterIds.length / totalPollVotes) * 100) : 0;
            const voted = opt.voterIds.includes(viewerId);
            return (
              <Pressable
                key={opt.id}
                onPress={() => onVotePoll(post.id, opt.id)}
                style={[
                  styles.pollOption,
                  { borderColor: voted ? palette.indigo : palette.paperMuted },
                ]}
              >
                <View
                  style={[
                    styles.pollFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: voted ? palette.indigoTint : palette.paperMuted,
                    },
                  ]}
                />
                <View style={styles.pollOptionRow}>
                  <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                    {voted ? '✓ ' : ''}
                    {opt.text}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>{pct}%</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Optional Embedded Playable Quiz Set Card */}
      {post.attachedQuiz ? (
        <Pressable
          onPress={() => onOpenQuiz(post.attachedQuiz!.setId)}
          style={[styles.quizEmbed, { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder }]}
        >
          <AppIcon name="school" size={22} color={palette.indigo} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.caption, { color: palette.indigoDeep, fontWeight: '900' }]} numberOfLines={1}>
              📜 {post.attachedQuiz.title}
            </Text>
            <Text style={{ fontSize: 11, color: palette.indigo }}>
              {post.attachedQuiz.subject} · {post.attachedQuiz.questionCount} câu hỏi · Chạm để vào ôn tập 3D!
            </Text>
          </View>
          <AppIcon name="play-circle" size={26} color={palette.indigo} />
        </Pressable>
      ) : null}

      {/* Optional Live Search Source Citation */}
      {post.sourceCitation ? (
        <Pressable
          onPress={() => void Linking.openURL(post.sourceCitation!.url)}
          style={[styles.citationBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
        >
          <AppIcon name="globe-outline" size={16} color={palette.indigo} />
          <Text style={[typography.caption, { color: palette.indigo, flex: 1, fontWeight: '700' }]} numberOfLines={1}>
            Nguồn tham khảo ({post.sourceCitation.sourceName}): {post.sourceCitation.title} ↗
          </Text>
        </Pressable>
      ) : null}

      {/* Topic Hashtags */}
      {post.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {post.tags.map((tag) => (
            <Text key={tag} style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
              #{tag}
            </Text>
          ))}
        </View>
      )}

      {/* Reaction & Threads Action Bar */}
      <View style={[styles.actionBar, { borderTopColor: palette.paperMuted }]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {REACTION_META.map((r) => {
            const count = post.reactions[r.key]?.length ?? 0;
            const active = post.reactions[r.key]?.includes(viewerId);
            return (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                onPress={() => onReact(post.id, r.key)}
                style={[
                  styles.reactChip,
                  {
                    backgroundColor: active ? palette.indigoTint : palette.paper,
                    borderColor: active ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
                {count > 0 && (
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: active ? palette.indigoDeep : palette.ink }}>
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => setCommentsOpen((o) => !o)} style={styles.iconAct}>
            <AppIcon name="chatbubble-outline" size={17} color={palette.inkMuted} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.inkMuted }}>{post.comments.length}</Text>
          </Pressable>

          <Pressable onPress={() => onToggleRepost(post.id)} style={styles.iconAct}>
            <AppIcon name="repeat" size={18} color={reposted ? palette.mint : palette.inkMuted} />
            {post.repostedByIds.length > 0 && (
              <Text style={{ fontSize: 12, fontWeight: '700', color: reposted ? palette.mint : palette.inkMuted }}>
                {post.repostedByIds.length}
              </Text>
            )}
          </Pressable>

          {onShareToChat && (
            <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ" onPress={() => onShareToChat(post)} style={styles.iconAct}>
              <AppIcon name="paper-plane-outline" size={17} color={palette.indigo} />
            </Pressable>
          )}

          <Pressable accessibilityRole="button" accessibilityLabel={bookmarked ? 'Bỏ dấu trang' : 'Đánh dấu trang'} onPress={() => onToggleBookmark(post.id)} style={styles.iconAct}>
            <AppIcon
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={bookmarked ? palette.gold : palette.inkMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* Expandable Nested Threaded Comments */}
      {commentsOpen && (
        <View style={[styles.commentsSection, { borderTopColor: palette.paperMuted }]}>
          {post.comments.map((c) => (
            <View key={c.id} style={[styles.commentItem, { backgroundColor: palette.paper }]}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>{c.authorName}</Text>
              <Text style={[typography.caption, { color: palette.ink, marginTop: 2 }]}>{c.content}</Text>
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Viết phản hồi học thuật..."
              placeholderTextColor={palette.inkMuted}
              style={[
                styles.commentInput,
                { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gửi"
              disabled={!commentDraft.trim()}
              onPress={() => {
                onComment(post.id, commentDraft);
                setCommentDraft('');
              }}
              style={[styles.sendCmtBtn, { backgroundColor: palette.indigo, opacity: commentDraft.trim() ? 1 : 0.45 }]}
            >
              <AppIcon name="send" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}
    </Card>
  );
});

const styles = StyleSheet.create({
  postCard: { marginBottom: spacing.sm, padding: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  threadPartRow: { flexDirection: 'row', gap: 10 },
  threadRailCol: { alignItems: 'center', width: 22 },
  threadStepNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadRailLine: {
    width: 2,
    flex: 1,
    marginVertical: 3,
    borderRadius: 1,
  },
  postPhoto: {
    width: '100%',
    height: 200,
    borderRadius: radii.md,
    marginTop: 8,
  },
  codeBox: {
    backgroundColor: '#0F172A',
    borderRadius: radii.sm,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  pollBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 6,
  },
  pollOption: {
    position: 'relative',
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quizEmbed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  citationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  iconAct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  commentsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  commentItem: {
    padding: 8,
    borderRadius: radii.sm,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  sendCmtBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
