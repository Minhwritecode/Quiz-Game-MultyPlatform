import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import { broadcastCommunityEvent } from '@/composition/platform';
import {
  DEFAULT_STUDY_GROUPS,
  type GroupChatMessage,
  type ReactionKey,
  type ScholarStory,
  type StudyGroupChannel,
  type ThreadPost,
} from '../domain/models';

function makeStoryPosterSvg(c1: string, c2: string, emoji: string, title: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient><radialGradient id="gl" cx="50%" cy="38%" r="52%"><stop offset="0%" stop-color="rgba(255,255,255,0.28)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect width="540" height="960" fill="url(#bg)"/><circle cx="270" cy="360" r="240" fill="url(#gl)"/><circle cx="440" cy="180" r="90" fill="rgba(255,255,255,0.08)"/><circle cx="95" cy="760" r="130" fill="rgba(0,0,0,0.16)"/><text x="50%" y="37%" dominant-baseline="middle" text-anchor="middle" font-size="112">${emoji}</text><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="34" font-weight="800">${title}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SEED_STORIES: ScholarStory[] = [
  {
    id: 'story-seed-1',
    authorId: 'scholar-khanh',
    authorName: 'Khánh Linh',
    authorAvatar: null,
    authorLevel: 12,
    text: 'Cày xong bộ Cấu trúc Dữ liệu & Giải thuật đạt 98% chính xác trên Cung Thủ 3D! 🏹🔥',
    subtext: '#StudyWithMe · Chuỗi 14 ngày',
    gradient: ['#312E81', '#7C3AED'],
    mediaType: 'image',
    imageUri: makeStoryPosterSvg('#1E1B4B', '#7C3AED', '🏹', '98% Thuật Toán 3D'),
    thumbnailUri: makeStoryPosterSvg('#1E1B4B', '#7C3AED', '🏹', '98% Thuật Toán 3D'),
    badgeLabel: '🔮 Pháp Sư Hàn Lâm',
    viewedByIds: [],
    reactions: { '🔥': ['u1', 'u2'], '❤️': ['u3'] },
    isHighlight: true,
    createdAt: '2026-11-25T01:00:00.000Z',
  },
  {
    id: 'story-seed-2',
    authorId: 'scholar-minhquan',
    authorName: 'Minh Quân',
    authorAvatar: null,
    authorLevel: 16,
    text: 'Mẹo phân biệt TCP vs UDP trong 15 giây: TCP có bắt tay 3 bước, UDP bắn tốc độ ánh sáng! ⚡',
    subtext: 'Mạng Máy Tính Đại Cương',
    gradient: ['#065F46', '#0284C7'],
    mediaType: 'image',
    imageUri: makeStoryPosterSvg('#064E3B', '#0284C7', '⚡', 'TCP vs UDP 15s'),
    thumbnailUri: makeStoryPosterSvg('#064E3B', '#0284C7', '⚡', 'TCP vs UDP 15s'),
    badgeLabel: '👑 Đại Học Sĩ',
    viewedByIds: [],
    reactions: { '👏': ['u1'] },
    isHighlight: true,
    createdAt: '2026-11-25T02:00:00.000Z',
  },
  {
    id: 'story-seed-3',
    authorId: 'scholar-haianh',
    authorName: 'Hải Anh',
    authorAvatar: null,
    authorLevel: 8,
    text: 'Ba mốc vàng Lịch sử Thế giới hiện đại không thể nhầm trước ngày thi cuối kỳ 📜✨',
    subtext: 'Lịch Sử & Văn Chương',
    gradient: ['#9A3412', '#E11D48'],
    mediaType: 'image',
    imageUri: makeStoryPosterSvg('#7C2D12', '#E11D48', '🏛️', 'Mốc Vàng Lịch Sử'),
    thumbnailUri: makeStoryPosterSvg('#7C2D12', '#E11D48', '🏛️', 'Mốc Vàng Lịch Sử'),
    badgeLabel: '⚔️ Hiệp Sĩ Tri Thức',
    viewedByIds: [],
    reactions: { '❤️': ['u1', 'u4'] },
    createdAt: '2026-11-25T02:30:00.000Z',
  },
];

const SEED_POSTS: ThreadPost[] = [
  {
    id: 'post-seed-1',
    authorId: 'scholar-khanh',
    authorName: 'Khánh Linh',
    authorHandle: '@khanhlinh.cs',
    authorAvatar: null,
    authorLevel: 12,
    authorRoleBadge: '🔮 Pháp Sư Hàn Lâm',
    templateBadge: '🔥 Giải ngố 60s',
    threadParts: [
      '90% sinh viên học thuộc lòng "Deadlock (Tắc nghẽn)", nhưng chỉ cần nhớ đúng 4 điều kiện Coffman này là giải quyết trọn vẹn mọi câu hỏi Hệ Điều Hành trong 30 giây 👇',
      '1/ Bốn điều kiện cần và đủ để xảy ra Deadlock:\n• Mutual Exclusion (Loại trừ tương hỗ)\n• Hold and Wait (Giữ và chờ tài nguyên)\n• No Preemption (Không trưng dụng)\n• Circular Wait (Chờ đợi vòng tròn)',
      '2/ Mẹo ăn điểm tuyệt đối (TL;DR): Chỉ cần PHÁ VỠ 1 trong 4 điều kiện trên (thường nhất là đánh số thứ tự tài nguyên để triệt tiêu Circular Wait) là hệ thống không bao giờ treo! Bấm làm thử bộ đề Hệ Điều Hành bên dưới nhé 🔖',
    ],
    codeSnippet:
      '// Phòng chống Circular Wait bằng thứ tự khóa tăng dần:\nlock(Math.min(resA, resB));\nlock(Math.max(resA, resB));',
    attachedQuiz: {
      setId: 'seed-uni-os-arch',
      title: 'Hệ Điều Hành & Kiến Trúc Máy Tính',
      questionCount: 8,
      subject: 'Công nghệ thông tin',
    },
    tags: ['CNTT', 'HệĐiềuHành', 'ÔnThi'],
    reactions: {
      heart: ['u1', 'u2', 'u3'],
      bulb: ['u4', 'u5'],
      fire: ['u1', 'u6'],
      clap: ['u2'],
    },
    repostedByIds: ['u3'],
    bookmarkedByIds: [],
    comments: [
      {
        id: 'cmt-1',
        authorId: 'scholar-minhquan',
        authorName: 'Minh Quân',
        authorAvatar: null,
        content: 'Chuỗi Thread quá dễ nhớ luôn! Phần đánh số thứ tự khóa mình vừa gặp y hệt trong đề thi giữa kỳ.',
        likes: 5,
        createdAt: '2026-11-25T01:45:00.000Z',
      },
    ],
    createdAt: '2026-11-25T01:15:00.000Z',
  },
  {
    id: 'post-seed-2',
    authorId: 'scholar-minhquan',
    authorName: 'Minh Quân',
    authorHandle: '@minhquan.bk',
    authorAvatar: null,
    authorLevel: 16,
    authorRoleBadge: '👑 Đại Học Sĩ Hoàng Gia',
    templateBadge: '🧩 Đố vui Phản biện',
    threadParts: [
      'Thử thách tư duy 10 giây: Cấu trúc dữ liệu nào cho độ phức tạp tìm kiếm trung bình O(1) nhưng trường hợp xấu nhất bị suy biến thành O(n)? 🧠',
      'Hãy bình chọn ngay ở Poll bên dưới trước khi xem lời giải ở bình luận nhé!',
    ],
    poll: {
      question: 'Đâu là đáp án chính xác nhất?',
      options: [
        { id: 'opt-1', text: 'Bảng băm (Hash Table) khi đụng độ chuỗi', voterIds: ['u1', 'u2', 'u4', 'u5'] },
        { id: 'opt-2', text: 'Cây Đỏ - Đen (Red-Black Tree)', voterIds: ['u3'] },
        { id: 'opt-3', text: 'Mảng tĩnh đã sắp xếp (Sorted Array)', voterIds: [] },
      ],
    },
    tags: ['CNTT', 'ThuậtToán', 'TưDuy'],
    reactions: {
      heart: ['u2'],
      bulb: ['u1', 'u3', 'u5'],
      fire: ['u4'],
      clap: [],
    },
    repostedByIds: [],
    bookmarkedByIds: [],
    comments: [],
    createdAt: '2026-11-25T02:10:00.000Z',
  },
];

const SEED_MESSAGES: GroupChatMessage[] = [
  {
    id: 'msg-pin-it',
    channelId: 'grp-it-algo',
    senderId: 'scholar-khanh',
    senderName: 'Khánh Linh',
    senderAvatar: null,
    text: '📌 Lịch ôn nhóm tối nay 21:00: Giải 20 câu Cấu trúc dữ liệu & Hệ điều hành trên Kahoot Live! Ai vào điểm danh thả 🔥 nhé.',
    reactions: { '🔥': ['u1', 'u2', 'u3'], '❤️': ['u4'] },
    createdAt: '2026-11-25T01:00:00.000Z',
  },
  {
    id: 'msg-it-2',
    channelId: 'grp-it-algo',
    senderId: 'scholar-minhquan',
    senderName: 'Minh Quân',
    senderAvatar: null,
    text: 'Mình gửi sẵn bộ đề Mạng Máy Tính & Giao Thức TCP/IP vào nhóm cho anh em khởi động trước giờ G nha!',
    quizCard: {
      setId: 'seed-uni-networks-sec',
      title: 'Mạng Máy Tính & An Toàn Thông Tin',
      questionCount: 8,
    },
    reactions: { '👍': ['u1', 'u2'] },
    createdAt: '2026-11-25T01:12:00.000Z',
  },
  {
    id: 'msg-pin-stem',
    channelId: 'grp-stem-lab',
    senderId: 'scholar-haianh',
    senderName: 'Hải Anh',
    senderAvatar: null,
    text: '📌 Tổng hợp công thức Nhiệt động lực học & Di truyền học phân tử đã ghim tại đây cho các bạn năm nhất & năm hai!',
    reactions: { '❤️': ['u1', 'u5'] },
    createdAt: '2026-11-25T01:20:00.000Z',
  },
];

interface CommunityState {
  stories: ScholarStory[];
  posts: ThreadPost[];
  channels: StudyGroupChannel[];
  messages: GroupChatMessage[];
  followingAuthorIds: string[];

  addStory: (story: Omit<ScholarStory, 'id' | 'viewedByIds' | 'reactions' | 'createdAt'>) => ScholarStory;
  markStoryViewed: (storyId: string, viewerId: string) => void;
  reactToStory: (storyId: string, emoji: string, viewerId: string) => void;

  addPost: (
    post: Omit<
      ThreadPost,
      'id' | 'reactions' | 'repostedByIds' | 'bookmarkedByIds' | 'comments' | 'createdAt'
    >
  ) => ThreadPost;
  togglePostReaction: (postId: string, key: ReactionKey, userId: string) => void;
  votePostPoll: (postId: string, optionId: string, userId: string) => void;
  toggleBookmarkPost: (postId: string, userId: string) => void;
  toggleRepost: (postId: string, userId: string) => void;
  addComment: (postId: string, author: { id: string; name: string; avatar: string | null }, content: string) => void;
  toggleFollowAuthor: (authorId: string) => void;

  createStudyGroup: (input: { name: string; subtitle: string; topic: string; accentColor: string }) => StudyGroupChannel;
  ensureDirectChannel: (peer: { id: string; name: string }) => StudyGroupChannel;
  sendGroupMessage: (
    msg: Omit<GroupChatMessage, 'id' | 'reactions' | 'createdAt'>
  ) => GroupChatMessage;
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
      stories: SEED_STORIES,
      posts: SEED_POSTS,
      channels: DEFAULT_STUDY_GROUPS,
      messages: SEED_MESSAGES,
      followingAuthorIds: ['scholar-khanh', 'scholar-minhquan'],

      addStory: (input) => {
        const story: ScholarStory = {
          ...input,
          id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          viewedByIds: [input.authorId],
          reactions: {},
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ stories: [story, ...state.stories].slice(0, 50) }));
        broadcastCommunityEvent({ type: 'new-story', story });
        return story;
      },

      markStoryViewed: (storyId, viewerId) => {
        set((state) => ({
          stories: state.stories.map((s) =>
            s.id === storyId && !s.viewedByIds.includes(viewerId)
              ? { ...s, viewedByIds: [...s.viewedByIds, viewerId] }
              : s
          ),
        }));
      },

      reactToStory: (storyId, emoji, viewerId) => {
        set((state) => ({
          stories: state.stories.map((s) => {
            if (s.id !== storyId) return s;
            const prev = s.reactions[emoji] ?? [];
            const next = prev.includes(viewerId) ? prev : [...prev, viewerId];
            return { ...s, reactions: { ...s.reactions, [emoji]: next } };
          }),
        }));
      },

      addPost: (input) => {
        const post: ThreadPost = {
          ...input,
          id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          name: `💬 ${peer.name}`,
          subtitle: 'Tin nhắn trực tiếp 1-1 · Bảo mật & Tức thì',
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
        const msg: GroupChatMessage = {
          ...input,
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          reactions: {},
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ messages: [...state.messages, msg].slice(-300) }));
        broadcastCommunityEvent({ type: 'new-message', message: msg });
        return msg;
      },

      toggleMessageReaction: (messageId, emoji, userId) => {
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
          return { stories: [story, ...state.stories].slice(0, 50) };
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
    }
  )
);
