import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import { broadcastCommunityEvent } from '@/composition/platform';
import {
  deleteStoryFromSupabase,
  generateClientUuid,
  persistStoryToSupabase,
  syncStoryEngagementToSupabase,
  updateStoryPinInSupabase,
} from '@/composition/social';
import {
  DEFAULT_STUDY_GROUPS,
  STORY_TTL_MS,
  type GroupChatMessage,
  type ReactionKey,
  type ScholarStory,
  type StudyGroupChannel,
  type ThreadPost,
} from '../domain/models';

const LEGACY_SEED_STORY_IDS = new Set(['story-seed-1', 'story-seed-2', 'story-seed-3']);
const LEGACY_SEED_POST_IDS = new Set(['post-seed-1', 'post-seed-2']);
const LEGACY_SEED_MSG_IDS = new Set(['msg-pin-it', 'msg-it-2', 'msg-pin-stem']);
const LEGACY_FAKE_USER_IDS = new Set([
  'scholar-khanh',
  'scholar-minhquan',
  'scholar-haianh',
  'scholar-baonam',
]);

interface CommunityState {
  stories: ScholarStory[];
  posts: ThreadPost[];
  channels: StudyGroupChannel[];
  messages: GroupChatMessage[];
  followingAuthorIds: string[];

  addStory: (
    story: Omit<ScholarStory, 'id' | 'viewedByIds' | 'reactions' | 'createdAt'>
  ) => ScholarStory | null;
  markStoryViewed: (storyId: string, viewerId: string) => void;
  reactToStory: (storyId: string, emoji: string, viewerId: string) => void;
  togglePinStoryOnProfile: (storyId: string, ownerId: string) => boolean;
  deleteStory: (storyId: string, ownerId: string) => void;
  mergeCloudStories: (remoteStories: ScholarStory[]) => void;

  addPost: (
    post: Omit<
      ThreadPost,
      'id' | 'reactions' | 'repostedByIds' | 'bookmarkedByIds' | 'comments' | 'createdAt'
    >
  ) => ThreadPost | null;
  togglePostReaction: (postId: string, key: ReactionKey, userId: string) => void;
  votePostPoll: (postId: string, optionId: string, userId: string) => void;
  toggleBookmarkPost: (postId: string, userId: string) => void;
  toggleRepost: (postId: string, userId: string) => void;
  addComment: (
    postId: string,
    author: { id: string; name: string; avatar: string | null },
    content: string
  ) => void;
  toggleFollowAuthor: (authorId: string) => void;

  createStudyGroup: (input: {
    name: string;
    subtitle: string;
    topic: string;
    accentColor: string;
  }) => StudyGroupChannel;
  ensureDirectChannel: (peer: { id: string; name: string }) => StudyGroupChannel;
  sendGroupMessage: (
    msg: Omit<GroupChatMessage, 'id' | 'reactions' | 'createdAt'>
  ) => GroupChatMessage | null;
  toggleMessageReaction: (messageId: string, emoji: string, userId: string) => void;
  voteGroupPoll: (messageId: string, optionId: string, userId: string) => void;
  pinChannelMessage: (channelId: string, messageId: string | null) => void;

  ingestRealtimePost: (post: ThreadPost) => void;
  ingestRealtimeStory: (story: ScholarStory) => void;
  ingestRealtimeMessage: (message: GroupChatMessage) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      stories: [],
      posts: [],
      channels: DEFAULT_STUDY_GROUPS,
      messages: [],
      followingAuthorIds: [],

      addStory: (input) => {
        if (!input.authorId || input.authorId === 'guest') return null;
        const now = Date.now();
        const createdAt = new Date(now).toISOString();
        const expiresAt = new Date(now + STORY_TTL_MS).toISOString();
        const pinned = Boolean(input.pinnedOnProfile ?? input.isHighlight);
        const story: ScholarStory = {
          ...input,
          id: generateClientUuid(),
          isHighlight: pinned,
          pinnedOnProfile: pinned,
          viewedByIds: [],
          reactions: {},
          expiresAt,
          createdAt,
        };
        set((state) => ({ stories: [story, ...state.stories].slice(0, 80) }));
        void persistStoryToSupabase(story);
        broadcastCommunityEvent({ type: 'new-story', story });
        return story;
      },

      markStoryViewed: (storyId, viewerId) => {
        if (!viewerId || viewerId === 'guest') return;
        const target = get().stories.find((s) => s.id === storyId);
        if (!target || target.authorId === viewerId) return;
        const currentViewed = Array.isArray(target.viewedByIds) ? target.viewedByIds : [];
        if (currentViewed.includes(viewerId)) return;
        const nextViewed = [...currentViewed, viewerId];
        const currentReactions =
          target.reactions && typeof target.reactions === 'object' ? target.reactions : {};
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === storyId
              ? {
                  ...s,
                  viewedByIds: nextViewed,
                }
              : s
          ),
        }));
        if (typeof syncStoryEngagementToSupabase === 'function') {
          void syncStoryEngagementToSupabase(storyId, nextViewed, currentReactions);
        }
      },

      reactToStory: (storyId, emoji, viewerId) => {
        if (!viewerId || viewerId === 'guest') return;
        let syncedViewed: string[] | null = null;
        let syncedReactions: Record<string, string[]> | null = null;
        set((state) => ({
          stories: state.stories.map((s) => {
            if (s.id !== storyId) return s;
            const currentReactions =
              s.reactions && typeof s.reactions === 'object' ? s.reactions : {};
            const prev = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji]! : [];
            const next = prev.includes(viewerId)
              ? prev.filter((id) => id !== viewerId)
              : [...prev, viewerId];
            const nextReactions = { ...currentReactions, [emoji]: next };
            syncedViewed = Array.isArray(s.viewedByIds) ? s.viewedByIds : [];
            syncedReactions = nextReactions;
            return { ...s, reactions: nextReactions };
          }),
        }));
        if (syncedViewed && syncedReactions && typeof syncStoryEngagementToSupabase === 'function') {
          void syncStoryEngagementToSupabase(storyId, syncedViewed, syncedReactions);
        }
      },

      togglePinStoryOnProfile: (storyId, ownerId) => {
        if (!ownerId || ownerId === 'guest') return false;
        let nextPinned = false;
        set((state) => ({
          stories: state.stories.map((s) => {
            if (s.id !== storyId || s.authorId !== ownerId) return s;
            nextPinned = !Boolean(s.pinnedOnProfile ?? s.isHighlight);
            return { ...s, pinnedOnProfile: nextPinned, isHighlight: nextPinned };
          }),
        }));
        void updateStoryPinInSupabase(storyId, nextPinned);
        return nextPinned;
      },

      deleteStory: (storyId, ownerId) => {
        if (!ownerId || ownerId === 'guest') return;
        set((state) => ({
          stories: state.stories.filter(
            (s) => !(s.id === storyId && (s.authorId === ownerId || ownerId === 'admin'))
          ),
        }));
        void deleteStoryFromSupabase(storyId);
      },

      mergeCloudStories: (remoteStories) => {
        if (remoteStories.length === 0) return;
        set((state) => {
          const map = new Map<string, ScholarStory>();
          for (const local of state.stories) {
            if (!LEGACY_SEED_STORY_IDS.has(local.id) && !LEGACY_FAKE_USER_IDS.has(local.authorId)) {
              map.set(local.id, local);
            }
          }
          for (const rem of remoteStories) {
            const existing = map.get(rem.id);
            map.set(
              rem.id,
              existing
                ? {
                  ...existing,
                  ...rem,
                  // Preserve local blob video URI during the active browser session if present
                  videoUri: rem.videoUri || existing.videoUri || null,
                  thumbnailUri: rem.thumbnailUri || existing.thumbnailUri || null,
                }
                : rem
            );
          }
          return {
            stories: Array.from(map.values()).sort(
              (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            ),
          };
        });
      },

      addPost: (input) => {
        if (!input.authorId || input.authorId === 'guest') return null;
        const post: ThreadPost = {
          ...input,
          id: generateClientUuid(),
          reactions: { heart: [], bulb: [], fire: [], clap: [] },
          repostedByIds: [],
          bookmarkedByIds: [],
          comments: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ posts: [post, ...state.posts].slice(0, 120) }));
        broadcastCommunityEvent({ type: 'new-post', post });
        return post;
      },

      togglePostReaction: (postId, key, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            const arr = p.reactions[key] ?? [];
            const next = arr.includes(userId) ? arr.filter((id) => id !== userId) : [...arr, userId];
            return { ...p, reactions: { ...p.reactions, [key]: next } };
          }),
        }));
      },

      votePostPoll: (postId, optionId, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId || !p.poll) return p;
            return {
              ...p,
              poll: {
                ...p.poll,
                options: p.poll.options.map((opt) => ({
                  ...opt,
                  voterIds:
                    opt.id === optionId
                      ? opt.voterIds.includes(userId)
                        ? opt.voterIds
                        : [...opt.voterIds, userId]
                      : opt.voterIds.filter((id) => id !== userId),
                })),
              },
            };
          }),
        }));
      },

      toggleBookmarkPost: (postId, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.bookmarkedByIds.includes(userId);
            return {
              ...p,
              bookmarkedByIds: has
                ? p.bookmarkedByIds.filter((id) => id !== userId)
                : [...p.bookmarkedByIds, userId],
            };
          }),
        }));
      },

      toggleRepost: (postId, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          posts: state.posts.map((p) => {
            if (p.id !== postId) return p;
            const has = p.repostedByIds.includes(userId);
            return {
              ...p,
              repostedByIds: has
                ? p.repostedByIds.filter((id) => id !== userId)
                : [...p.repostedByIds, userId],
            };
          }),
        }));
      },

      addComment: (postId, author, content) => {
        if (!author.id || author.id === 'guest') return;
        const clean = content.trim();
        if (!clean) return;
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id !== postId
              ? p
              : {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    authorId: author.id,
                    authorName: author.name,
                    authorAvatar: author.avatar,
                    content: clean,
                    likes: 0,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
          ),
        }));
      },

      toggleFollowAuthor: (authorId) => {
        set((state) => ({
          followingAuthorIds: state.followingAuthorIds.includes(authorId)
            ? state.followingAuthorIds.filter((id) => id !== authorId)
            : [...state.followingAuthorIds, authorId],
        }));
      },

      createStudyGroup: (input) => {
        const grp: StudyGroupChannel = {
          id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: input.name.trim() || 'Nhóm Học Tập Mới',
          subtitle: input.subtitle.trim() || 'Trao đổi kiến thức & chia sẻ đề ôn tập',
          topic: input.topic.trim() || 'Tổng hợp',
          icon: 'people',
          accentColor: input.accentColor || '#6366F1',
          memberCount: 1,
          pinnedMessageId: null,
        };
        set((state) => ({ channels: [grp, ...state.channels] }));
        return grp;
      },

      ensureDirectChannel: (peer) => {
        const existing = get().channels.find((c) => c.isDirect && c.peerUserId === peer.id);
        if (existing) return existing;
        const dm: StudyGroupChannel = {
          id: `dm-${peer.id.slice(0, 12)}`,
          name: peer.name,
          subtitle: 'Tin nhắn trực tiếp',
          topic: '1-1 Chat',
          icon: 'chatbubble-ellipses',
          accentColor: '#06B6D4',
          isDirect: true,
          peerUserId: peer.id,
          memberCount: 2,
          pinnedMessageId: null,
        };
        set((state) => ({ channels: [dm, ...state.channels] }));
        return dm;
      },

      sendGroupMessage: (input) => {
        if (!input.senderId || input.senderId === 'guest') return null;
        const msg: GroupChatMessage = {
          ...input,
          id: generateClientUuid(),
          reactions: {},
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ messages: [...state.messages, msg].slice(-300) }));
        broadcastCommunityEvent({ type: 'new-message', message: msg });
        return msg;
      },

      toggleMessageReaction: (messageId, emoji, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId) return m;
            const prev = m.reactions[emoji] ?? [];
            const next = prev.includes(userId)
              ? prev.filter((id) => id !== userId)
              : [...prev, userId];
            return { ...m, reactions: { ...m.reactions, [emoji]: next } };
          }),
        }));
      },

      voteGroupPoll: (messageId, optionId, userId) => {
        if (!userId || userId === 'guest') return;
        set((state) => ({
          messages: state.messages.map((m) => {
            if (m.id !== messageId || !m.poll) return m;
            return {
              ...m,
              poll: {
                ...m.poll,
                options: m.poll.options.map((opt) => ({
                  ...opt,
                  voterIds:
                    opt.id === optionId
                      ? opt.voterIds.includes(userId)
                        ? opt.voterIds
                        : [...opt.voterIds, userId]
                      : opt.voterIds.filter((id) => id !== userId),
                })),
              },
            };
          }),
        }));
      },

      pinChannelMessage: (channelId, messageId) => {
        set((state) => ({
          channels: state.channels.map((c) =>
            c.id === channelId ? { ...c, pinnedMessageId: messageId } : c
          ),
        }));
      },

      ingestRealtimePost: (post) => {
        set((state) => {
          if (state.posts.some((p) => p.id === post.id)) return state;
          return { posts: [post, ...state.posts].slice(0, 120) };
        });
      },

      ingestRealtimeStory: (story) => {
        set((state) => {
          if (state.stories.some((s) => s.id === story.id)) return state;
          return { stories: [story, ...state.stories].slice(0, 80) };
        });
      },

      ingestRealtimeMessage: (message) => {
        set((state) => {
          if (state.messages.some((m) => m.id === message.id)) return state;
          return { messages: [...state.messages, message].slice(-300) };
        });
      },
    }),
    {
      name: 'papyrus.community.v1',
      storage: createJSONStorage(() => preferenceStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<CommunityState> | undefined) ?? {};
        // Strip legacy fake seed stories/posts/messages while preserving 100% of real user content!
        const cleanStories = (persisted.stories ?? [])
          .filter(
            (s) =>
              Boolean(s && s.id) &&
              !LEGACY_SEED_STORY_IDS.has(s.id) &&
              !LEGACY_FAKE_USER_IDS.has(s.authorId) &&
              s.authorId !== 'guest'
          )
          .map((s) => {
            const rawGrad = Array.isArray(s.gradient) ? s.gradient : [];
            const g0 = typeof rawGrad[0] === 'string' && rawGrad[0] ? rawGrad[0] : '#312E81';
            const g1 = typeof rawGrad[1] === 'string' && rawGrad[1] ? rawGrad[1] : '#7C3AED';
            const cleanVideoUri =
              typeof s.videoUri === 'string' && !s.videoUri.startsWith('blob:')
                ? s.videoUri
                : null;
            const cleanImageUri =
              typeof s.imageUri === 'string' && !s.imageUri.startsWith('blob:')
                ? s.imageUri
                : null;
            const cleanThumbUri =
              typeof s.thumbnailUri === 'string' && !s.thumbnailUri.startsWith('blob:')
                ? s.thumbnailUri
                : cleanImageUri;
            return {
              ...s,
              authorName: s.authorName || 'Thành viên Papyrus',
              text: typeof s.text === 'string' ? s.text : '',
              subtext: typeof s.subtext === 'string' ? s.subtext : '',
              gradient: [g0, g1] as [string, string],
              videoUri: cleanVideoUri,
              imageUri: cleanImageUri,
              thumbnailUri: cleanThumbUri,
              viewedByIds: Array.isArray(s.viewedByIds)
                ? s.viewedByIds.filter((uid) => uid && uid !== s.authorId && uid !== 'guest')
                : [],
              reactions:
                s.reactions && typeof s.reactions === 'object' && !Array.isArray(s.reactions)
                  ? s.reactions
                  : {},
              pinnedOnProfile: s.pinnedOnProfile ?? Boolean(s.isHighlight),
            };
          });
        const cleanPosts = (persisted.posts ?? []).filter(
          (p) =>
            !LEGACY_SEED_POST_IDS.has(p.id) &&
            !LEGACY_FAKE_USER_IDS.has(p.authorId) &&
            p.authorId !== 'guest'
        );
        const cleanMessages = (persisted.messages ?? []).filter(
          (m) =>
            !LEGACY_SEED_MSG_IDS.has(m.id) &&
            !LEGACY_FAKE_USER_IDS.has(m.senderId) &&
            m.senderId !== 'guest'
        );
        const cleanFollows = (persisted.followingAuthorIds ?? []).filter(
          (id) => !LEGACY_FAKE_USER_IDS.has(id)
        );
        return {
          ...currentState,
          ...persisted,
          stories: cleanStories,
          posts: cleanPosts,
          messages: cleanMessages,
          followingAuthorIds: cleanFollows,
        };
      },
    }
  )
);
