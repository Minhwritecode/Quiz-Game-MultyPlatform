import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import {
  broadcastCommunityEvent,
  fetchRealProfilesDirectory,
  generatePapyAiPostSummary,
  persistModerationCaseToSupabase,
  persistSocialPostToSupabase,
  syncUnifiedProfileToSupabase,
  triggerServerPostLifecycleSweep,
  uploadAdminDocumentToSupabase,
} from '@/composition/social';
import type {
  AdminAuditLogItem,
  AdminManagedDocument,
  BookmarkCollection,
  CommunityEventItem,
  CommunityRole,
  CustomFeedConfig,
  DirectOrGroupMessage,
  EmojiReactionType,
  FollowEdge,
  FriendRequestRecord,
  MessagingConversation,
  ModerationActionKind,
  ModerationWorkflowStatus,
  PostAudience,
  PostKind,
  ReplyPermission,
  SharedPostReference,
  SocialCommunityGroup,
  SocialMediaItem,
  SocialModerationCase,
  SocialPostItem,
  SocialUserProfile,
  ThreadedReplyItem,
  UnifiedPoll,
  UserRelationType,
  YourAlgoConfig,
} from '../domain/models';
import { areUsersFriends } from '../domain/rankingAndPermissions';

const DEFAULT_ALGO: YourAlgoConfig = {
  boostedTopics: [],
  hiddenTopics: [],
  mutedKeywords: [],
  prioritizedAccountIds: [],
  showLessAccountIds: [],
  notInterestedPostIds: [],
  knowledgeMode: false,
  activeMood: 'all',
  preferenceExpiresAt: null,
};

export interface ComposerDraftPayload {
  postKind: PostKind;
  threadParts: string[];
  longFormBody: string;
  mediaItems: SocialMediaItem[];
  topicsText: string;
  audience: PostAudience;
  replyPermission: ReplyPermission;
  communityId: string | null;
  isSpoiler: boolean;
  spoilerWarning: string;
  isAnonymous: boolean;
  locationLabel: string;
  scheduledFor: string;
  attachedSetId: string;
  codeSnippet: string;
  debateSideA: string;
  debateSideB: string;
  updatedAt: string;
}

interface ScopedUserSlice {
  draft: ComposerDraftPayload | null;
  bookmarkedPostIds: string[];
  favouritePostIds: string[];
  collections: BookmarkCollection[];
  customFeeds: CustomFeedConfig[];
  algo: YourAlgoConfig;
  dismissedRecommendationIds: string[];
  recentSearchQueries: string[];
  recentEmojisAndStickers: string[];
}

function emptyScopedSlice(ownerId: string): ScopedUserSlice {
  return {
    draft: null,
    bookmarkedPostIds: [],
    favouritePostIds: [],
    collections: [
      {
        id: `col-smart-it-${ownerId}`,
        ownerId,
        name: 'Công nghệ & AI',
        coverEmoji: '💻',
        topicRule: 'CNTT',
        isSmart: true,
        postIds: [],
        createdAt: '2026-11-25T00:00:00.000Z',
      },
      {
        id: `col-exam-${ownerId}`,
        ownerId,
        name: 'Trọng tâm Ôn thi',
        coverEmoji: '📚',
        topicRule: 'ÔnThi',
        isSmart: true,
        postIds: [],
        createdAt: '2026-11-25T00:00:00.000Z',
      },
    ],
    customFeeds: [
      {
        id: `cf-tech-${ownerId}`,
        ownerId,
        name: '⚡ Kỹ thuật Phần mềm & AI',
        topics: ['CNTT', 'AI', 'HệĐiềuHành', 'ThuậtToán'],
        accountIds: [],
        communityIds: ['comm-software-ai'],
        isPinned: true,
        isPublic: true,
        order: 0,
      },
    ],
    algo: { ...DEFAULT_ALGO },
    dismissedRecommendationIds: [],
    recentSearchQueries: [],
    recentEmojisAndStickers: ['❤️', '🔥', '👏', '💡'],
  };
}

const SEED_PROFILES: Record<string, SocialUserProfile> = {
  'scholar-khanh': {
    id: 'scholar-khanh',
    displayName: 'Khánh Linh',
    avatarUrl: null,
    coverUrl: null,
    bio: 'Kỹ sư Phần mềm & Hệ phân tán · Đam mê giải thích thuật toán dễ hiểu trong 60 giây.',
    university: 'ĐH Bách Khoa',
    major: 'Khoa học Máy tính',
    interests: ['CNTT', 'AI', 'HệĐiềuHành', 'ThuậtToán'],
    locationArea: 'TP. Hồ Chí Minh',
    websiteUrl: '',
    badges: ['Top Contributor', 'Community Champion'],
    reputationScore: 640,
    role: 'moderator',
    accountStatus: 'active',
    privacy: {
      isPrivateAccount: false,
      allowMessagesFrom: 'everyone',
      allowMentionsFrom: 'everyone',
      showOnlineStatus: true,
      showJoinedCommunities: true,
      showPersonalInfo: 'public',
      discoverableInRecommendations: true,
    },
    followersCount: 184,
    followingCount: 42,
    friendsCount: 29,
    profileViewsCount: 510,
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
  },
  'scholar-minhquan': {
    id: 'scholar-minhquan',
    displayName: 'Minh Quân',
    avatarUrl: null,
    coverUrl: null,
    bio: 'Nghiên cứu Trí tuệ Nhân tạo, Cloud Native & An toàn mạng.',
    university: 'ĐH Công Nghệ',
    major: 'Trí tuệ Nhân tạo',
    interests: ['AI', 'CNTT', 'Cloud', 'ÔnThi'],
    locationArea: 'Hà Nội',
    websiteUrl: '',
    badges: ['Helpful Member', 'Top Contributor'],
    reputationScore: 790,
    role: 'user',
    accountStatus: 'active',
    privacy: {
      isPrivateAccount: false,
      allowMessagesFrom: 'everyone',
      allowMentionsFrom: 'everyone',
      showOnlineStatus: true,
      showJoinedCommunities: true,
      showPersonalInfo: 'public',
      discoverableInRecommendations: true,
    },
    followersCount: 246,
    followingCount: 58,
    friendsCount: 34,
    profileViewsCount: 680,
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
  },
  'scholar-haianh': {
    id: 'scholar-haianh',
    displayName: 'Hải Anh',
    avatarUrl: null,
    coverUrl: null,
    bio: 'Yêu Lịch sử Thế giới, Văn chương Hiện đại & phương pháp học Spaced Repetition.',
    university: 'ĐH Khoa học Xã hội & Nhân văn',
    major: 'Lịch sử & Văn học',
    interests: ['VănSử', 'ÔnThi', 'NgoạiNgữ'],
    locationArea: 'Đà Nẵng',
    websiteUrl: '',
    badges: ['Event Participant'],
    reputationScore: 420,
    role: 'user',
    accountStatus: 'active',
    privacy: {
      isPrivateAccount: false,
      allowMessagesFrom: 'everyone',
      allowMentionsFrom: 'everyone',
      showOnlineStatus: true,
      showJoinedCommunities: true,
      showPersonalInfo: 'public',
      discoverableInRecommendations: true,
    },
    followersCount: 118,
    followingCount: 39,
    friendsCount: 19,
    profileViewsCount: 320,
    isOnline: false,
    lastSeenAt: '2026-11-25T20:00:00.000Z',
  },
  'scholar-baonam': {
    id: 'scholar-baonam',
    displayName: 'Khánh Linh', // Same displayName edge-case (Section 4.1 & 20: disambiguated by bio, major & location!)
    avatarUrl: null,
    coverUrl: null,
    bio: 'Sinh viên Vật lý Lượng tử & Hóa Sinh phân tử · Thích giải đề Olympiad.',
    university: 'ĐH Khoa học Tự nhiên',
    major: 'Vật lý Lượng tử',
    interests: ['ToánLýHóa', 'KhoaHọc', 'ÔnThi'],
    locationArea: 'TP. Hồ Chí Minh',
    websiteUrl: '',
    badges: ['Helpful Member'],
    reputationScore: 365,
    role: 'user',
    accountStatus: 'active',
    privacy: {
      isPrivateAccount: true,
      allowMessagesFrom: 'friends_and_followers',
      allowMentionsFrom: 'followers',
      showOnlineStatus: true,
      showJoinedCommunities: true,
      showPersonalInfo: 'friends',
      discoverableInRecommendations: true,
    },
    followersCount: 74,
    followingCount: 25,
    friendsCount: 14,
    profileViewsCount: 190,
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
  },
};

const SEED_COMMUNITIES: SocialCommunityGroup[] = [
  {
    id: 'comm-software-ai',
    slug: 'ky-thuat-phan-mem-ai',
    name: 'Kỹ thuật Phần mềm, Cloud & AI',
    description: 'Cộng đồng thảo luận chuyên sâu về Kiến trúc Hệ thống, Thuật toán, React Native, Backend & Trí tuệ Nhân tạo.',
    avatarEmoji: '💻',
    accentColor: '#6366F1',
    coverUrl: null,
    visibility: 'public',
    topics: ['CNTT', 'AI', 'ThuậtToán', 'HệĐiềuHành'],
    rules: [
      '1. Chia sẻ nội dung có giá trị học thuật, code rõ ràng hoặc câu hỏi cụ thể.',
      '2. Tôn trọng các góc nhìn kỹ thuật trong chế độ Tranh biện (Debate Mode).',
      '3. Sử dụng nhãn Spoiler khi đăng lời giải đề thi mới.',
    ],
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: true,
    isSuspended: false,
    ownerId: 'scholar-khanh',
    members: [
      {
        userId: 'scholar-khanh',
        displayName: 'Khánh Linh',
        avatarUrl: null,
        role: 'owner',
        reputationPoints: 640,
        helpfulCount: 28,
        badges: ['Community Champion', 'Top Contributor'],
        joinedAt: '2026-10-01T00:00:00.000Z',
      },
      {
        userId: 'scholar-minhquan',
        displayName: 'Minh Quân',
        avatarUrl: null,
        role: 'moderator',
        reputationPoints: 520,
        helpfulCount: 22,
        badges: ['Top Contributor', 'Helpful Member'],
        joinedAt: '2026-10-03T00:00:00.000Z',
      },
    ],
    pinnedPostIds: ['spost-1'],
    announcements: ['📌 Tối thứ Sáu 20:30: Phiên Live Review Kiến trúc Microservices vs Modular Monolith!'],
    events: [
      {
        id: 'evt-arch-live',
        communityId: 'comm-software-ai',
        creatorId: 'scholar-khanh',
        creatorName: 'Khánh Linh',
        title: 'Live Workshop: Tối ưu PostgreSQL, RLS & Realtime cho 100k CCU',
        description: 'Phân tích thực chiến chống N+1 query, cursor pagination và thiết kế bảng hiệu năng cao.',
        locationLabel: 'Phòng Thảo Luận Trực Tiếp · Papyrus',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'scheduled',
        rsvpUserIds: ['scholar-khanh', 'scholar-minhquan'],
        reminderUserIds: ['scholar-khanh'],
      },
    ],
    activityLogs: [],
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'comm-stem-olympiad',
    slug: 'khoa-hoc-tu-nhien-stem',
    name: 'CLB Khoa Học Tự Nhiên (Toán · Lý · Hóa · Sinh)',
    description: 'Giải đáp bài tập đại cương, chia sẻ sổ tay công thức & thảo luận nghiên cứu khoa học.',
    avatarEmoji: '🔬',
    accentColor: '#10B981',
    coverUrl: null,
    visibility: 'public',
    topics: ['ToánLýHóa', 'KhoaHọc', 'ÔnThi'],
    rules: [
      '1. Trình bày từng bước biến đổi rõ ràng khi giải bài tập.',
      '2. Không spam bình luận ngắn không mang nội dung.',
    ],
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: true,
    isSuspended: false,
    ownerId: 'scholar-baonam',
    members: [
      {
        userId: 'scholar-baonam',
        displayName: 'Khánh Linh',
        avatarUrl: null,
        role: 'owner',
        reputationPoints: 365,
        helpfulCount: 14,
        badges: ['Helpful Member'],
        joinedAt: '2026-10-10T00:00:00.000Z',
      },
    ],
    pinnedPostIds: [],
    announcements: ['🧪 Đã cập nhật bộ tài liệu Nhiệt động lực học & Di truyền phân tử!'],
    events: [],
    activityLogs: [],
    createdAt: '2026-10-10T00:00:00.000Z',
  },
  {
    id: 'comm-humanities-private',
    slug: 'dien-dan-su-van-chuyen-sau',
    name: 'Diễn Đàn Nghiên Cứu Sử Học & Văn Chương (Riêng tư)',
    description: 'Nhóm chuyên sâu dành cho thành viên đã duyệt để thảo luận tư liệu lịch sử và phê bình văn học.',
    avatarEmoji: '🏛️',
    accentColor: '#F59E0B',
    coverUrl: null,
    visibility: 'private',
    topics: ['VănSử', 'NghiênCứu'],
    rules: ['1. Dẫn nguồn tư liệu lịch sử chính thống.', '2. Phê bình văn học văn minh, tôn trọng tác giả.'],
    requirePostApproval: true,
    requireMemberApproval: true,
    allowAnonymousPosts: false,
    isSuspended: false,
    ownerId: 'scholar-haianh',
    members: [
      {
        userId: 'scholar-haianh',
        displayName: 'Hải Anh',
        avatarUrl: null,
        role: 'owner',
        reputationPoints: 420,
        helpfulCount: 19,
        badges: ['Community Champion'],
        joinedAt: '2026-10-12T00:00:00.000Z',
      },
    ],
    pinnedPostIds: [],
    announcements: [],
    events: [],
    activityLogs: [],
    createdAt: '2026-10-12T00:00:00.000Z',
  },
];

const SEED_SOCIAL_POSTS: SocialPostItem[] = [
  {
    id: 'spost-1',
    authorId: 'scholar-khanh',
    internalAuthorId: 'scholar-khanh',
    authorName: 'Khánh Linh',
    authorAvatar: null,
    authorBio: 'Kỹ sư Phần mềm & Hệ phân tán',
    authorBadges: ['Top Contributor'],
    communityId: 'comm-software-ai',
    communityName: 'Kỹ thuật Phần mềm, Cloud & AI',
    postKind: 'thread',
    threadParts: [
      '90% lập trình viên mới học thuộc lòng "Deadlock (Tắc nghẽn)", nhưng chỉ cần nắm đúng 4 điều kiện Coffman này là xử lý trọn vẹn mọi bài toán đồng thời trong Hệ Điều Hành & Database 👇',
      '1/ Bốn điều kiện cần và đủ:\n• Mutual Exclusion (Loại trừ tương hỗ)\n• Hold and Wait (Giữ và chờ tài nguyên)\n• No Preemption (Không trưng dụng)\n• Circular Wait (Chờ đợi vòng tròn)',
      '2/ Giải pháp thực chiến trong Production: Luôn khóa tài nguyên theo thứ tự định danh tăng dần (`lock(minId)` → `lock(maxId)`) để triệt tiêu hoàn toàn Circular Wait!',
    ],
    longFormBody:
      'Trong PostgreSQL thực tế, khi hai transaction cùng cập nhật hai dòng theo thứ tự ngược nhau (`Tx1: row A -> row B`, `Tx2: row B -> row A`), bộ phát hiện deadlock sẽ hủy một transaction sau `deadlock_timeout`. Sắp xếp khóa theo `ORDER BY id ASC` trước khi `SELECT ... FOR UPDATE` giúp loại bỏ hoàn toàn xung đột vòng tròn.',
    mediaItems: [],
    attachedQuiz: {
      setId: 'seed-uni-os-arch',
      title: 'Hệ Điều Hành & Kiến Trúc Máy Tính',
      questionCount: 8,
      subject: 'Công nghệ thông tin',
    },
    codeSnippet:
      'SELECT id FROM accounts WHERE id IN ($1, $2) ORDER BY id ASC FOR UPDATE;',
    isSpoiler: false,
    isAnonymous: false,
    audience: 'public',
    selectedAudienceIds: [],
    replyPermission: 'everyone',
    topics: ['CNTT', 'HệĐiềuHành', 'ÔnThi'],
    hashtags: ['CNTT', 'HệĐiềuHành', 'Database'],
    mentionedUserIds: [],
    locationLabel: 'TP. Hồ Chí Minh',
    reactions: {
      love: ['scholar-minhquan', 'scholar-haianh'],
      fire: ['scholar-minhquan'],
      bulb: ['scholar-baonam'],
    },
    repostedByIds: ['scholar-minhquan'],
    quoteCount: 1,
    comments: [
      {
        id: 'scmt-1',
        postId: 'spost-1',
        parentCommentId: null,
        authorId: 'scholar-minhquan',
        authorName: 'Minh Quân',
        authorAvatar: null,
        content: 'Mẹo `ORDER BY id ASC FOR UPDATE` cực kỳ thực tế luôn! Mình từng sửa một lỗi deadlock thanh toán nhờ đúng nguyên tắc này.',
        mentionedUserIds: [],
        reactions: { love: ['scholar-khanh'], like: ['scholar-haianh'] },
        isPinned: true,
        isEdited: false,
        createdAt: '2026-11-25T08:30:00.000Z',
      },
      {
        id: 'scmt-2',
        postId: 'spost-1',
        parentCommentId: 'scmt-1',
        authorId: 'scholar-khanh',
        authorName: 'Khánh Linh',
        authorAvatar: null,
        content: 'Chuẩn luôn Minh Quân ơi, nhất là các giao dịch chuyển điểm hoặc ví điện tử có lưu lượng đồng thời cao!',
        mentionedUserIds: ['scholar-minhquan'],
        reactions: { fire: ['scholar-minhquan'] },
        isPinned: false,
        isEdited: false,
        createdAt: '2026-11-25T08:42:00.000Z',
      },
    ],
    isPinnedProfile: true,
    isPinnedCommunity: true,
    lifecycleStatus: 'published',
    editHistory: [],
    impressionsCount: 428,
    viewsCount: 196,
    sharesCount: 14,
    videoWatchSec: 0,
    createdAt: '2026-11-25T08:00:00.000Z',
    updatedAt: '2026-11-25T08:00:00.000Z',
  },
  {
    id: 'spost-2',
    authorId: 'scholar-minhquan',
    internalAuthorId: 'scholar-minhquan',
    authorName: 'Minh Quân',
    authorAvatar: null,
    authorBio: 'Nghiên cứu Trí tuệ Nhân tạo, Cloud Native & An toàn mạng',
    authorBadges: ['Helpful Member'],
    communityId: 'comm-software-ai',
    communityName: 'Kỹ thuật Phần mềm, Cloud & AI',
    postKind: 'debate',
    threadParts: [
      '⚖️ Góc Tranh Biện Kỹ Thuật (Debate Mode): Với một dự án Startup EdTech từ 0 lên 100.000 người dùng, nên khởi đầu bằng **Modular Monolith** hay tách **Microservices** ngay từ ngày đầu?',
      'Hãy bình chọn ở Poll Zalo bên dưới và gửi lập luận vào Phe A hoặc Phe B để PapyAI tổng hợp khách quan cả hai góc nhìn nhé!',
    ],
    mediaItems: [],
    poll: {
      id: 'upoll-arch-1',
      scopeType: 'post',
      question: 'Kiến trúc khởi đầu nào hiệu quả hơn cho đội ngũ 3–8 kỹ sư?',
      options: [
        {
          id: 'uopt-1',
          text: 'Modular Monolith (Ranh giới module sạch, dễ deploy & refactor)',
          voterIds: ['scholar-khanh', 'scholar-haianh'],
        },
        {
          id: 'uopt-2',
          text: 'Microservices ngay từ đầu (Độc lập mở rộng từng dịch vụ)',
          voterIds: ['scholar-baonam'],
        },
      ],
      allowMultiple: false,
      isAnonymous: false,
      allowAddOptions: true,
      allowChangeVote: true,
      isClosed: false,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      createdBy: 'scholar-minhquan',
      createdAt: '2026-11-25T09:15:00.000Z',
    },
    debate: {
      sideALabel: 'Phe Modular Monolith',
      sideBLabel: 'Phe Microservices',
      sideAVoterIds: ['scholar-khanh', 'scholar-haianh'],
      sideBVoterIds: ['scholar-baonam'],
      arguments: [
        {
          id: 'darg-1',
          side: 'A',
          authorId: 'scholar-khanh',
          authorName: 'Khánh Linh',
          authorAvatar: null,
          content: 'Modular Monolith giữ trọn ACID transaction trong một PostgreSQL duy nhất, không tốn chi phí vận hành distributed tracing và network hop sớm.',
          upvoterIds: ['scholar-minhquan', 'scholar-haianh'],
          createdAt: '2026-11-25T09:25:00.000Z',
        },
        {
          id: 'darg-2',
          side: 'B',
          authorId: 'scholar-baonam',
          authorName: 'Khánh Linh',
          authorAvatar: null,
          content: 'Nếu có tác vụ nặng như xử lý AI/Video/OCR tốn GPU/CPU, tách riêng worker/service đó giúp API chính không bị nghẽn tài nguyên.',
          upvoterIds: ['scholar-minhquan'],
          createdAt: '2026-11-25T09:35:00.000Z',
        },
      ],
      aiNeutralSummary:
        'Tổng hợp đa chiều bởi PapyAI: Phe Modular Monolith nhấn mạnh tốc độ phát triển, tính toàn vẹn giao dịch ACID và chi phí vận hành thấp ở giai đoạn đầu; trong khi Phe Microservices chỉ ra lợi ích cô lập các tác vụ nặng (AI/OCR/Media) để bảo vệ độ trễ API chính.',
    },
    isSpoiler: false,
    isAnonymous: false,
    audience: 'public',
    selectedAudienceIds: [],
    replyPermission: 'everyone',
    topics: ['CNTT', 'AI', 'KiếnTrúc'],
    hashtags: ['DebateMode', 'SoftwareArchitecture', 'CNTT'],
    mentionedUserIds: [],
    locationLabel: 'Hà Nội',
    reactions: {
      bulb: ['scholar-khanh', 'scholar-haianh'],
      fire: ['scholar-khanh'],
    },
    repostedByIds: [],
    quoteCount: 0,
    comments: [],
    isPinnedProfile: false,
    isPinnedCommunity: false,
    lifecycleStatus: 'published',
    editHistory: [],
    impressionsCount: 315,
    viewsCount: 154,
    sharesCount: 9,
    videoWatchSec: 0,
    createdAt: '2026-11-25T09:15:00.000Z',
    updatedAt: '2026-11-25T09:15:00.000Z',
  },
  {
    id: 'spost-3',
    authorId: 'scholar-haianh',
    internalAuthorId: 'scholar-haianh',
    authorName: 'Hải Anh',
    authorAvatar: null,
    authorBio: 'Yêu Lịch sử Thế giới & Văn chương Hiện đại',
    postKind: 'standard',
    threadParts: [
      'Đáp án chi tiết và phân tích bẫy câu hỏi vận dụng cao phần Chiến tranh Lạnh trong bộ đề thi thử chiều nay — mình đặt chế độ Spoiler để các bạn chưa làm bài không bị lộ đáp án trước nhé!',
    ],
    mediaItems: [],
    isSpoiler: true,
    spoilerWarning: 'Đáp án & lời giải đề thi thử Lịch sử Thế giới (chạm để mở)',
    isAnonymous: false,
    audience: 'public',
    selectedAudienceIds: [],
    replyPermission: 'everyone',
    topics: ['VănSử', 'ÔnThi'],
    hashtags: ['VănSử', 'LịchSửThếGiới', 'ÔnThi'],
    mentionedUserIds: [],
    locationLabel: 'Đà Nẵng',
    reactions: { clap: ['scholar-khanh'], love: ['scholar-minhquan'] },
    repostedByIds: [],
    quoteCount: 0,
    comments: [],
    isPinnedProfile: false,
    isPinnedCommunity: false,
    lifecycleStatus: 'published',
    editHistory: [],
    impressionsCount: 189,
    viewsCount: 92,
    sharesCount: 4,
    videoWatchSec: 0,
    createdAt: '2026-11-25T10:20:00.000Z',
    updatedAt: '2026-11-25T10:20:00.000Z',
  },
];

const SEED_CONVERSATIONS: MessagingConversation[] = [
  {
    id: 'conv-grp-software',
    kind: 'group',
    title: 'Nhóm Thảo Luận Kỹ Thuật Phần Mềm & AI',
    subtitle: '148 thành viên · Nhóm học tập chung',
    avatarUrl: null,
    accentColor: '#6366F1',
    communityId: 'comm-software-ai',
    memberIds: ['scholar-khanh', 'scholar-minhquan', 'scholar-haianh'],
    adminIds: ['scholar-khanh', 'scholar-minhquan'],
    requestState: 'accepted',
    isPinned: true,
    isMuted: false,
    pinnedMessageId: 'cmsg-1',
    announcement: '📌 Tối nay 21:00 cùng giải đề Hệ điều hành & Mạng máy tính trực tiếp nhé!',
    typingUserNames: [],
    lastMessagePreview: 'Minh Quân đã chia sẻ một bài viết vào nhóm',
    lastMessageAt: '2026-11-25T10:05:00.000Z',
    unreadByUserIds: {},
  },
  {
    id: 'conv-live-exam-room',
    kind: 'live_room',
    title: '🔴 Phòng Live Thảo Luận Ôn Thi Cuối Kỳ',
    subtitle: 'Phòng thảo luận trực tiếp theo chủ đề',
    avatarUrl: null,
    accentColor: '#EC4899',
    memberIds: ['scholar-khanh', 'scholar-minhquan', 'scholar-haianh', 'scholar-baonam'],
    adminIds: ['scholar-khanh'],
    requestState: 'accepted',
    isPinned: false,
    isMuted: false,
    pinnedMessageId: null,
    announcement: '🎙️ Đặt câu hỏi nhanh và bình chọn chủ đề cần giải đáp trực tiếp!',
    typingUserNames: [],
    lastMessagePreview: 'Hải Anh: Mọi người đang ôn môn nào trước vậy?',
    lastMessageAt: '2026-11-25T10:15:00.000Z',
    unreadByUserIds: {},
  },
];

const SEED_CHAT_MESSAGES: DirectOrGroupMessage[] = [
  {
    id: 'cmsg-1',
    conversationId: 'conv-grp-software',
    senderId: 'scholar-khanh',
    senderName: 'Khánh Linh',
    senderAvatar: null,
    text: '📌 Chào cả nhà! Mọi người bình chọn khung giờ học nhóm tuần này trên Poll Zalo bên dưới nhé!',
    mediaAttachments: [],
    poll: {
      id: 'cpoll-1',
      scopeType: 'chat',
      question: 'Khung giờ nào cả nhóm rảnh nhất để ôn tập trực tuyến?',
      options: [
        { id: 'copt-1', text: '20:00 – 21:30 Tối Thứ Sáu', voterIds: ['scholar-khanh', 'scholar-minhquan'] },
        { id: 'copt-2', text: '19:30 – 21:00 Tối Chủ Nhật', voterIds: ['scholar-haianh'] },
      ],
      allowMultiple: true,
      isAnonymous: false,
      allowAddOptions: true,
      allowChangeVote: true,
      isClosed: false,
      createdBy: 'scholar-khanh',
      createdAt: '2026-11-25T09:50:00.000Z',
    },
    reactions: { '🔥': ['scholar-minhquan'], '❤️': ['scholar-haianh'] },
    isEdited: false,
    isRecalled: false,
    deliveryStatus: 'read',
    readByIds: ['scholar-khanh', 'scholar-minhquan', 'scholar-haianh'],
    createdAt: '2026-11-25T09:50:00.000Z',
  },
  {
    id: 'cmsg-2',
    conversationId: 'conv-grp-software',
    senderId: 'scholar-minhquan',
    senderName: 'Minh Quân',
    senderAvatar: null,
    text: 'Mình chia sẻ chuỗi bài viết tổng hợp 4 điều kiện Deadlock cực hay của Khánh Linh để anh em đọc trước giờ học nhé!',
    mediaAttachments: [],
    sharedPost: {
      postId: 'spost-1',
      authorId: 'scholar-khanh',
      authorName: 'Khánh Linh',
      authorAvatar: null,
      previewText:
        '90% lập trình viên mới học thuộc lòng "Deadlock (Tắc nghẽn)", nhưng chỉ cần nắm đúng 4 điều kiện Coffman này là xử lý trọn vẹn...',
      mediaKind: 'quiz',
      postKind: 'thread',
      createdAt: '2026-11-25T08:00:00.000Z',
    },
    reactions: { '👍': ['scholar-khanh'] },
    isEdited: false,
    isRecalled: false,
    deliveryStatus: 'read',
    readByIds: ['scholar-khanh', 'scholar-minhquan'],
    createdAt: '2026-11-25T10:05:00.000Z',
  },
  {
    id: 'cmsg-3',
    conversationId: 'conv-live-exam-room',
    senderId: 'scholar-haianh',
    senderName: 'Hải Anh',
    senderAvatar: null,
    text: 'Mọi người đang ôn môn nào trước vậy? Cùng bật Pomodoro 25 phút học chung nhé! 🔥',
    mediaAttachments: [],
    reactions: { '❤️': ['scholar-khanh'] },
    isEdited: false,
    isRecalled: false,
    deliveryStatus: 'read',
    readByIds: ['scholar-haianh', 'scholar-khanh'],
    createdAt: '2026-11-25T10:15:00.000Z',
  },
];

const SEED_ADMIN_DOCS: AdminManagedDocument[] = [
  {
    id: 'adoc-1',
    title: 'Sổ Tay Trọng Tâm Kiến Trúc Hệ Thống, SQL & Thuật Toán Đại Học',
    description: 'Tài liệu biên soạn chính thức tổng hợp công thức độ phức tạp Big-O, thiết kế chỉ mục PostgreSQL và mẫu câu hỏi vấn đáp.',
    coverUrl: null,
    category: 'Công nghệ thông tin',
    tags: ['CNTT', 'SQL', 'ThuậtToán', 'ÔnThi'],
    fileFormat: 'markdown',
    fileName: 'so-tay-kien-truc-sql-thuat-toan.md',
    richContent:
      '# Sổ Tay Kiến Trúc Hệ Thống & Thuật Toán\n\n## 1. Độ phức tạp thuật toán thông dụng\n- Binary Search: `O(log n)`\n- Merge Sort / Heap Sort: `O(n log n)`\n- Hash Table trung bình: `O(1)`\n\n## 2. Nguyên tắc Tối ưu Cơ sở dữ liệu\n- Sử dụng Composite Index khớp thứ tự `WHERE` + `ORDER BY`.\n- Dùng Keyset Cursor Pagination `(created_at, id) < ($ts, $id)` thay cho `OFFSET` lớn.\n- Luôn bật Row Level Security (RLS) theo quyền sở hữu `auth.uid()`.',
    status: 'published',
    allowDownload: true,
    expiresAt: null,
    downloadCount: 42,
    recipientUserIds: ['all'],
    recipientCommunityIds: ['comm-software-ai'],
    giftHistory: [
      {
        id: 'gh-1',
        targetLabel: 'Tất cả người dùng đủ điều kiện',
        giftedAt: '2026-11-25T07:00:00.000Z',
      },
    ],
    createdAt: '2026-11-25T07:00:00.000Z',
    updatedAt: '2026-11-25T07:00:00.000Z',
  },
];

interface SocialStoreState {
  activeScopeUserId: string;
  profilesById: Record<string, SocialUserProfile>;
  follows: FollowEdge[];
  friendRequests: FriendRequestRecord[];
  relations: Array<{ actorId: string; targetId: string; type: UserRelationType }>;
  posts: SocialPostItem[];
  communities: SocialCommunityGroup[];
  conversations: MessagingConversation[];
  chatMessages: DirectOrGroupMessage[];
  moderationCases: SocialModerationCase[];
  adminDocuments: AdminManagedDocument[];
  auditLogs: AdminAuditLogItem[];
  userSlices: Record<string, ScopedUserSlice>;
  feedScrollOffset: number;

  // Scope & Identity Sync
  switchAccountScope: (userId: string) => void;
  ensureUserProfile: (input: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: SocialUserProfile['role'];
  }) => SocialUserProfile;
  propagateIdentityUpdate: (
    userId: string,
    patch: Partial<Pick<SocialUserProfile, 'displayName' | 'avatarUrl' | 'coverUrl' | 'bio' | 'university' | 'major' | 'interests' | 'locationArea' | 'websiteUrl'>> & {
      privacy?: Partial<SocialUserProfile['privacy']>;
    }
  ) => void;
  syncCloudDirectory: () => Promise<void>;
  incrementProfileView: (targetUserId: string, viewerId: string) => void;

  // Social Graph (1-Way Follow vs 2-Way Friendship + Close Friends + Block/Mute/Restrict)
  toggleFollowUser: (followerId: string, targetId: string) => 'followed' | 'requested' | 'unfollowed';
  respondFollowRequest: (ownerId: string, followerId: string, accept: boolean) => void;
  toggleCloseFriend: (userId: string, targetId: string) => void;
  sendFriendRequest: (senderId: string, receiverId: string) => void;
  respondFriendRequest: (requestId: string, accept: boolean) => void;
  cancelOrUnfriend: (userId: string, otherUserId: string) => void;
  toggleUserRelation: (actorId: string, targetId: string, type: UserRelationType) => boolean;
  dismissFriendRecommendation: (userId: string, targetId: string) => void;

  // Composer Drafts & Post Lifecycle (Create, Edit+History, Delete, Archive, Pin, Scheduled, Ghost)
  saveComposerDraft: (userId: string, draft: ComposerDraftPayload | null) => void;
  runScheduledAndGhostSweep: () => void;
  createSocialPost: (input: {
    authorId: string;
    authorName: string;
    authorAvatar: string | null;
    communityId?: string | null;
    postKind?: PostKind;
    threadParts: string[];
    longFormBody?: string;
    mediaItems?: SocialMediaItem[];
    poll?: UnifiedPoll | null;
    attachedQuiz?: SocialPostItem['attachedQuiz'];
    codeSnippet?: string;
    linkPreview?: SocialPostItem['linkPreview'];
    debate?: SocialPostItem['debate'];
    repostOfId?: string | null;
    isQuote?: boolean;
    isSpoiler?: boolean;
    spoilerWarning?: string;
    isAnonymous?: boolean;
    audience?: PostAudience;
    selectedAudienceIds?: string[];
    replyPermission?: ReplyPermission;
    topics?: string[];
    hashtags?: string[];
    mentionedUserIds?: string[];
    locationLabel?: string | null;
    scheduledFor?: string | null;
    ghostHours?: number;
  }) => SocialPostItem;
  editSocialPost: (postId: string, editorId: string, nextParts: string[], nextLongForm?: string, nextMedia?: SocialMediaItem[]) => boolean;
  deleteOrArchivePost: (postId: string, actorId: string, mode: 'delete' | 'archive' | 'restore') => void;
  togglePinPost: (postId: string, scope: 'profile' | 'community') => void;
  summarizePostWithAi: (postId: string) => Promise<void>;
  voteDebateSide: (postId: string, side: 'A' | 'B', userId: string) => void;
  addDebateArgument: (postId: string, side: 'A' | 'B', author: { id: string; name: string; avatar: string | null }, content: string) => void;

  // Engagement (Reactions, Threaded Comments, Repost/Quote, Bookmarks/Collections, Favourites, Unified Polls)
  togglePostEmojiReaction: (postId: string, reaction: EmojiReactionType, userId: string) => void;
  addThreadedReply: (input: {
    postId: string;
    parentCommentId: string | null;
    authorId: string;
    authorName: string;
    authorAvatar: string | null;
    content: string;
    mediaItem?: SocialMediaItem | null;
    mentionedUserIds?: string[];
  }) => ThreadedReplyItem | null;
  editOrDeleteComment: (postId: string, commentId: string, actorId: string, newContent?: string | null) => void;
  toggleCommentReaction: (postId: string, commentId: string, reaction: EmojiReactionType, userId: string) => void;
  togglePinComment: (postId: string, commentId: string) => void;
  togglePureRepost: (postId: string, userId: string) => boolean;
  toggleSaveBookmark: (userId: string, postId: string, collectionId?: string) => boolean;
  toggleFavouritePost: (userId: string, postId: string) => boolean;
  createBookmarkCollection: (userId: string, name: string, coverEmoji: string, topicRule?: string) => BookmarkCollection;
  deleteBookmarkCollection: (userId: string, collectionId: string) => void;
  voteUnifiedPoll: (targetKind: 'post' | 'message', targetId: string, optionId: string, userId: string) => void;
  addUnifiedPollOption: (targetKind: 'post' | 'message', targetId: string, text: string, user: { id: string; name: string }) => void;
  toggleCloseUnifiedPoll: (targetKind: 'post' | 'message', targetId: string, actorId: string) => void;

  // Custom Feeds, Your Algo & Scroll Recovery
  setFeedScrollOffset: (y: number) => void;
  updateYourAlgo: (userId: string, patch: Partial<YourAlgoConfig>) => void;
  resetYourAlgo: (userId: string) => void;
  saveCustomFeed: (userId: string, feed: Omit<CustomFeedConfig, 'id' | 'ownerId' | 'order'> & { id?: string }) => void;
  deleteCustomFeed: (userId: string, feedId: string) => void;
  recordSearchQuery: (userId: string, query: string) => void;
  clearSearchHistory: (userId: string) => void;

  // Communities, Roles, Events & Moderation
  createCommunity: (input: {
    ownerId: string;
    ownerName: string;
    name: string;
    description: string;
    visibility: 'public' | 'private' | 'hidden';
    topics: string[];
    rules: string[];
    avatarEmoji?: string;
    accentColor?: string;
    allowAnonymousPosts?: boolean;
    requirePostApproval?: boolean;
  }) => SocialCommunityGroup;
  joinOrLeaveCommunity: (communityId: string, user: { id: string; name: string; avatar: string | null }) => string;
  updateCommunityMemberRole: (communityId: string, actorName: string, targetUserId: string, role: CommunityRole) => void;
  approvePendingPost: (postId: string, approve: boolean) => void;
  createCommunityEvent: (input: {
    communityId: string;
    creatorId: string;
    creatorName: string;
    title: string;
    description: string;
    locationLabel: string;
    startsAt: string;
  }) => CommunityEventItem;
  toggleEventRsvp: (communityId: string, eventId: string, userId: string) => void;

  // Dedicated Messaging Center (DM, Group Chat, Requests, SharedPostCard, Polls, Recall/Edit)
  openOrCreateDirectConversation: (
    me: { id: string; name: string; avatar: string | null },
    peer: { id: string; name: string; avatar?: string | null }
  ) => MessagingConversation;
  createGroupConversation: (input: {
    creatorId: string;
    title: string;
    topic: string;
    memberIds: string[];
  }) => MessagingConversation;
  acceptOrArchiveConversation: (conversationId: string, state: 'accepted' | 'archived') => void;
  togglePinOrMuteConversation: (conversationId: string, field: 'isPinned' | 'isMuted') => void;
  markConversationRead: (conversationId: string, userId: string) => void;
  sendChatMessage: (input: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    text: string;
    mediaAttachments?: SocialMediaItem[];
    sharedPost?: SharedPostReference | null;
    poll?: UnifiedPoll | null;
    quizCard?: DirectOrGroupMessage['quizCard'];
    replyTo?: DirectOrGroupMessage['replyTo'];
    forwardedFromName?: string;
  }) => DirectOrGroupMessage;
  editOrRecallChatMessage: (messageId: string, senderId: string, mode: 'edit' | 'recall', newText?: string) => void;
  toggleChatMessageReaction: (messageId: string, emoji: string, userId: string) => void;
  pinChatMessage: (conversationId: string, messageId: string | null) => void;
  sharePostToDestination: (
    post: SocialPostItem,
    sender: { id: string; name: string; avatar: string | null },
    destination: { type: 'conversation'; conversationId: string } | { type: 'community'; communityId: string },
    commentText?: string
  ) => void;

  // Trust, Safety, Moderation Queue, Appeals & Admin Document Gift Center
  submitModerationReport: (input: {
    reporterId: string;
    reporterName: string;
    targetType: SocialModerationCase['targetType'];
    targetId: string;
    targetPreview: string;
    targetOwnerId: string;
    reason: string;
    details: string;
  }) => SocialModerationCase;
  applyAdminModerationAction: (
    caseId: string,
    adminName: string,
    workflowStatus: ModerationWorkflowStatus,
    action?: ModerationActionKind,
    reason?: string
  ) => void;
  submitUserAppeal: (caseId: string, userId: string, appealReason: string) => void;
  resolveUserAppeal: (caseId: string, adminName: string, decision: 'accepted' | 'rejected', note: string) => void;
  updateUserAccountStatusAdmin: (
    targetUserId: string,
    adminName: string,
    patch: { accountStatus?: SocialUserProfile['accountStatus']; role?: SocialUserProfile['role'] },
    reason: string
  ) => void;
  createOrUpdateAdminDocument: (
    adminName: string,
    doc: Omit<AdminManagedDocument, 'id' | 'downloadCount' | 'giftHistory' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<AdminManagedDocument>;
  deleteAdminDocument: (adminName: string, docId: string) => void;
  giftAdminDocument: (input: {
    adminName: string;
    docId: string;
    targetScope: 'user' | 'selected_users' | 'community' | 'all_users';
    userIds?: string[];
    communityId?: string;
    targetLabel: string;
    expiresAt?: string | null;
  }) => AdminManagedDocument | null;
  recordDocumentDownload: (docId: string) => void;
}

export const useSocialStore = create<SocialStoreState>()(
  persist(
    (set, get) => {
      const getSlice = (state: SocialStoreState, uid: string): ScopedUserSlice =>
        state.userSlices[uid] ?? emptyScopedSlice(uid);

      return {
        activeScopeUserId: 'guest',
        profilesById: SEED_PROFILES,
        follows: [
          {
            followerId: 'scholar-minhquan',
            followingId: 'scholar-khanh',
            status: 'accepted',
            isCloseFriend: true,
            createdAt: '2026-11-01T00:00:00.000Z',
          },
          {
            followerId: 'scholar-khanh',
            followingId: 'scholar-minhquan',
            status: 'accepted',
            isCloseFriend: true,
            createdAt: '2026-11-01T00:00:00.000Z',
          },
        ],
        friendRequests: [
          {
            id: 'freq-seed-1',
            senderId: 'scholar-khanh',
            receiverId: 'scholar-minhquan',
            status: 'accepted',
            createdAt: '2026-11-02T00:00:00.000Z',
          },
        ],
        relations: [],
        posts: SEED_SOCIAL_POSTS,
        communities: SEED_COMMUNITIES,
        conversations: SEED_CONVERSATIONS,
        chatMessages: SEED_CHAT_MESSAGES,
        moderationCases: [],
        adminDocuments: SEED_ADMIN_DOCS,
        auditLogs: [],
        userSlices: { guest: emptyScopedSlice('guest') },
        feedScrollOffset: 0,

        switchAccountScope: (userId) => {
          const scope = userId || 'guest';
          set((state) => ({
            activeScopeUserId: scope,
            feedScrollOffset: 0,
            userSlices: state.userSlices[scope]
              ? state.userSlices
              : { ...state.userSlices, [scope]: emptyScopedSlice(scope) },
          }));
        },

        ensureUserProfile: (input) => {
          const existing = get().profilesById[input.id];
          const cleanName = input.displayName.trim() || existing?.displayName || 'Thành viên Papyrus';
          const next: SocialUserProfile = existing
            ? {
                ...existing,
                displayName: cleanName,
                avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
                role: input.role ?? existing.role,
              }
            : {
                id: input.id,
                displayName: cleanName,
                avatarUrl: input.avatarUrl ?? null,
                coverUrl: null,
                bio: '',
                university: '',
                major: '',
                interests: ['CNTT', 'ÔnThi'],
                locationArea: '',
                websiteUrl: '',
                badges: [],
                reputationScore: 100,
                role: input.role ?? 'user',
                accountStatus: 'active',
                privacy: {
                  isPrivateAccount: false,
                  allowMessagesFrom: 'everyone',
                  allowMentionsFrom: 'everyone',
                  showOnlineStatus: true,
                  showJoinedCommunities: true,
                  showPersonalInfo: 'public',
                  discoverableInRecommendations: true,
                },
                followersCount: 0,
                followingCount: 0,
                friendsCount: 0,
                profileViewsCount: 0,
                isOnline: true,
                lastSeenAt: new Date().toISOString(),
              };
          set((state) => ({
            profilesById: { ...state.profilesById, [input.id]: next },
          }));
          return next;
        },

        propagateIdentityUpdate: (userId, patch) => {
          if (!userId) return;
          set((state) => {
            const current = state.profilesById[userId];
            const updatedName = patch.displayName?.trim() || current?.displayName || 'Thành viên Papyrus';
            const updatedAvatar = patch.avatarUrl !== undefined ? patch.avatarUrl : current?.avatarUrl ?? null;

            const updatedProfile: SocialUserProfile = {
              ...(current ?? get().ensureUserProfile({ id: userId, displayName: updatedName, avatarUrl: updatedAvatar })),
              ...patch,
              displayName: updatedName,
              avatarUrl: updatedAvatar,
              privacy: {
                ...(current?.privacy ?? {
                  isPrivateAccount: false,
                  allowMessagesFrom: 'everyone',
                  allowMentionsFrom: 'everyone',
                  showOnlineStatus: true,
                  showJoinedCommunities: true,
                  showPersonalInfo: 'public',
                  discoverableInRecommendations: true,
                }),
                ...(patch.privacy ?? {}),
              },
            };

            return {
              profilesById: { ...state.profilesById, [userId]: updatedProfile },
              // Propagate updated main Profile Name & Avatar across all authored posts, comments, communities & messages!
              posts: state.posts.map((p) => {
                const realAuthor = p.internalAuthorId || p.authorId;
                const nextComments = p.comments.map((c) =>
                  c.authorId === userId
                    ? { ...c, authorName: updatedName, authorAvatar: updatedAvatar }
                    : c
                );
                if (realAuthor === userId && !p.isAnonymous) {
                  return {
                    ...p,
                    authorName: updatedName,
                    authorAvatar: updatedAvatar,
                    authorBio: updatedProfile.bio || p.authorBio,
                    comments: nextComments,
                  };
                }
                return { ...p, comments: nextComments };
              }),
              communities: state.communities.map((c) => ({
                ...c,
                members: c.members.map((m) =>
                  m.userId === userId
                    ? { ...m, displayName: updatedName, avatarUrl: updatedAvatar }
                    : m
                ),
              })),
              conversations: state.conversations.map((conv) =>
                conv.kind === 'direct' && conv.peerUserId === userId
                  ? { ...conv, title: updatedName, avatarUrl: updatedAvatar }
                  : conv
              ),
              chatMessages: state.chatMessages.map((msg) =>
                msg.senderId === userId
                  ? { ...msg, senderName: updatedName, senderAvatar: updatedAvatar }
                  : msg
              ),
            };
          });

          void syncUnifiedProfileToSupabase({
            id: userId,
            ...patch,
          } as Partial<SocialUserProfile> & { id: string });
        },

        syncCloudDirectory: async () => {
          void triggerServerPostLifecycleSweep();
          const remote = await fetchRealProfilesDirectory(50);
          if (remote.length === 0) return;
          set((state) => {
            const merged = { ...state.profilesById };
            for (const prof of remote) {
              const local = merged[prof.id];
              merged[prof.id] = local
                ? {
                    ...local,
                    displayName: prof.displayName || local.displayName,
                    avatarUrl: prof.avatarUrl || local.avatarUrl,
                    coverUrl: prof.coverUrl || local.coverUrl,
                    bio: prof.bio || local.bio,
                    university: prof.university || local.university,
                    major: prof.major || local.major,
                  }
                : prof;
            }
            return { profilesById: merged };
          });
        },

        incrementProfileView: (targetUserId, viewerId) => {
          if (!targetUserId || targetUserId === viewerId) return;
          set((state) => {
            const target = state.profilesById[targetUserId];
            if (!target) return state;
            return {
              profilesById: {
                ...state.profilesById,
                [targetUserId]: { ...target, profileViewsCount: target.profileViewsCount + 1 },
              },
            };
          });
        },

        toggleFollowUser: (followerId, targetId) => {
          if (!followerId || !targetId || followerId === targetId) return 'unfollowed';
          const state = get();
          const existing = state.follows.find(
            (f) => f.followerId === followerId && f.followingId === targetId
          );
          if (existing) {
            set((s) => ({
              follows: s.follows.filter(
                (f) => !(f.followerId === followerId && f.followingId === targetId)
              ),
            }));
            return 'unfollowed';
          }
          const targetProf = state.profilesById[targetId];
          const nextStatus: 'pending' | 'accepted' = targetProf?.privacy.isPrivateAccount
            ? 'pending'
            : 'accepted';
          set((s) => ({
            follows: [
              ...s.follows,
              {
                followerId,
                followingId: targetId,
                status: nextStatus,
                isCloseFriend: false,
                createdAt: new Date().toISOString(),
              },
            ],
          }));
          return nextStatus === 'pending' ? 'requested' : 'followed';
        },

        respondFollowRequest: (ownerId, followerId, accept) => {
          set((s) => ({
            follows: accept
              ? s.follows.map((f) =>
                  f.followingId === ownerId && f.followerId === followerId
                    ? { ...f, status: 'accepted' }
                    : f
                )
              : s.follows.filter(
                  (f) => !(f.followingId === ownerId && f.followerId === followerId)
                ),
          }));
        },

        toggleCloseFriend: (userId, targetId) => {
          set((s) => ({
            follows: s.follows.map((f) =>
              f.followerId === userId && f.followingId === targetId
                ? { ...f, isCloseFriend: !f.isCloseFriend }
                : f
            ),
          }));
        },

        sendFriendRequest: (senderId, receiverId) => {
          if (!senderId || !receiverId || senderId === receiverId) return;
          set((s) => {
            const exists = s.friendRequests.find(
              (r) =>
                ((r.senderId === senderId && r.receiverId === receiverId) ||
                  (r.senderId === receiverId && r.receiverId === senderId)) &&
                (r.status === 'pending' || r.status === 'accepted')
            );
            if (exists) return s;
            return {
              friendRequests: [
                {
                  id: `freq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  senderId,
                  receiverId,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                },
                ...s.friendRequests,
              ],
            };
          });
        },

        respondFriendRequest: (requestId, accept) => {
          set((s) => ({
            friendRequests: s.friendRequests.map((r) =>
              r.id === requestId ? { ...r, status: accept ? 'accepted' : 'rejected' } : r
            ),
          }));
        },

        cancelOrUnfriend: (userId, otherUserId) => {
          set((s) => ({
            friendRequests: s.friendRequests.filter(
              (r) =>
                !(
                  (r.senderId === userId && r.receiverId === otherUserId) ||
                  (r.senderId === otherUserId && r.receiverId === userId)
                )
            ),
          }));
        },

        toggleUserRelation: (actorId, targetId, type) => {
          if (!actorId || !targetId || actorId === targetId) return false;
          const exists = get().relations.some(
            (r) => r.actorId === actorId && r.targetId === targetId && r.type === type
          );
          set((s) => {
            const nextRelations = exists
              ? s.relations.filter(
                  (r) => !(r.actorId === actorId && r.targetId === targetId && r.type === type)
                )
              : [...s.relations, { actorId, targetId, type }];
            // Blocking also cleanly severs active follows & friend requests
            const nextFollows =
              !exists && type === 'block'
                ? s.follows.filter(
                    (f) =>
                      !(
                        (f.followerId === actorId && f.followingId === targetId) ||
                        (f.followerId === targetId && f.followingId === actorId)
                      )
                  )
                : s.follows;
            const nextFriendReqs =
              !exists && type === 'block'
                ? s.friendRequests.filter(
                    (r) =>
                      !(
                        (r.senderId === actorId && r.receiverId === targetId) ||
                        (r.senderId === targetId && r.receiverId === actorId)
                      )
                  )
                : s.friendRequests;
            return { relations: nextRelations, follows: nextFollows, friendRequests: nextFriendReqs };
          });
          return !exists;
        },

        dismissFriendRecommendation: (userId, targetId) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  dismissedRecommendationIds: Array.from(
                    new Set([...slice.dismissedRecommendationIds, targetId])
                  ),
                },
              },
            };
          });
        },

        saveComposerDraft: (userId, draft) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: { ...slice, draft },
              },
            };
          });
        },

        runScheduledAndGhostSweep: () => {
          const now = Date.now();
          set((s) => {
            let changed = false;
            const nextPosts = s.posts.map((p) => {
              if (
                p.lifecycleStatus === 'scheduled' &&
                p.scheduledFor &&
                Date.parse(p.scheduledFor) <= now
              ) {
                changed = true;
                return { ...p, lifecycleStatus: 'published' as const, updatedAt: new Date().toISOString() };
              }
              if (
                p.lifecycleStatus === 'published' &&
                p.expiresAt &&
                Date.parse(p.expiresAt) <= now
              ) {
                changed = true;
                return { ...p, lifecycleStatus: 'expired' as const, updatedAt: new Date().toISOString() };
              }
              return p;
            });
            return changed ? { posts: nextPosts } : s;
          });
        },

        createSocialPost: (input) => {
          const nowIso = new Date().toISOString();
          const comm = input.communityId
            ? get().communities.find((c) => c.id === input.communityId)
            : undefined;
          const isScheduledFuture =
            Boolean(input.scheduledFor) && Date.parse(input.scheduledFor!) > Date.now() + 5000;
          const needsApproval = Boolean(
            comm?.requirePostApproval &&
              !comm.members.some(
                (m) =>
                  m.userId === input.authorId &&
                  (m.role === 'owner' || m.role === 'admin' || m.role === 'moderator')
              )
          );

          const status = isScheduledFuture
            ? 'scheduled'
            : needsApproval
            ? 'pending_approval'
            : 'published';

          const expiresAt =
            input.postKind === 'ghost'
              ? new Date(Date.now() + (input.ghostHours ?? 24) * 3_600_000).toISOString()
              : null;

          const newPost: SocialPostItem = {
            id: `spost-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            authorId: input.authorId,
            internalAuthorId: input.authorId,
            authorName: input.authorName.trim() || 'Thành viên Papyrus',
            authorAvatar: input.authorAvatar,
            communityId: input.communityId ?? null,
            communityName: comm?.name ?? null,
            postKind: input.postKind ?? (input.threadParts.length > 1 ? 'thread' : 'standard'),
            threadParts: input.threadParts,
            longFormBody: input.longFormBody,
            mediaItems: input.mediaItems ?? [],
            poll: input.poll ?? null,
            attachedQuiz: input.attachedQuiz ?? null,
            codeSnippet: input.codeSnippet,
            linkPreview: input.linkPreview ?? null,
            debate: input.debate ?? null,
            repostOfId: input.repostOfId ?? null,
            isQuote: Boolean(input.isQuote),
            isSpoiler: Boolean(input.isSpoiler),
            spoilerWarning: input.spoilerWarning || 'Nội dung ẩn Spoiler · Chạm để xem',
            isAnonymous: Boolean(input.isAnonymous),
            audience: input.audience ?? (input.communityId ? 'community' : 'public'),
            selectedAudienceIds: input.selectedAudienceIds ?? [],
            replyPermission: input.replyPermission ?? 'everyone',
            topics: input.topics ?? [],
            hashtags: input.hashtags ?? [],
            mentionedUserIds: input.mentionedUserIds ?? [],
            locationLabel: input.locationLabel ?? null,
            reactions: {},
            repostedByIds: [],
            quoteCount: 0,
            comments: [],
            isPinnedProfile: false,
            isPinnedCommunity: false,
            lifecycleStatus: status,
            scheduledFor: isScheduledFuture ? input.scheduledFor : null,
            expiresAt,
            editHistory: [],
            impressionsCount: 1,
            viewsCount: 1,
            sharesCount: 0,
            videoWatchSec: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          set((s) => ({
            posts: [
              newPost,
              ...s.posts.map((p) =>
                input.isQuote && input.repostOfId === p.id
                  ? { ...p, quoteCount: p.quoteCount + 1 }
                  : p
              ),
            ],
          }));

          void persistSocialPostToSupabase(newPost);

          if (status === 'published' && !newPost.isAnonymous && newPost.audience === 'public') {
            broadcastCommunityEvent({
              type: 'new-post',
              post: {
                id: newPost.id,
                authorId: newPost.authorId,
                authorName: newPost.authorName,
                authorHandle: newPost.authorName,
                authorAvatar: newPost.authorAvatar,
                authorLevel: 1,
                threadParts: newPost.threadParts,
                tags: newPost.topics,
                reactions: { heart: [], bulb: [], fire: [], clap: [] },
                repostedByIds: [],
                bookmarkedByIds: [],
                comments: [],
                createdAt: newPost.createdAt,
              },
            });
          }

          return newPost;
        },

        editSocialPost: (postId, editorId, nextParts, nextLongForm, nextMedia) => {
          const target = get().posts.find((p) => p.id === postId);
          if (!target) return false;
          const realOwner = target.internalAuthorId || target.authorId;
          if (realOwner !== editorId) return false;

          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId
                ? p
                : {
                    ...p,
                    threadParts: nextParts,
                    longFormBody: nextLongForm !== undefined ? nextLongForm : p.longFormBody,
                    mediaItems: nextMedia !== undefined ? nextMedia : p.mediaItems,
                    editHistory: [
                      {
                        id: `ver-${Date.now()}`,
                        editedAt: new Date().toISOString(),
                        editorId,
                        previousParts: p.threadParts,
                        previousLongForm: p.longFormBody,
                      },
                      ...p.editHistory,
                    ],
                    updatedAt: new Date().toISOString(),
                  }
            ),
          }));
          return true;
        },

        deleteOrArchivePost: (postId, actorId, mode) => {
          set((s) => ({
            posts: s.posts
              .map((p) => {
                const realOwner = p.internalAuthorId || p.authorId;
                if (p.id !== postId) return p;
                if (realOwner !== actorId && actorId !== 'admin') return p;
                if (mode === 'delete') return { ...p, lifecycleStatus: 'removed' as const };
                if (mode === 'archive') return { ...p, lifecycleStatus: 'archived' as const };
                return { ...p, lifecycleStatus: 'published' as const };
              }),
          }));
        },

        togglePinPost: (postId, scope) => {
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId
                ? p
                : scope === 'profile'
                ? { ...p, isPinnedProfile: !p.isPinnedProfile }
                : { ...p, isPinnedCommunity: !p.isPinnedCommunity }
            ),
          }));
        },

        summarizePostWithAi: async (postId) => {
          const post = get().posts.find((p) => p.id === postId);
          if (!post) return;
          const revHash = `${post.updatedAt}-${post.comments.length}`;
          if (post.aiSummary && post.aiSummary.contentRevisionHash === revHash) return;
          const summary = await generatePapyAiPostSummary(post);
          set((s) => ({
            posts: s.posts.map((p) => (p.id === postId ? { ...p, aiSummary: summary } : p)),
          }));
        },

        voteDebateSide: (postId, side, userId) => {
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId || !p.debate) return p;
              const cleanA = p.debate.sideAVoterIds.filter((id) => id !== userId);
              const cleanB = p.debate.sideBVoterIds.filter((id) => id !== userId);
              return {
                ...p,
                debate: {
                  ...p.debate,
                  sideAVoterIds: side === 'A' ? [...cleanA, userId] : cleanA,
                  sideBVoterIds: side === 'B' ? [...cleanB, userId] : cleanB,
                },
              };
            }),
          }));
        },

        addDebateArgument: (postId, side, author, content) => {
          const clean = content.trim();
          if (!clean) return;
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId || !p.debate
                ? p
                : {
                    ...p,
                    debate: {
                      ...p.debate,
                      arguments: [
                        ...p.debate.arguments,
                        {
                          id: `darg-${Date.now()}`,
                          side,
                          authorId: author.id,
                          authorName: author.name,
                          authorAvatar: author.avatar,
                          content: clean,
                          upvoterIds: [],
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    },
                  }
            ),
          }));
        },

        togglePostEmojiReaction: (postId, reaction, userId) => {
          if (!userId) return;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              const alreadySame = (p.reactions[reaction] ?? []).includes(userId);
              // Ensure 1 active reaction per user per post (Facebook/Messenger model — zero duplicate reaction bugs on rapid taps!)
              const cleanedReactions: Partial<Record<EmojiReactionType, string[]>> = {};
              for (const [k, list] of Object.entries(p.reactions) as Array<[EmojiReactionType, string[]]>) {
                const filtered = (list ?? []).filter((id) => id !== userId);
                if (filtered.length > 0) cleanedReactions[k] = filtered;
              }
              if (!alreadySame) {
                cleanedReactions[reaction] = [...(cleanedReactions[reaction] ?? []), userId];
              }
              return { ...p, reactions: cleanedReactions };
            }),
          }));
        },

        addThreadedReply: (input) => {
          const clean = input.content.trim();
          if (!clean && !input.mediaItem) return null;
          const reply: ThreadedReplyItem = {
            id: `scmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            postId: input.postId,
            parentCommentId: input.parentCommentId,
            authorId: input.authorId,
            authorName: input.authorName,
            authorAvatar: input.authorAvatar,
            content: clean,
            mediaItem: input.mediaItem ?? null,
            mentionedUserIds: input.mentionedUserIds ?? [],
            reactions: {},
            isPinned: false,
            isEdited: false,
            createdAt: new Date().toISOString(),
          };
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== input.postId ? p : { ...p, comments: [...p.comments, reply] }
            ),
          }));
          return reply;
        },

        editOrDeleteComment: (postId, commentId, actorId, newContent) => {
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              if (newContent === null || newContent === undefined) {
                return {
                  ...p,
                  comments: p.comments.filter(
                    (c) =>
                      !(
                        (c.id === commentId || c.parentCommentId === commentId) &&
                        (c.authorId === actorId || actorId === 'admin')
                      )
                  ),
                };
              }
              return {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId && c.authorId === actorId
                    ? { ...c, content: newContent.trim(), isEdited: true, updatedAt: new Date().toISOString() }
                    : c
                ),
              };
            }),
          }));
        },

        toggleCommentReaction: (postId, commentId, reaction, userId) => {
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId
                ? p
                : {
                    ...p,
                    comments: p.comments.map((c) => {
                      if (c.id !== commentId) return c;
                      const prev = c.reactions[reaction] ?? [];
                      const next = prev.includes(userId)
                        ? prev.filter((id) => id !== userId)
                        : [...prev, userId];
                      return { ...c, reactions: { ...c.reactions, [reaction]: next } };
                    }),
                  }
            ),
          }));
        },

        togglePinComment: (postId, commentId) => {
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId
                ? p
                : {
                    ...p,
                    comments: p.comments.map((c) =>
                      c.id === commentId ? { ...c, isPinned: !c.isPinned } : c
                    ),
                  }
            ),
          }));
        },

        togglePureRepost: (postId, userId) => {
          let activeNow = false;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              const has = p.repostedByIds.includes(userId);
              activeNow = !has;
              return {
                ...p,
                repostedByIds: has
                  ? p.repostedByIds.filter((id) => id !== userId)
                  : [...p.repostedByIds, userId],
              };
            }),
          }));
          return activeNow;
        },

        toggleSaveBookmark: (userId, postId, collectionId) => {
          const scope = userId || 'guest';
          let saved = false;
          set((s) => {
            const slice = getSlice(s, scope);
            const has = slice.bookmarkedPostIds.includes(postId);
            saved = !has;
            const nextBookmarked = has
              ? slice.bookmarkedPostIds.filter((id) => id !== postId)
              : [postId, ...slice.bookmarkedPostIds];

            // Smart AI Topic Auto-Classification into Smart Collections!
            const targetPost = s.posts.find((p) => p.id === postId);
            const nextCollections = slice.collections.map((col) => {
              if (has) {
                return { ...col, postIds: col.postIds.filter((id) => id !== postId) };
              }
              if (collectionId && col.id === collectionId) {
                return { ...col, postIds: Array.from(new Set([postId, ...col.postIds])) };
              }
              if (
                !collectionId &&
                col.isSmart &&
                col.topicRule &&
                targetPost?.topics.some((t) => t.toLowerCase().includes(col.topicRule!.toLowerCase()))
              ) {
                return { ...col, postIds: Array.from(new Set([postId, ...col.postIds])) };
              }
              return col;
            });

            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  bookmarkedPostIds: nextBookmarked,
                  collections: nextCollections,
                },
              },
            };
          });
          return saved;
        },

        toggleFavouritePost: (userId, postId) => {
          const scope = userId || 'guest';
          let fav = false;
          set((s) => {
            const slice = getSlice(s, scope);
            const has = slice.favouritePostIds.includes(postId);
            fav = !has;
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  favouritePostIds: has
                    ? slice.favouritePostIds.filter((id) => id !== postId)
                    : [postId, ...slice.favouritePostIds],
                },
              },
            };
          });
          return fav;
        },

        createBookmarkCollection: (userId, name, coverEmoji, topicRule) => {
          const scope = userId || 'guest';
          const col: BookmarkCollection = {
            id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            ownerId: scope,
            name: name.trim() || 'Bộ sưu tập mới',
            coverEmoji: coverEmoji || '🔖',
            topicRule: topicRule?.trim() || undefined,
            isSmart: Boolean(topicRule?.trim()),
            postIds: [],
            createdAt: new Date().toISOString(),
          };
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: { ...slice, collections: [col, ...slice.collections] },
              },
            };
          });
          return col;
        },

        deleteBookmarkCollection: (userId, collectionId) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  collections: slice.collections.filter((c) => c.id !== collectionId),
                },
              },
            };
          });
        },

        voteUnifiedPoll: (targetKind, targetId, optionId, userId) => {
          if (!userId) return;
          const applyVoteToPoll = (poll: UnifiedPoll): UnifiedPoll => {
            if (poll.isClosed || (poll.expiresAt && Date.parse(poll.expiresAt) <= Date.now())) {
              return poll;
            }
            const alreadyVotedAny = poll.options.some((o) => o.voterIds.includes(userId));
            if (alreadyVotedAny && !poll.allowChangeVote) return poll;

            return {
              ...poll,
              options: poll.options.map((opt) => {
                const hasThis = opt.voterIds.includes(userId);
                if (poll.allowMultiple) {
                  if (opt.id !== optionId) return opt;
                  return {
                    ...opt,
                    voterIds: hasThis
                      ? opt.voterIds.filter((id) => id !== userId)
                      : [...opt.voterIds, userId],
                  };
                }
                // Single choice
                if (opt.id === optionId) {
                  return {
                    ...opt,
                    voterIds: hasThis
                      ? opt.voterIds.filter((id) => id !== userId)
                      : [...opt.voterIds, userId],
                  };
                }
                return { ...opt, voterIds: opt.voterIds.filter((id) => id !== userId) };
              }),
            };
          };

          if (targetKind === 'post') {
            set((s) => ({
              posts: s.posts.map((p) =>
                p.id === targetId && p.poll ? { ...p, poll: applyVoteToPoll(p.poll) } : p
              ),
            }));
          } else {
            set((s) => ({
              chatMessages: s.chatMessages.map((m) =>
                m.id === targetId && m.poll ? { ...m, poll: applyVoteToPoll(m.poll) } : m
              ),
            }));
          }
        },

        addUnifiedPollOption: (targetKind, targetId, text, user) => {
          const clean = text.trim();
          if (!clean) return;
          const appendOpt = (poll: UnifiedPoll): UnifiedPoll => {
            if (!poll.allowAddOptions || poll.isClosed) return poll;
            if (poll.options.some((o) => o.text.toLowerCase() === clean.toLowerCase())) return poll;
            return {
              ...poll,
              options: [
                ...poll.options,
                {
                  id: `popt-${Date.now()}`,
                  text: clean,
                  voterIds: [user.id],
                  addedByUserId: user.id,
                  addedByName: user.name,
                },
              ],
            };
          };
          if (targetKind === 'post') {
            set((s) => ({
              posts: s.posts.map((p) =>
                p.id === targetId && p.poll ? { ...p, poll: appendOpt(p.poll) } : p
              ),
            }));
          } else {
            set((s) => ({
              chatMessages: s.chatMessages.map((m) =>
                m.id === targetId && m.poll ? { ...m, poll: appendOpt(m.poll) } : m
              ),
            }));
          }
        },

        toggleCloseUnifiedPoll: (targetKind, targetId, actorId) => {
          const toggleClose = (poll: UnifiedPoll): UnifiedPoll =>
            poll.createdBy === actorId || actorId === 'admin'
              ? { ...poll, isClosed: !poll.isClosed }
              : poll;
          if (targetKind === 'post') {
            set((s) => ({
              posts: s.posts.map((p) =>
                p.id === targetId && p.poll ? { ...p, poll: toggleClose(p.poll) } : p
              ),
            }));
          } else {
            set((s) => ({
              chatMessages: s.chatMessages.map((m) =>
                m.id === targetId && m.poll ? { ...m, poll: toggleClose(m.poll) } : m
              ),
            }));
          }
        },

        setFeedScrollOffset: (y) => set({ feedScrollOffset: y }),

        updateYourAlgo: (userId, patch) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  algo: {
                    ...slice.algo,
                    ...patch,
                    boostedTopics: patch.boostedTopics
                      ? Array.from(new Set(patch.boostedTopics))
                      : slice.algo.boostedTopics,
                    hiddenTopics: patch.hiddenTopics
                      ? Array.from(new Set(patch.hiddenTopics))
                      : slice.algo.hiddenTopics,
                    mutedKeywords: patch.mutedKeywords
                      ? Array.from(new Set(patch.mutedKeywords))
                      : slice.algo.mutedKeywords,
                  },
                },
              },
            };
          });
        },

        resetYourAlgo: (userId) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: { ...slice, algo: { ...DEFAULT_ALGO } },
              },
            };
          });
        },

        saveCustomFeed: (userId, feedInput) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            const exists = feedInput.id
              ? slice.customFeeds.find((f) => f.id === feedInput.id)
              : undefined;
            const nextFeeds = exists
              ? slice.customFeeds.map((f) => (f.id === exists.id ? { ...f, ...feedInput } : f))
              : [
                  ...slice.customFeeds,
                  {
                    ...feedInput,
                    id: `cf-${Date.now()}`,
                    ownerId: scope,
                    order: slice.customFeeds.length,
                  },
                ];
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: { ...slice, customFeeds: nextFeeds },
              },
            };
          });
        },

        deleteCustomFeed: (userId, feedId) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  customFeeds: slice.customFeeds.filter((f) => f.id !== feedId),
                },
              },
            };
          });
        },

        recordSearchQuery: (userId, query) => {
          const clean = query.trim();
          if (clean.length < 2) return;
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: {
                  ...slice,
                  recentSearchQueries: [
                    clean,
                    ...slice.recentSearchQueries.filter((q) => q.toLowerCase() !== clean.toLowerCase()),
                  ].slice(0, 12),
                },
              },
            };
          });
        },

        clearSearchHistory: (userId) => {
          const scope = userId || 'guest';
          set((s) => {
            const slice = getSlice(s, scope);
            return {
              userSlices: {
                ...s.userSlices,
                [scope]: { ...slice, recentSearchQueries: [] },
              },
            };
          });
        },

        createCommunity: (input) => {
          const slug =
            input.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `comm-${Date.now()}`;
          const comm: SocialCommunityGroup = {
            id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            slug,
            name: input.name.trim(),
            description: input.description.trim(),
            avatarEmoji: input.avatarEmoji || '🏛️',
            accentColor: input.accentColor || '#6366F1',
            coverUrl: null,
            visibility: input.visibility,
            topics: input.topics,
            rules: input.rules.length > 0 ? input.rules : ['1. Tôn trọng thành viên & chia sẻ tri thức văn minh.'],
            requirePostApproval: Boolean(input.requirePostApproval),
            requireMemberApproval: input.visibility === 'private',
            allowAnonymousPosts: input.allowAnonymousPosts ?? true,
            isSuspended: false,
            ownerId: input.ownerId,
            members: [
              {
                userId: input.ownerId,
                displayName: input.ownerName,
                avatarUrl: null,
                role: 'owner',
                reputationPoints: 150,
                helpfulCount: 1,
                badges: ['Community Founder'],
                joinedAt: new Date().toISOString(),
              },
            ],
            pinnedPostIds: [],
            announcements: [],
            events: [],
            activityLogs: [
              {
                id: `alog-${Date.now()}`,
                actorName: input.ownerName,
                action: 'Khởi tạo cộng đồng',
                createdAt: new Date().toISOString(),
              },
            ],
            createdAt: new Date().toISOString(),
          };
          set((s) => ({ communities: [comm, ...s.communities] }));
          return comm;
        },

        joinOrLeaveCommunity: (communityId, user) => {
          let outcome = 'joined';
          set((s) => ({
            communities: s.communities.map((c) => {
              if (c.id !== communityId) return c;
              const existing = c.members.find((m) => m.userId === user.id);
              if (existing) {
                if (existing.role === 'banned') {
                  outcome = 'banned';
                  return c;
                }
                outcome = 'left';
                return { ...c, members: c.members.filter((m) => m.userId !== user.id) };
              }
              const role: CommunityRole = c.requireMemberApproval ? 'pending' : 'member';
              outcome = role === 'pending' ? 'pending' : 'joined';
              return {
                ...c,
                members: [
                  ...c.members,
                  {
                    userId: user.id,
                    displayName: user.name,
                    avatarUrl: user.avatar,
                    role,
                    reputationPoints: 25,
                    helpfulCount: 0,
                    badges: [],
                    joinedAt: new Date().toISOString(),
                  },
                ],
              };
            }),
          }));
          return outcome;
        },

        updateCommunityMemberRole: (communityId, actorName, targetUserId, role) => {
          set((s) => ({
            communities: s.communities.map((c) =>
              c.id !== communityId
                ? c
                : {
                    ...c,
                    members: c.members.map((m) =>
                      m.userId === targetUserId ? { ...m, role } : m
                    ),
                    activityLogs: [
                      {
                        id: `alog-${Date.now()}`,
                        actorName,
                        action: `Cập nhật vai trò thành viên thành "${role}"`,
                        createdAt: new Date().toISOString(),
                      },
                      ...c.activityLogs,
                    ].slice(0, 50),
                  }
            ),
          }));
        },

        approvePendingPost: (postId, approve) => {
          set((s) => ({
            posts: s.posts.map((p) =>
              p.id !== postId
                ? p
                : { ...p, lifecycleStatus: approve ? 'published' : 'removed' }
            ),
          }));
        },

        createCommunityEvent: (input) => {
          const ev: CommunityEventItem = {
            id: `evt-${Date.now()}`,
            communityId: input.communityId,
            creatorId: input.creatorId,
            creatorName: input.creatorName,
            title: input.title.trim(),
            description: input.description.trim(),
            locationLabel: input.locationLabel.trim() || 'Online · Papyrus Live',
            startsAt: input.startsAt,
            status: 'scheduled',
            rsvpUserIds: [input.creatorId],
            reminderUserIds: [input.creatorId],
          };
          set((s) => ({
            communities: s.communities.map((c) =>
              c.id !== input.communityId ? c : { ...c, events: [ev, ...c.events] }
            ),
          }));
          return ev;
        },

        toggleEventRsvp: (communityId, eventId, userId) => {
          set((s) => ({
            communities: s.communities.map((c) =>
              c.id !== communityId
                ? c
                : {
                    ...c,
                    events: c.events.map((ev) => {
                      if (ev.id !== eventId) return ev;
                      const has = ev.rsvpUserIds.includes(userId);
                      return {
                        ...ev,
                        rsvpUserIds: has
                          ? ev.rsvpUserIds.filter((id) => id !== userId)
                          : [...ev.rsvpUserIds, userId],
                      };
                    }),
                  }
            ),
          }));
        },

        openOrCreateDirectConversation: (me, peer) => {
          const state = get();
          const existing = state.conversations.find(
            (c) =>
              c.kind === 'direct' &&
              (c.peerUserId === peer.id ||
                (c.memberIds.includes(me.id) && c.memberIds.includes(peer.id)))
          );
          if (existing) return existing;

          const graph = {
            follows: state.follows,
            friendRequests: state.friendRequests,
            relations: state.relations,
            communities: state.communities,
          };
          const isFriend = areUsersFriends(me.id, peer.id, graph);
          const conv: MessagingConversation = {
            id: `conv-dm-${peer.id.slice(0, 12)}-${me.id.slice(0, 6)}`,
            kind: 'direct',
            title: peer.name.trim() || 'Thành viên Papyrus',
            subtitle: isFriend ? 'Bạn bè trên Papyrus · Đang hoạt động' : 'Tin nhắn chờ kết nối',
            avatarUrl: peer.avatar ?? null,
            accentColor: '#0EA5E9',
            peerUserId: peer.id,
            memberIds: [me.id, peer.id],
            adminIds: [me.id, peer.id],
            requestState: isFriend ? 'accepted' : 'accepted',
            isPinned: false,
            isMuted: false,
            pinnedMessageId: null,
            announcement: '',
            typingUserNames: [],
            lastMessagePreview: 'Bắt đầu cuộc trò chuyện mới',
            lastMessageAt: new Date().toISOString(),
            unreadByUserIds: {},
          };
          set((s) => ({ conversations: [conv, ...s.conversations] }));
          return conv;
        },

        createGroupConversation: (input) => {
          const conv: MessagingConversation = {
            id: `conv-grp-${Date.now()}`,
            kind: 'group',
            title: input.title.trim() || 'Nhóm Học Tập Mới',
            subtitle: `${input.memberIds.length} thành viên · ${input.topic || 'Thảo luận nhóm'}`,
            avatarUrl: null,
            accentColor: '#6366F1',
            memberIds: Array.from(new Set([input.creatorId, ...input.memberIds])),
            adminIds: [input.creatorId],
            requestState: 'accepted',
            isPinned: false,
            isMuted: false,
            pinnedMessageId: null,
            announcement: '',
            typingUserNames: [],
            lastMessagePreview: 'Nhóm vừa được tạo',
            lastMessageAt: new Date().toISOString(),
            unreadByUserIds: {},
          };
          set((s) => ({ conversations: [conv, ...s.conversations] }));
          return conv;
        },

        acceptOrArchiveConversation: (conversationId, requestState) => {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conversationId ? { ...c, requestState } : c
            ),
          }));
        },

        togglePinOrMuteConversation: (conversationId, field) => {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conversationId ? { ...c, [field]: !c[field] } : c
            ),
          }));
        },

        markConversationRead: (conversationId, userId) => {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id !== conversationId
                ? c
                : { ...c, unreadByUserIds: { ...c.unreadByUserIds, [userId]: 0 } }
            ),
            chatMessages: s.chatMessages.map((m) =>
              m.conversationId === conversationId && !m.readByIds.includes(userId)
                ? { ...m, deliveryStatus: 'read', readByIds: [...m.readByIds, userId] }
                : m
            ),
          }));
        },

        sendChatMessage: (input) => {
          const nowIso = new Date().toISOString();
          const msg: DirectOrGroupMessage = {
            id: `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            conversationId: input.conversationId,
            senderId: input.senderId,
            senderName: input.senderName,
            senderAvatar: input.senderAvatar,
            text: input.text.trim(),
            mediaAttachments: input.mediaAttachments ?? [],
            sharedPost: input.sharedPost ?? null,
            poll: input.poll ?? null,
            quizCard: input.quizCard ?? null,
            replyTo: input.replyTo ?? null,
            forwardedFromName: input.forwardedFromName,
            reactions: {},
            isEdited: false,
            isRecalled: false,
            deliveryStatus: 'delivered',
            readByIds: [input.senderId],
            createdAt: nowIso,
          };

          const preview = input.sharedPost
            ? `${input.senderName} đã chia sẻ bài viết của ${input.sharedPost.authorName}`
            : input.poll
            ? `📊 Bình chọn: ${input.poll.question}`
            : input.mediaAttachments?.length
            ? `📎 ${input.senderName} đã gửi phương tiện đính kèm`
            : msg.text;

          set((s) => ({
            chatMessages: [...s.chatMessages, msg].slice(-500),
            conversations: s.conversations.map((c) =>
              c.id !== input.conversationId
                ? c
                : {
                    ...c,
                    lastMessagePreview: preview.slice(0, 90),
                    lastMessageAt: nowIso,
                  }
            ),
          }));

          broadcastCommunityEvent({
            type: 'new-message',
            message: {
              id: msg.id,
              channelId: msg.conversationId,
              senderId: msg.senderId,
              senderName: msg.senderName,
              senderAvatar: msg.senderAvatar,
              text: preview,
              reactions: {},
              createdAt: msg.createdAt,
            },
          });

          return msg;
        },

        editOrRecallChatMessage: (messageId, senderId, mode, newText) => {
          set((s) => ({
            chatMessages: s.chatMessages.map((m) => {
              if (m.id !== messageId || m.senderId !== senderId) return m;
              if (mode === 'recall') {
                return {
                  ...m,
                  isRecalled: true,
                  text: 'Tin nhắn đã được thu hồi',
                  mediaAttachments: [],
                  sharedPost: null,
                };
              }
              return {
                ...m,
                text: (newText ?? m.text).trim(),
                isEdited: true,
                updatedAt: new Date().toISOString(),
              };
            }),
          }));
        },

        toggleChatMessageReaction: (messageId, emoji, userId) => {
          set((s) => ({
            chatMessages: s.chatMessages.map((m) => {
              if (m.id !== messageId) return m;
              const prev = m.reactions[emoji] ?? [];
              const next = prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId];
              return { ...m, reactions: { ...m.reactions, [emoji]: next } };
            }),
          }));
        },

        pinChatMessage: (conversationId, messageId) => {
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conversationId ? { ...c, pinnedMessageId: messageId } : c
            ),
          }));
        },

        sharePostToDestination: (post, sender, destination, commentText) => {
          // Build rich SharedPostReference (NEVER raw URL/text!)
          const firstMedia = post.mediaItems[0];
          const sharedRef: SharedPostReference = {
            postId: post.id,
            authorId: post.isAnonymous ? 'anonymous-member' : post.authorId,
            authorName: post.isAnonymous ? 'Thành viên Ẩn danh' : post.authorName,
            authorAvatar: post.isAnonymous ? null : post.authorAvatar,
            previewText: post.isSpoiler
              ? `⚠️ [Spoiler] ${post.spoilerWarning || 'Chạm để mở bài viết gốc'}`
              : (post.threadParts[0] || post.longFormBody || '').slice(0, 180),
            thumbnailUri: firstMedia?.thumbnailUri || firstMedia?.uri || null,
            mediaKind:
              firstMedia?.kind === 'video'
                ? 'video'
                : firstMedia?.kind === 'image' || firstMedia?.kind === 'gif'
                ? 'image'
                : post.poll
                ? 'poll'
                : post.attachedQuiz
                ? 'quiz'
                : 'text',
            postKind: post.postKind,
            createdAt: post.createdAt,
          };

          set((s) => ({
            posts: s.posts.map((p) =>
              p.id === post.id ? { ...p, sharesCount: p.sharesCount + 1 } : p
            ),
          }));

          if (destination.type === 'conversation') {
            get().sendChatMessage({
              conversationId: destination.conversationId,
              senderId: sender.id,
              senderName: sender.name,
              senderAvatar: sender.avatar,
              text: commentText?.trim() || '',
              sharedPost: sharedRef,
            });
          } else {
            get().createSocialPost({
              authorId: sender.id,
              authorName: sender.name,
              authorAvatar: sender.avatar,
              communityId: destination.communityId,
              postKind: 'standard',
              threadParts: [commentText?.trim() || `Chia sẻ bài viết đáng chú ý vào cộng đồng:`],
              repostOfId: post.id,
              isQuote: true,
              audience: 'community',
            });
          }
        },

        submitModerationReport: (input) => {
          const lower = `${input.targetPreview} ${input.details}`.toLowerCase();
          const hasSpamSignal = /(lừa đảo|cá độ|18\+|hack|spam|chửi|xúc phạm)/i.test(lower);
          const item: SocialModerationCase = {
            id: `mcase-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            reporterId: input.reporterId,
            reporterName: input.reporterName,
            targetType: input.targetType,
            targetId: input.targetId,
            targetPreview: input.targetPreview.slice(0, 220),
            targetOwnerId: input.targetOwnerId,
            reason: input.reason,
            details: input.details,
            aiFlagSummary: hasSpamSignal
              ? 'PapyAI Safety: Phát hiện từ khóa nhạy cảm — Đề xuất Kiểm duyệt viên ưu tiên xem xét (Không tự động khóa vĩnh viễn).'
              : 'PapyAI Safety: Chuyển vào hàng đợi Pending Review để Quản trị viên xác minh.',
            aiSpamScore: hasSpamSignal ? 86 : 24,
            workflowStatus: 'pending_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((s) => ({ moderationCases: [item, ...s.moderationCases] }));
          void persistModerationCaseToSupabase(item);
          return item;
        },

        applyAdminModerationAction: (caseId, adminName, workflowStatus, action, reason = '') => {
          const targetCase = get().moderationCases.find((c) => c.id === caseId);
          set((s) => ({
            moderationCases: s.moderationCases.map((c) =>
              c.id !== caseId
                ? c
                : {
                    ...c,
                    workflowStatus,
                    appliedAction: action ?? c.appliedAction,
                    reviewedBy: adminName,
                    updatedAt: new Date().toISOString(),
                  }
            ),
            posts:
              targetCase?.targetType === 'post' &&
              (action === 'hide_content' || action === 'remove_content')
                ? s.posts.map((p) =>
                    p.id === targetCase.targetId ? { ...p, lifecycleStatus: 'removed' } : p
                  )
                : targetCase?.targetType === 'post' && action === 'restore_content'
                ? s.posts.map((p) =>
                    p.id === targetCase.targetId ? { ...p, lifecycleStatus: 'published' } : p
                  )
                : s.posts,
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: adminName,
                actionType: action ? `${workflowStatus}:${action}` : workflowStatus,
                targetType: targetCase?.targetType ?? 'case',
                targetId: targetCase?.targetId ?? caseId,
                reason: reason || targetCase?.reason || 'Xử lý kiểm duyệt',
                createdAt: new Date().toISOString(),
              },
              ...s.auditLogs,
            ].slice(0, 200),
          }));
        },

        submitUserAppeal: (caseId, userId, appealReason) => {
          set((s) => ({
            moderationCases: s.moderationCases.map((c) =>
              c.id === caseId && c.targetOwnerId === userId
                ? {
                    ...c,
                    workflowStatus: 'appealed',
                    appealReason: appealReason.trim(),
                    updatedAt: new Date().toISOString(),
                  }
                : c
            ),
          }));
        },

        resolveUserAppeal: (caseId, adminName, decision, note) => {
          const targetCase = get().moderationCases.find((c) => c.id === caseId);
          set((s) => ({
            moderationCases: s.moderationCases.map((c) =>
              c.id !== caseId
                ? c
                : {
                    ...c,
                    workflowStatus: 'resolved',
                    appealDecision: decision,
                    reviewedBy: adminName,
                    updatedAt: new Date().toISOString(),
                  }
            ),
            posts:
              decision === 'accepted' && targetCase?.targetType === 'post'
                ? s.posts.map((p) =>
                    p.id === targetCase.targetId ? { ...p, lifecycleStatus: 'published' } : p
                  )
                : s.posts,
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: adminName,
                actionType: `appeal_${decision}`,
                targetType: targetCase?.targetType ?? 'appeal',
                targetId: caseId,
                reason: note,
                createdAt: new Date().toISOString(),
              },
              ...s.auditLogs,
            ].slice(0, 200),
          }));
        },

        updateUserAccountStatusAdmin: (targetUserId, adminName, patch, reason) => {
          set((s) => {
            const prof = s.profilesById[targetUserId];
            if (!prof) return s;
            return {
              profilesById: {
                ...s.profilesById,
                [targetUserId]: {
                  ...prof,
                  ...(patch.accountStatus ? { accountStatus: patch.accountStatus } : {}),
                  ...(patch.role ? { role: patch.role } : {}),
                },
              },
              auditLogs: [
                {
                  id: `audit-${Date.now()}`,
                  actorName: adminName,
                  actionType: `user_update:${patch.accountStatus ?? patch.role ?? 'status'}`,
                  targetType: 'user',
                  targetId: targetUserId,
                  reason,
                  createdAt: new Date().toISOString(),
                },
                ...s.auditLogs,
              ].slice(0, 200),
            };
          });
        },

        createOrUpdateAdminDocument: async (adminName, docInput) => {
          const nowIso = new Date().toISOString();
          const existing = docInput.id
            ? get().adminDocuments.find((d) => d.id === docInput.id)
            : undefined;
          const doc: AdminManagedDocument = existing
            ? {
                ...existing,
                ...docInput,
                updatedAt: nowIso,
              }
            : {
                ...docInput,
                id: `adoc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                downloadCount: 0,
                giftHistory: [],
                createdAt: nowIso,
                updatedAt: nowIso,
              };

          const cloudRes = await uploadAdminDocumentToSupabase(doc);
          if (cloudRes.storagePath) {
            doc.storagePath = cloudRes.storagePath;
          }

          set((s) => ({
            adminDocuments: existing
              ? s.adminDocuments.map((d) => (d.id === existing.id ? doc : d))
              : [doc, ...s.adminDocuments],
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: adminName,
                actionType: existing ? 'update_document' : 'create_document',
                targetType: 'document',
                targetId: doc.id,
                reason: doc.title,
                createdAt: nowIso,
              },
              ...s.auditLogs,
            ].slice(0, 200),
          }));

          return doc;
        },

        deleteAdminDocument: (adminName, docId) => {
          set((s) => ({
            adminDocuments: s.adminDocuments.filter((d) => d.id !== docId),
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: adminName,
                actionType: 'delete_document',
                targetType: 'document',
                targetId: docId,
                reason: 'Xóa tài liệu quản trị',
                createdAt: new Date().toISOString(),
              },
              ...s.auditLogs,
            ].slice(0, 200),
          }));
        },

        giftAdminDocument: (input) => {
          let updatedDoc: AdminManagedDocument | null = null;
          set((s) => ({
            adminDocuments: s.adminDocuments.map((d) => {
              if (d.id !== input.docId) return d;
              const nextUsers =
                input.targetScope === 'all_users'
                  ? Array.from(new Set([...d.recipientUserIds, 'all']))
                  : input.userIds
                  ? Array.from(new Set([...d.recipientUserIds, ...input.userIds]))
                  : d.recipientUserIds;
              const nextComms =
                input.targetScope === 'community' && input.communityId
                  ? Array.from(new Set([...d.recipientCommunityIds, input.communityId]))
                  : d.recipientCommunityIds;
              updatedDoc = {
                ...d,
                status: 'published',
                expiresAt: input.expiresAt ?? d.expiresAt,
                recipientUserIds: nextUsers,
                recipientCommunityIds: nextComms,
                giftHistory: [
                  {
                    id: `gh-${Date.now()}`,
                    targetLabel: input.targetLabel,
                    giftedAt: new Date().toISOString(),
                    expiresAt: input.expiresAt ?? null,
                  },
                  ...d.giftHistory,
                ],
                updatedAt: new Date().toISOString(),
              };
              return updatedDoc;
            }),
            auditLogs: [
              {
                id: `audit-${Date.now()}`,
                actorName: input.adminName,
                actionType: `gift_document:${input.targetScope}`,
                targetType: 'document',
                targetId: input.docId,
                reason: `Tặng tài liệu cho ${input.targetLabel}`,
                createdAt: new Date().toISOString(),
              },
              ...s.auditLogs,
            ].slice(0, 200),
          }));
          return updatedDoc;
        },

        recordDocumentDownload: (docId) => {
          set((s) => ({
            adminDocuments: s.adminDocuments.map((d) =>
              d.id === docId ? { ...d, downloadCount: d.downloadCount + 1 } : d
            ),
          }));
        },
      };
    },
    {
      name: 'papyrus.social.v3',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
