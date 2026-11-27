import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import {
  broadcastCommunityEvent,
  fetchRealProfilesDirectory,
  fetchSocialHydrationSnapshot,
  generateClientUuid,
  generatePapyAiPostSummary,
  persistChatMessageToSupabase,
  persistCommunityMembershipToSupabase,
  persistCommunityToSupabase,
  persistConversationToSupabase,
  persistFollowEdgeToSupabase,
  persistFriendRequestToSupabase,
  persistModerationCaseToSupabase,
  persistSocialPostToSupabase,
  syncPostEngagementToSupabase,
  syncUnifiedProfileToSupabase,
  triggerServerPostLifecycleSweep,
  uploadAdminDocumentToSupabase,
} from '@/composition/social';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
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

const LEGACY_FAKE_USER_IDS = new Set([
  'scholar-khanh',
  'scholar-minhquan',
  'scholar-haianh',
  'scholar-baonam',
]);
const LEGACY_FAKE_POST_IDS = new Set(['spost-1', 'spost-2', 'spost-3', 'post-seed-1', 'post-seed-2']);
const LEGACY_FAKE_CONV_IDS = new Set(['conv-grp-software', 'conv-live-exam-room']);
const LEGACY_FAKE_MSG_IDS = new Set(['cmsg-1', 'cmsg-2', 'cmsg-3', 'msg-pin-it', 'msg-it-2', 'msg-pin-stem']);
const LEGACY_FAKE_FREQ_IDS = new Set(['freq-seed-1']);
const LEGACY_FAKE_DOC_IDS = new Set(['adoc-1']);

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
    customFeeds: [],
    algo: { ...DEFAULT_ALGO },
    dismissedRecommendationIds: [],
    recentSearchQueries: [],
    recentEmojisAndStickers: ['❤️', '🔥', '👏', '💡'],
  };
}

/**
 * Clean official topic communities with ZERO fake bot members.
 */
const STARTER_COMMUNITIES: SocialCommunityGroup[] = [
  {
    id: 'comm-software-ai',
    slug: 'ky-thuat-phan-mem-ai',
    name: 'Kỹ thuật Phần mềm & AI',
    description:
      'Thảo luận kiến trúc hệ thống, thuật toán, lập trình đa nền tảng và trí tuệ nhân tạo.',
    avatarEmoji: '💻',
    accentColor: '#6366F1',
    coverUrl: null,
    visibility: 'public',
    topics: ['CNTT', 'AI', 'ThuậtToán', 'HệĐiềuHành'],
    rules: [
      '1. Chia sẻ câu hỏi hoặc kiến thức rõ ràng, tôn trọng thành viên.',
      '2. Gắn nhãn ẩn nội dung khi đăng lời giải đề thi mới.',
    ],
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: true,
    isSuspended: false,
    ownerId: '',
    members: [],
    pinnedPostIds: [],
    announcements: [],
    events: [],
    activityLogs: [],
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'comm-stem-olympiad',
    slug: 'khoa-hoc-tu-nhien-stem',
    name: 'Khoa học Tự nhiên (Toán · Lý · Hóa · Sinh)',
    description:
      'Trao đổi bài tập đại cương, công thức trọng tâm và phương pháp nghiên cứu khoa học.',
    avatarEmoji: '🔬',
    accentColor: '#10B981',
    coverUrl: null,
    visibility: 'public',
    topics: ['ToánLýHóa', 'KhoaHọc', 'ÔnThi'],
    rules: ['1. Trình bày từng bước giải rõ ràng.', '2. Không đăng nội dung rác.'],
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: true,
    isSuspended: false,
    ownerId: '',
    members: [],
    pinnedPostIds: [],
    announcements: [],
    events: [],
    activityLogs: [],
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'comm-humanities',
    slug: 'lich-su-van-hoc',
    name: 'Lịch sử & Văn học',
    description:
      'Không gian trao đổi tư liệu lịch sử Việt Nam, lịch sử thế giới và tác phẩm văn học.',
    avatarEmoji: '🏛️',
    accentColor: '#F59E0B',
    coverUrl: null,
    visibility: 'public',
    topics: ['VănSử', 'NghiênCứu', 'ÔnThi'],
    rules: ['1. Dẫn nguồn tài liệu tham khảo rõ ràng.', '2. Thảo luận văn minh.'],
    requirePostApproval: false,
    requireMemberApproval: false,
    allowAnonymousPosts: true,
    isSuspended: false,
    ownerId: '',
    members: [],
    pinnedPostIds: [],
    announcements: [],
    events: [],
    activityLogs: [],
    createdAt: '2026-11-01T00:00:00.000Z',
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

  // Scope, Legacy Recovery & Cloud Sync
  switchAccountScope: (userId: string) => void;
  migrateLegacyUserContent: () => void;
  ensureUserProfile: (input: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: SocialUserProfile['role'];
    isPrivateAccount?: boolean;
    major?: string;
    bio?: string;
  }) => SocialUserProfile;
  propagateIdentityUpdate: (
    userId: string,
    patch: Partial<
      Pick<
        SocialUserProfile,
        | 'displayName'
        | 'avatarUrl'
        | 'coverUrl'
        | 'bio'
        | 'university'
        | 'major'
        | 'interests'
        | 'locationArea'
        | 'websiteUrl'
      >
    > & {
      privacy?: Partial<SocialUserProfile['privacy']>;
    }
  ) => void;
  syncCloudDirectory: () => Promise<void>;
  incrementProfileView: (targetUserId: string, viewerId: string) => void;

  // Social Graph (1-Way Follow vs 2-Way Friendship + Close Friends + Block/Mute/Restrict)
  toggleFollowUser: (
    followerId: string,
    targetId: string
  ) => 'followed' | 'requested' | 'unfollowed';
  respondFollowRequest: (ownerId: string, followerId: string, accept: boolean) => void;
  toggleCloseFriend: (userId: string, targetId: string) => void;
  sendFriendRequest: (senderId: string, receiverId: string) => void;
  respondFriendRequest: (requestId: string, accept: boolean) => void;
  cancelOrUnfriend: (userId: string, otherUserId: string) => void;
  toggleUserRelation: (actorId: string, targetId: string, type: UserRelationType) => boolean;
  dismissFriendRecommendation: (userId: string, targetId: string) => void;

  // Composer Drafts & Post Lifecycle
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
  }) => SocialPostItem | null;
  editSocialPost: (
    postId: string,
    editorId: string,
    nextParts: string[],
    nextLongForm?: string,
    nextMedia?: SocialMediaItem[]
  ) => boolean;
  deleteOrArchivePost: (
    postId: string,
    actorId: string,
    mode: 'delete' | 'archive' | 'restore'
  ) => void;
  togglePinPost: (postId: string, scope: 'profile' | 'community') => void;
  summarizePostWithAi: (postId: string) => Promise<void>;
  voteDebateSide: (postId: string, side: 'A' | 'B', userId: string) => void;
  addDebateArgument: (
    postId: string,
    side: 'A' | 'B',
    author: { id: string; name: string; avatar: string | null },
    content: string
  ) => void;

  // Engagement
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
  editOrDeleteComment: (
    postId: string,
    commentId: string,
    actorId: string,
    newContent?: string | null
  ) => void;
  toggleCommentReaction: (
    postId: string,
    commentId: string,
    reaction: EmojiReactionType,
    userId: string
  ) => void;
  togglePinComment: (postId: string, commentId: string) => void;
  togglePureRepost: (postId: string, userId: string) => boolean;
  toggleSaveBookmark: (userId: string, postId: string, collectionId?: string) => boolean;
  toggleFavouritePost: (userId: string, postId: string) => boolean;
  createBookmarkCollection: (
    userId: string,
    name: string,
    coverEmoji: string,
    topicRule?: string
  ) => BookmarkCollection;
  deleteBookmarkCollection: (userId: string, collectionId: string) => void;
  voteUnifiedPoll: (
    targetKind: 'post' | 'message',
    targetId: string,
    optionId: string,
    userId: string
  ) => void;
  addUnifiedPollOption: (
    targetKind: 'post' | 'message',
    targetId: string,
    text: string,
    user: { id: string; name: string }
  ) => void;
  toggleCloseUnifiedPoll: (
    targetKind: 'post' | 'message',
    targetId: string,
    actorId: string
  ) => void;

  // Custom Feeds, Your Algo & Scroll Recovery
  setFeedScrollOffset: (y: number) => void;
  updateYourAlgo: (userId: string, patch: Partial<YourAlgoConfig>) => void;
  resetYourAlgo: (userId: string) => void;
  saveCustomFeed: (
    userId: string,
    feed: Omit<CustomFeedConfig, 'id' | 'ownerId' | 'order'> & { id?: string }
  ) => void;
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
  }) => SocialCommunityGroup | null;
  joinOrLeaveCommunity: (
    communityId: string,
    user: { id: string; name: string; avatar: string | null }
  ) => string;
  updateCommunityMemberRole: (
    communityId: string,
    actorName: string,
    targetUserId: string,
    role: CommunityRole
  ) => void;
  approvePendingPost: (postId: string, approve: boolean) => void;
  createCommunityEvent: (input: {
    communityId: string;
    creatorId: string;
    creatorName: string;
    title: string;
    description: string;
    locationLabel: string;
    startsAt: string;
  }) => CommunityEventItem | null;
  toggleEventRsvp: (communityId: string, eventId: string, userId: string) => void;

  // Dedicated Messaging Center
  openOrCreateDirectConversation: (
    me: { id: string; name: string; avatar: string | null },
    peer: { id: string; name: string; avatar?: string | null }
  ) => MessagingConversation | null;
  createGroupConversation: (input: {
    creatorId: string;
    title: string;
    topic: string;
    memberIds: string[];
  }) => MessagingConversation | null;
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
  }) => DirectOrGroupMessage | null;
  editOrRecallChatMessage: (
    messageId: string,
    senderId: string,
    mode: 'edit' | 'recall',
    newText?: string
  ) => void;
  toggleChatMessageReaction: (messageId: string, emoji: string, userId: string) => void;
  pinChatMessage: (conversationId: string, messageId: string | null) => void;
  sharePostToDestination: (
    post: SocialPostItem,
    sender: { id: string; name: string; avatar: string | null },
    destination:
      | { type: 'conversation'; conversationId: string }
      | { type: 'community'; communityId: string },
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
  }) => SocialModerationCase | null;
  applyAdminModerationAction: (
    caseId: string,
    adminName: string,
    workflowStatus: ModerationWorkflowStatus,
    action?: ModerationActionKind,
    reason?: string
  ) => void;
  submitUserAppeal: (caseId: string, userId: string, appealReason: string) => void;
  resolveUserAppeal: (
    caseId: string,
    adminName: string,
    decision: 'accepted' | 'rejected',
    note: string
  ) => void;
  updateUserAccountStatusAdmin: (
    targetUserId: string,
    adminName: string,
    patch: { accountStatus?: SocialUserProfile['accountStatus']; role?: SocialUserProfile['role'] },
    reason: string
  ) => void;
  createOrUpdateAdminDocument: (
    adminName: string,
    doc: Omit<
      AdminManagedDocument,
      'id' | 'downloadCount' | 'giftHistory' | 'createdAt' | 'updatedAt'
    > & { id?: string }
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
        profilesById: {},
        follows: [],
        friendRequests: [],
        relations: [],
        posts: [],
        communities: STARTER_COMMUNITIES,
        conversations: [],
        chatMessages: [],
        moderationCases: [],
        adminDocuments: [],
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

        /**
         * Preserves 100% of real user-created posts & messages from `useCommunityStore` (`papyrus.community.v1`)
         * so nothing the user ever wrote disappears!
         */
        migrateLegacyUserContent: () => {
          const legacy = useCommunityStore.getState();
          const current = get();
          const existingPostIds = new Set(current.posts.map((p) => p.id));

          const migratedPosts: SocialPostItem[] = [];
          for (const lp of legacy.posts) {
            if (
              LEGACY_FAKE_POST_IDS.has(lp.id) ||
              LEGACY_FAKE_USER_IDS.has(lp.authorId) ||
              lp.authorId === 'guest' ||
              existingPostIds.has(lp.id)
            ) {
              continue;
            }
            const item: SocialPostItem = {
              id: lp.id,
              authorId: lp.authorId,
              internalAuthorId: lp.authorId,
              authorName: lp.authorName,
              authorAvatar: lp.authorAvatar,
              postKind: lp.threadParts.length > 1 ? 'thread' : 'standard',
              threadParts: lp.threadParts,
              mediaItems: lp.imageUri
                ? [{ id: `img-${lp.id}`, kind: 'image', uri: lp.imageUri, thumbnailUri: lp.imageUri }]
                : [],
              poll: lp.poll
                ? {
                    id: `poll-${lp.id}`,
                    scopeType: 'post',
                    question: lp.poll.question,
                    options: lp.poll.options,
                    allowMultiple: false,
                    isAnonymous: false,
                    allowAddOptions: false,
                    allowChangeVote: true,
                    isClosed: false,
                    createdBy: lp.authorId,
                    createdAt: lp.createdAt,
                  }
                : null,
              attachedQuiz: lp.attachedQuiz ?? null,
              codeSnippet: lp.codeSnippet,
              linkPreview: lp.sourceCitation
                ? {
                    url: lp.sourceCitation.url,
                    title: lp.sourceCitation.title,
                    description: lp.sourceCitation.sourceName || '',
                    siteName: lp.sourceCitation.sourceName,
                  }
                : null,
              isSpoiler: false,
              isAnonymous: false,
              audience: 'public',
              selectedAudienceIds: [],
              replyPermission: 'everyone',
              topics: lp.tags ?? [],
              hashtags: lp.tags ?? [],
              mentionedUserIds: [],
              reactions: {
                love: lp.reactions?.heart ?? [],
                bulb: lp.reactions?.bulb ?? [],
                fire: lp.reactions?.fire ?? [],
                clap: lp.reactions?.clap ?? [],
              },
              repostedByIds: lp.repostedByIds ?? [],
              quoteCount: 0,
              comments: (lp.comments ?? []).map((c) => ({
                id: c.id,
                postId: lp.id,
                parentCommentId: null,
                authorId: c.authorId,
                authorName: c.authorName,
                authorAvatar: c.authorAvatar,
                content: c.content,
                mentionedUserIds: [],
                reactions: {},
                isPinned: false,
                isEdited: false,
                createdAt: c.createdAt,
              })),
              isPinnedProfile: false,
              isPinnedCommunity: false,
              lifecycleStatus: 'published',
              editHistory: [],
              impressionsCount: 1,
              viewsCount: 1,
              sharesCount: 0,
              videoWatchSec: 0,
              createdAt: lp.createdAt,
              updatedAt: lp.createdAt,
            };
            migratedPosts.push(item);
            void persistSocialPostToSupabase(item);
          }

          const existingMsgIds = new Set(current.chatMessages.map((m) => m.id));
          const existingConvIds = new Set(current.conversations.map((c) => c.id));
          const migratedConvs: MessagingConversation[] = [];
          const migratedMsgs: DirectOrGroupMessage[] = [];

          for (const lm of legacy.messages) {
            if (
              LEGACY_FAKE_MSG_IDS.has(lm.id) ||
              LEGACY_FAKE_USER_IDS.has(lm.senderId) ||
              lm.senderId === 'guest' ||
              existingMsgIds.has(lm.id)
            ) {
              continue;
            }
            const ch = legacy.channels.find((c) => c.id === lm.channelId);
            const convId = lm.channelId;
            if (!existingConvIds.has(convId)) {
              existingConvIds.add(convId);
              migratedConvs.push({
                id: convId,
                kind: ch?.isDirect ? 'direct' : 'group',
                title: ch?.name.replace(/^💬\s*/, '') || 'Cuộc trò chuyện',
                subtitle: ch?.subtitle || 'Hội thoại',
                avatarUrl: null,
                accentColor: ch?.accentColor || '#6366F1',
                peerUserId: ch?.peerUserId,
                memberIds: [lm.senderId, ...(ch?.peerUserId ? [ch.peerUserId] : [])],
                adminIds: [lm.senderId],
                requestState: 'accepted',
                isPinned: false,
                isMuted: false,
                pinnedMessageId: null,
                announcement: '',
                typingUserNames: [],
                lastMessagePreview: lm.text,
                lastMessageAt: lm.createdAt,
                unreadByUserIds: {},
              });
            }
            migratedMsgs.push({
              id: lm.id,
              conversationId: convId,
              senderId: lm.senderId,
              senderName: lm.senderName,
              senderAvatar: lm.senderAvatar,
              text: lm.text,
              mediaAttachments: lm.imageUri
                ? [{ id: `img-${lm.id}`, kind: 'image', uri: lm.imageUri, thumbnailUri: lm.imageUri }]
                : [],
              quizCard: lm.quizCard ?? null,
              replyTo: lm.replyTo ?? null,
              reactions: lm.reactions ?? {},
              isEdited: false,
              isRecalled: false,
              deliveryStatus: 'delivered',
              readByIds: [lm.senderId],
              createdAt: lm.createdAt,
            });
          }

          if (migratedPosts.length > 0 || migratedMsgs.length > 0 || migratedConvs.length > 0) {
            set((s) => ({
              posts: [...migratedPosts, ...s.posts].sort(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
              ),
              conversations: [...migratedConvs, ...s.conversations],
              chatMessages: [...s.chatMessages, ...migratedMsgs].sort(
                (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
              ),
            }));
          }
        },

        ensureUserProfile: (input) => {
          if (!input.id || input.id === 'guest') {
            return {
              id: 'guest',
              displayName: 'Khách',
              avatarUrl: null,
              coverUrl: null,
              bio: '',
              university: '',
              major: '',
              interests: [],
              locationArea: '',
              websiteUrl: '',
              badges: [],
              reputationScore: 0,
              role: 'user',
              accountStatus: 'active',
              privacy: {
                isPrivateAccount: false,
                allowMessagesFrom: 'everyone',
                allowMentionsFrom: 'everyone',
                showOnlineStatus: false,
                showJoinedCommunities: false,
                showPersonalInfo: 'only_me',
                discoverableInRecommendations: false,
              },
              followersCount: 0,
              followingCount: 0,
              friendsCount: 0,
              profileViewsCount: 0,
            };
          }
          const existing = get().profilesById[input.id];
          const cleanName =
            input.displayName.trim() || existing?.displayName || 'Thành viên Papyrus';
          const next: SocialUserProfile = existing
            ? {
                ...existing,
                displayName: cleanName,
                avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
                role: input.role ?? existing.role,
                major: input.major !== undefined ? input.major : existing.major,
                bio: input.bio !== undefined ? input.bio : existing.bio,
                privacy:
                  input.isPrivateAccount !== undefined
                    ? { ...existing.privacy, isPrivateAccount: input.isPrivateAccount }
                    : existing.privacy,
              }
            : {
                id: input.id,
                displayName: cleanName,
                avatarUrl: input.avatarUrl ?? null,
                coverUrl: null,
                bio: input.bio ?? '',
                university: '',
                major: input.major ?? '',
                interests: ['CNTT', 'ÔnThi'],
                locationArea: '',
                websiteUrl: '',
                badges: [],
                reputationScore: 100,
                role: input.role ?? 'user',
                accountStatus: 'active',
                privacy: {
                  isPrivateAccount: Boolean(input.isPrivateAccount),
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
          if (!userId || userId === 'guest') return;
          set((state) => {
            const current = state.profilesById[userId];
            const updatedName =
              patch.displayName?.trim() || current?.displayName || 'Thành viên Papyrus';
            const updatedAvatar =
              patch.avatarUrl !== undefined ? patch.avatarUrl : current?.avatarUrl ?? null;

            const updatedProfile: SocialUserProfile = {
              ...(current ??
                get().ensureUserProfile({
                  id: userId,
                  displayName: updatedName,
                  avatarUrl: updatedAvatar,
                })),
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
          get().migrateLegacyUserContent();

          const snap = await fetchSocialHydrationSnapshot();
          if (!snap) {
            const remote = await fetchRealProfilesDirectory(50);
            if (remote.length > 0) {
              set((state) => {
                const merged = { ...state.profilesById };
                for (const prof of remote) {
                  const local = merged[prof.id];
                  merged[prof.id] = local ? { ...local, ...prof } : prof;
                }
                return { profilesById: merged };
              });
            }
            return;
          }

          if (snap.stories.length > 0) {
            useCommunityStore.getState().mergeCloudStories(snap.stories);
          }

          set((state) => {
            const mergedProfiles = { ...state.profilesById };
            for (const prof of snap.profiles) {
              const local = mergedProfiles[prof.id];
              mergedProfiles[prof.id] = local
                ? {
                    ...local,
                    displayName: prof.displayName || local.displayName,
                    avatarUrl: prof.avatarUrl || local.avatarUrl,
                    coverUrl: prof.coverUrl || local.coverUrl,
                    bio: prof.bio || local.bio,
                    university: prof.university || local.university,
                    major: prof.major || local.major,
                    followersCount: 0,
                    followingCount: 0,
                    friendsCount: 0,
                  }
                : prof;
            }

            // Merge posts by id (remote wins metadata while keeping any unsynced local posts)
            const postMap = new Map<string, SocialPostItem>();
            for (const lp of state.posts) {
              if (!LEGACY_FAKE_POST_IDS.has(lp.id) && !LEGACY_FAKE_USER_IDS.has(lp.authorId)) {
                postMap.set(lp.id, lp);
              }
            }
            for (const rp of snap.posts) {
              const prev = postMap.get(rp.id);
              postMap.set(
                rp.id,
                prev
                  ? {
                      ...prev,
                      ...rp,
                      // Preserve local session blob media if any
                      mediaItems: rp.mediaItems.length > 0 ? rp.mediaItems : prev.mediaItems,
                    }
                  : rp
              );
            }

            // Merge communities by slug/id
            const commBySlug = new Map<string, SocialCommunityGroup>();
            for (const sc of state.communities) {
              commBySlug.set(sc.slug || sc.id, sc);
            }
            for (const rc of snap.communities) {
              const prev = commBySlug.get(rc.slug || rc.id);
              commBySlug.set(
                rc.slug || rc.id,
                prev
                  ? {
                      ...prev,
                      ...rc,
                      avatarEmoji: prev.avatarEmoji || rc.avatarEmoji,
                      accentColor: prev.accentColor || rc.accentColor,
                      events: rc.events.length > 0 ? rc.events : prev.events,
                    }
                  : rc
              );
            }

            // Merge conversations & messages
            const convMap = new Map<string, MessagingConversation>();
            for (const lc of state.conversations) {
              if (!LEGACY_FAKE_CONV_IDS.has(lc.id)) convMap.set(lc.id, lc);
            }
            for (const rc of snap.conversations) {
              const prev = convMap.get(rc.id);
              convMap.set(rc.id, prev ? { ...prev, ...rc } : rc);
            }

            const msgMap = new Map<string, DirectOrGroupMessage>();
            for (const lm of state.chatMessages) {
              if (!LEGACY_FAKE_MSG_IDS.has(lm.id)) msgMap.set(lm.id, lm);
            }
            for (const rm of snap.chatMessages) {
              msgMap.set(rm.id, rm);
            }

            // Merge follows & friendRequests if remote returned rows
            const followKey = (f: FollowEdge) => `${f.followerId}->${f.followingId}`;
            const followMap = new Map<string, FollowEdge>();
            for (const lf of state.follows) followMap.set(followKey(lf), lf);
            for (const rf of snap.follows) followMap.set(followKey(rf), rf);

            const freqMap = new Map<string, FriendRequestRecord>();
            for (const lfr of state.friendRequests) {
              if (!LEGACY_FAKE_FREQ_IDS.has(lfr.id)) {
                freqMap.set(`${lfr.senderId}->${lfr.receiverId}`, lfr);
              }
            }
            for (const rfr of snap.friendRequests) {
              freqMap.set(`${rfr.senderId}->${rfr.receiverId}`, rfr);
            }

            return {
              profilesById: mergedProfiles,
              posts: Array.from(postMap.values()).sort(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
              ),
              communities: Array.from(commBySlug.values()),
              conversations: Array.from(convMap.values()),
              chatMessages: Array.from(msgMap.values()).sort(
                (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
              ),
              follows: Array.from(followMap.values()),
              friendRequests: Array.from(freqMap.values()),
            };
          });
        },

        incrementProfileView: (targetUserId, viewerId) => {
          if (!targetUserId || !viewerId || viewerId === 'guest' || targetUserId === viewerId) {
            return;
          }
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
          if (!followerId || followerId === 'guest' || !targetId || followerId === targetId) {
            return 'unfollowed';
          }
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
            void persistFollowEdgeToSupabase(targetId, 'delete');
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
          void persistFollowEdgeToSupabase(targetId, 'upsert', nextStatus, false);
          return nextStatus === 'pending' ? 'requested' : 'followed';
        },

        respondFollowRequest: (ownerId, followerId, accept) => {
          if (!ownerId || ownerId === 'guest') return;
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
          if (!userId || userId === 'guest') return;
          let nextClose = false;
          set((s) => ({
            follows: s.follows.map((f) => {
              if (f.followerId === userId && f.followingId === targetId) {
                nextClose = !f.isCloseFriend;
                return { ...f, isCloseFriend: nextClose };
              }
              return f;
            }),
          }));
          void persistFollowEdgeToSupabase(targetId, 'upsert', 'accepted', nextClose);
        },

        sendFriendRequest: (senderId, receiverId) => {
          if (!senderId || senderId === 'guest' || !receiverId || senderId === receiverId) return;
          let createdReq: FriendRequestRecord | null = null;
          set((s) => {
            const exists = s.friendRequests.find(
              (r) =>
                ((r.senderId === senderId && r.receiverId === receiverId) ||
                  (r.senderId === receiverId && r.receiverId === senderId)) &&
                (r.status === 'pending' || r.status === 'accepted')
            );
            if (exists) return s;
            createdReq = {
              id: generateClientUuid(),
              senderId,
              receiverId,
              status: 'pending',
              createdAt: new Date().toISOString(),
            };
            return {
              friendRequests: [createdReq, ...s.friendRequests],
            };
          });
          if (createdReq) {
            void persistFriendRequestToSupabase(createdReq, 'upsert');
          }
        },

        respondFriendRequest: (requestId, accept) => {
          let updatedReq: FriendRequestRecord | null = null;
          set((s) => ({
            friendRequests: s.friendRequests.map((r) => {
              if (r.id !== requestId) return r;
              updatedReq = { ...r, status: accept ? 'accepted' : 'rejected' };
              return updatedReq;
            }),
          }));
          if (updatedReq) {
            void persistFriendRequestToSupabase(updatedReq, 'upsert');
          }
        },

        cancelOrUnfriend: (userId, otherUserId) => {
          if (!userId || userId === 'guest') return;
          const existing = get().friendRequests.find(
            (r) =>
              (r.senderId === userId && r.receiverId === otherUserId) ||
              (r.senderId === otherUserId && r.receiverId === userId)
          );
          set((s) => ({
            friendRequests: s.friendRequests.filter(
              (r) =>
                !(
                  (r.senderId === userId && r.receiverId === otherUserId) ||
                  (r.senderId === otherUserId && r.receiverId === userId)
                )
            ),
          }));
          if (existing) {
            void persistFriendRequestToSupabase(existing, 'delete');
          }
        },

        toggleUserRelation: (actorId, targetId, type) => {
          if (!actorId || actorId === 'guest' || !targetId || actorId === targetId) return false;
          const exists = get().relations.some(
            (r) => r.actorId === actorId && r.targetId === targetId && r.type === type
          );
          set((s) => {
            const nextRelations = exists
              ? s.relations.filter(
                  (r) => !(r.actorId === actorId && r.targetId === targetId && r.type === type)
                )
              : [...s.relations, { actorId, targetId, type }];
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
                return {
                  ...p,
                  lifecycleStatus: 'published' as const,
                  updatedAt: new Date().toISOString(),
                };
              }
              if (
                p.lifecycleStatus === 'published' &&
                p.expiresAt &&
                Date.parse(p.expiresAt) <= now
              ) {
                changed = true;
                return {
                  ...p,
                  lifecycleStatus: 'expired' as const,
                  updatedAt: new Date().toISOString(),
                };
              }
              return p;
            });
            return changed ? { posts: nextPosts } : s;
          });
        },

        createSocialPost: (input) => {
          if (!input.authorId || input.authorId === 'guest') return null;
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
            id: generateClientUuid(),
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
            spoilerWarning: input.spoilerWarning || 'Nội dung ẩn · Chạm để xem',
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
          if (!editorId || editorId === 'guest') return false;
          const target = get().posts.find((p) => p.id === postId);
          if (!target) return false;
          const realOwner = target.internalAuthorId || target.authorId;
          if (realOwner !== editorId) return false;

          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              updatedPost = {
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
              };
              return updatedPost;
            }),
          }));
          if (updatedPost) void persistSocialPostToSupabase(updatedPost);
          return true;
        },

        deleteOrArchivePost: (postId, actorId, mode) => {
          if (!actorId || actorId === 'guest') return;
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              const realOwner = p.internalAuthorId || p.authorId;
              if (p.id !== postId) return p;
              if (realOwner !== actorId && actorId !== 'admin') return p;
              const nextStatus =
                mode === 'delete'
                  ? ('removed' as const)
                  : mode === 'archive'
                  ? ('archived' as const)
                  : ('published' as const);
              updatedPost = { ...p, lifecycleStatus: nextStatus };
              return updatedPost;
            }),
          }));
          if (updatedPost) void persistSocialPostToSupabase(updatedPost);
        },

        togglePinPost: (postId, scope) => {
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              updatedPost =
                scope === 'profile'
                  ? { ...p, isPinnedProfile: !p.isPinnedProfile }
                  : { ...p, isPinnedCommunity: !p.isPinnedCommunity };
              return updatedPost;
            }),
          }));
          if (updatedPost) void persistSocialPostToSupabase(updatedPost);
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
          if (!userId || userId === 'guest') return;
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
          if (!author.id || author.id === 'guest') return;
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
          if (!userId || userId === 'guest') return;
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              const alreadySame = (p.reactions[reaction] ?? []).includes(userId);
              const cleanedReactions: Partial<Record<EmojiReactionType, string[]>> = {};
              for (const [k, list] of Object.entries(p.reactions) as Array<
                [EmojiReactionType, string[]]
              >) {
                const filtered = (list ?? []).filter((id) => id !== userId);
                if (filtered.length > 0) cleanedReactions[k] = filtered;
              }
              if (!alreadySame) {
                cleanedReactions[reaction] = [...(cleanedReactions[reaction] ?? []), userId];
              }
              updatedPost = { ...p, reactions: cleanedReactions };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
        },

        addThreadedReply: (input) => {
          if (!input.authorId || input.authorId === 'guest') return null;
          const clean = input.content.trim();
          if (!clean && !input.mediaItem) return null;
          const reply: ThreadedReplyItem = {
            id: generateClientUuid(),
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
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== input.postId) return p;
              updatedPost = { ...p, comments: [...p.comments, reply] };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
          return reply;
        },

        editOrDeleteComment: (postId, commentId, actorId, newContent) => {
          if (!actorId || actorId === 'guest') return;
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              if (newContent === null || newContent === undefined) {
                updatedPost = {
                  ...p,
                  comments: p.comments.filter(
                    (c) =>
                      !(
                        (c.id === commentId || c.parentCommentId === commentId) &&
                        (c.authorId === actorId || actorId === 'admin')
                      )
                  ),
                };
                return updatedPost;
              }
              updatedPost = {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId && c.authorId === actorId
                    ? {
                        ...c,
                        content: newContent.trim(),
                        isEdited: true,
                        updatedAt: new Date().toISOString(),
                      }
                    : c
                ),
              };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
        },

        toggleCommentReaction: (postId, commentId, reaction, userId) => {
          if (!userId || userId === 'guest') return;
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              updatedPost = {
                ...p,
                comments: p.comments.map((c) => {
                  if (c.id !== commentId) return c;
                  const prev = c.reactions[reaction] ?? [];
                  const next = prev.includes(userId)
                    ? prev.filter((id) => id !== userId)
                    : [...prev, userId];
                  return { ...c, reactions: { ...c.reactions, [reaction]: next } };
                }),
              };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
        },

        togglePinComment: (postId, commentId) => {
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              updatedPost = {
                ...p,
                comments: p.comments.map((c) =>
                  c.id === commentId ? { ...c, isPinned: !c.isPinned } : c
                ),
              };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
        },

        togglePureRepost: (postId, userId) => {
          if (!userId || userId === 'guest') return false;
          let activeNow = false;
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              const has = p.repostedByIds.includes(userId);
              activeNow = !has;
              updatedPost = {
                ...p,
                repostedByIds: has
                  ? p.repostedByIds.filter((id) => id !== userId)
                  : [...p.repostedByIds, userId],
              };
              return updatedPost;
            }),
          }));
          if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
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
                targetPost?.topics.some((t) =>
                  t.toLowerCase().includes(col.topicRule!.toLowerCase())
                )
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
            coverEmoji: coverEmoji || '📂',
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
          if (!userId || userId === 'guest') return;
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
            let updatedPost: SocialPostItem | null = null;
            set((s) => ({
              posts: s.posts.map((p) => {
                if (p.id !== targetId || !p.poll) return p;
                updatedPost = { ...p, poll: applyVoteToPoll(p.poll) };
                return updatedPost;
              }),
            }));
            if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
          } else {
            set((s) => ({
              chatMessages: s.chatMessages.map((m) =>
                m.id === targetId && m.poll ? { ...m, poll: applyVoteToPoll(m.poll) } : m
              ),
            }));
          }
        },

        addUnifiedPollOption: (targetKind, targetId, text, user) => {
          if (!user.id || user.id === 'guest') return;
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
            let updatedPost: SocialPostItem | null = null;
            set((s) => ({
              posts: s.posts.map((p) => {
                if (p.id !== targetId || !p.poll) return p;
                updatedPost = { ...p, poll: appendOpt(p.poll) };
                return updatedPost;
              }),
            }));
            if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
          } else {
            set((s) => ({
              chatMessages: s.chatMessages.map((m) =>
                m.id === targetId && m.poll ? { ...m, poll: appendOpt(m.poll) } : m
              ),
            }));
          }
        },

        toggleCloseUnifiedPoll: (targetKind, targetId, actorId) => {
          if (!actorId || actorId === 'guest') return;
          const toggleClose = (poll: UnifiedPoll): UnifiedPoll =>
            poll.createdBy === actorId || actorId === 'admin'
              ? { ...poll, isClosed: !poll.isClosed }
              : poll;
          if (targetKind === 'post') {
            let updatedPost: SocialPostItem | null = null;
            set((s) => ({
              posts: s.posts.map((p) => {
                if (p.id !== targetId || !p.poll) return p;
                updatedPost = { ...p, poll: toggleClose(p.poll) };
                return updatedPost;
              }),
            }));
            if (updatedPost) void syncPostEngagementToSupabase(updatedPost);
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
                    ...slice.recentSearchQueries.filter(
                      (q) => q.toLowerCase() !== clean.toLowerCase()
                    ),
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
          if (!input.ownerId || input.ownerId === 'guest') return null;
          const slug =
            input.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || `comm-${Date.now()}`;
          const comm: SocialCommunityGroup = {
            id: generateClientUuid(),
            slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
            name: input.name.trim(),
            description: input.description.trim(),
            avatarEmoji: input.avatarEmoji || '🏛️',
            accentColor: input.accentColor || '#6366F1',
            coverUrl: null,
            visibility: input.visibility,
            topics: input.topics,
            rules:
              input.rules.length > 0
                ? input.rules
                : ['1. Tôn trọng thành viên & chia sẻ tri thức văn minh.'],
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
                reputationPoints: 100,
                helpfulCount: 0,
                badges: [],
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
                action: 'Tạo nhóm mới',
                createdAt: new Date().toISOString(),
              },
            ],
            createdAt: new Date().toISOString(),
          };
          set((s) => ({ communities: [comm, ...s.communities] }));
          void persistCommunityToSupabase(comm);
          return comm;
        },

        joinOrLeaveCommunity: (communityId, user) => {
          if (!user.id || user.id === 'guest') return 'guest';
          let outcome = 'joined';
          let nextRole: CommunityRole = 'member';
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
              nextRole = c.requireMemberApproval ? 'pending' : 'member';
              outcome = nextRole === 'pending' ? 'pending' : 'joined';
              return {
                ...c,
                members: [
                  ...c.members,
                  {
                    userId: user.id,
                    displayName: user.name,
                    avatarUrl: user.avatar,
                    role: nextRole,
                    reputationPoints: 10,
                    helpfulCount: 0,
                    badges: [],
                    joinedAt: new Date().toISOString(),
                  },
                ],
              };
            }),
          }));
          if (outcome === 'left') {
            void persistCommunityMembershipToSupabase(communityId, false);
          } else if (outcome === 'joined' || outcome === 'pending') {
            void persistCommunityMembershipToSupabase(communityId, true, nextRole);
          }
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
                        action: `Cập nhật vai trò thành "${role}"`,
                        createdAt: new Date().toISOString(),
                      },
                      ...c.activityLogs,
                    ].slice(0, 50),
                  }
            ),
          }));
        },

        approvePendingPost: (postId, approve) => {
          let updatedPost: SocialPostItem | null = null;
          set((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p;
              updatedPost = { ...p, lifecycleStatus: approve ? 'published' : 'removed' };
              return updatedPost;
            }),
          }));
          if (updatedPost) void persistSocialPostToSupabase(updatedPost);
        },

        createCommunityEvent: (input) => {
          if (!input.creatorId || input.creatorId === 'guest') return null;
          const ev: CommunityEventItem = {
            id: `evt-${Date.now()}`,
            communityId: input.communityId,
            creatorId: input.creatorId,
            creatorName: input.creatorName,
            title: input.title.trim(),
            description: input.description.trim(),
            locationLabel: input.locationLabel.trim() || 'Online · Papyrus',
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
          if (!userId || userId === 'guest') return;
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
          if (!me.id || me.id === 'guest' || !peer.id || peer.id === 'guest') return null;
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
            id: generateClientUuid(),
            kind: 'direct',
            title: peer.name.trim() || 'Thành viên Papyrus',
            subtitle: isFriend ? 'Bạn bè trên Papyrus' : 'Trò chuyện trực tiếp',
            avatarUrl: peer.avatar ?? null,
            accentColor: '#0EA5E9',
            peerUserId: peer.id,
            memberIds: [me.id, peer.id],
            adminIds: [me.id, peer.id],
            requestState: 'accepted',
            isPinned: false,
            isMuted: false,
            pinnedMessageId: null,
            announcement: '',
            typingUserNames: [],
            lastMessagePreview: 'Bắt đầu cuộc trò chuyện',
            lastMessageAt: new Date().toISOString(),
            unreadByUserIds: {},
          };
          set((s) => ({ conversations: [conv, ...s.conversations] }));
          void persistConversationToSupabase(conv);
          return conv;
        },

        createGroupConversation: (input) => {
          if (!input.creatorId || input.creatorId === 'guest') return null;
          const memberList = Array.from(new Set([input.creatorId, ...input.memberIds]));
          const conv: MessagingConversation = {
            id: generateClientUuid(),
            kind: 'group',
            title: input.title.trim() || 'Nhóm học tập mới',
            subtitle: `${memberList.length} thành viên · ${input.topic || 'Thảo luận nhóm'}`,
            avatarUrl: null,
            accentColor: '#6366F1',
            memberIds: memberList,
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
          void persistConversationToSupabase(conv);
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
          if (!userId || userId === 'guest') return;
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
          if (!input.senderId || input.senderId === 'guest') return null;
          const nowIso = new Date().toISOString();
          const msg: DirectOrGroupMessage = {
            id: generateClientUuid(),
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
            ? `Khảo sát: ${input.poll.question}`
            : input.mediaAttachments?.length
            ? `${input.senderName} đã gửi tệp đính kèm`
            : msg.text;

          let activeConv: MessagingConversation | undefined;
          set((s) => {
            const nextConvs = s.conversations.map((c) => {
              if (c.id !== input.conversationId) return c;
              activeConv = {
                ...c,
                lastMessagePreview: preview.slice(0, 90),
                lastMessageAt: nowIso,
              };
              return activeConv;
            });
            return {
              chatMessages: [...s.chatMessages, msg].slice(-500),
              conversations: nextConvs,
            };
          });

          void persistChatMessageToSupabase(activeConv, msg);

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
          if (!senderId || senderId === 'guest') return;
          let updatedMsg: DirectOrGroupMessage | null = null;
          set((s) => ({
            chatMessages: s.chatMessages.map((m) => {
              if (m.id !== messageId || m.senderId !== senderId) return m;
              if (mode === 'recall') {
                updatedMsg = {
                  ...m,
                  isRecalled: true,
                  text: 'Tin nhắn đã được thu hồi',
                  mediaAttachments: [],
                  sharedPost: null,
                };
                return updatedMsg;
              }
              updatedMsg = {
                ...m,
                text: (newText ?? m.text).trim(),
                isEdited: true,
                updatedAt: new Date().toISOString(),
              };
              return updatedMsg;
            }),
          }));
          if (updatedMsg) {
            const conv = get().conversations.find((c) => c.id === updatedMsg!.conversationId);
            void persistChatMessageToSupabase(conv, updatedMsg);
          }
        },

        toggleChatMessageReaction: (messageId, emoji, userId) => {
          if (!userId || userId === 'guest') return;
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
          if (!sender.id || sender.id === 'guest') return;
          const firstMedia = post.mediaItems[0];
          const sharedRef: SharedPostReference = {
            postId: post.id,
            authorId: post.isAnonymous ? 'anonymous-member' : post.authorId,
            authorName: post.isAnonymous ? 'Thành viên Ẩn danh' : post.authorName,
            authorAvatar: post.isAnonymous ? null : post.authorAvatar,
            previewText: post.isSpoiler
              ? `[Nội dung ẩn] ${post.spoilerWarning || 'Chạm để mở bài viết gốc'}`
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
              threadParts: [commentText?.trim() || 'Chia sẻ bài viết vào nhóm:'],
              repostOfId: post.id,
              isQuote: true,
              audience: 'community',
            });
          }
        },

        submitModerationReport: (input) => {
          if (!input.reporterId || input.reporterId === 'guest') return null;
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
              ? 'Phát hiện từ khóa nhạy cảm — ưu tiên kiểm duyệt.'
              : 'Đang chờ Quản trị viên xác minh.',
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
          if (!userId || userId === 'guest') return;
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
                id: generateClientUuid(),
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
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SocialStoreState> | undefined) ?? {};

        // Strip all legacy fake profiles, posts, conversations, messages & fake follower counts (e.g. 184/185)
        const cleanProfiles: Record<string, SocialUserProfile> = {};
        for (const [id, prof] of Object.entries(persisted.profilesById ?? {})) {
          if (!LEGACY_FAKE_USER_IDS.has(id) && id !== 'guest' && prof) {
            cleanProfiles[id] = {
              ...prof,
              followersCount: 0,
              followingCount: 0,
              friendsCount: 0,
            };
          }
        }

        const cleanFollows = (persisted.follows ?? []).filter(
          (f) =>
            !LEGACY_FAKE_USER_IDS.has(f.followerId) &&
            !LEGACY_FAKE_USER_IDS.has(f.followingId) &&
            f.followerId !== 'guest'
        );

        const cleanFriendRequests = (persisted.friendRequests ?? []).filter(
          (r) =>
            !LEGACY_FAKE_FREQ_IDS.has(r.id) &&
            !LEGACY_FAKE_USER_IDS.has(r.senderId) &&
            !LEGACY_FAKE_USER_IDS.has(r.receiverId) &&
            r.senderId !== 'guest'
        );

        const cleanPosts = (persisted.posts ?? []).filter(
          (p) =>
            !LEGACY_FAKE_POST_IDS.has(p.id) &&
            !LEGACY_FAKE_USER_IDS.has(p.internalAuthorId || p.authorId) &&
            (p.internalAuthorId || p.authorId) !== 'guest'
        );

        const cleanConversations = (persisted.conversations ?? []).filter(
          (c) => !LEGACY_FAKE_CONV_IDS.has(c.id)
        );

        const cleanMessages = (persisted.chatMessages ?? []).filter(
          (m) =>
            !LEGACY_FAKE_MSG_IDS.has(m.id) &&
            !LEGACY_FAKE_USER_IDS.has(m.senderId) &&
            m.senderId !== 'guest'
        );

        const cleanCommunities = (persisted.communities ?? STARTER_COMMUNITIES).map((c) => ({
          ...c,
          ownerId: LEGACY_FAKE_USER_IDS.has(c.ownerId) ? '' : c.ownerId,
          members: (c.members ?? []).filter(
            (m) => !LEGACY_FAKE_USER_IDS.has(m.userId) && m.userId !== 'guest'
          ),
          pinnedPostIds: (c.pinnedPostIds ?? []).filter((pid) => !LEGACY_FAKE_POST_IDS.has(pid)),
          events: (c.events ?? []).filter((ev) => !LEGACY_FAKE_USER_IDS.has(ev.creatorId)),
          announcements: c.id === 'comm-software-ai' || c.id === 'comm-stem-olympiad' ? [] : c.announcements,
        }));

        const cleanDocs = (persisted.adminDocuments ?? []).filter(
          (d) => !LEGACY_FAKE_DOC_IDS.has(d.id)
        );

        return {
          ...currentState,
          ...persisted,
          profilesById: cleanProfiles,
          follows: cleanFollows,
          friendRequests: cleanFriendRequests,
          posts: cleanPosts,
          communities: cleanCommunities.length > 0 ? cleanCommunities : STARTER_COMMUNITIES,
          conversations: cleanConversations,
          chatMessages: cleanMessages,
          adminDocuments: cleanDocs,
        };
      },
    }
  )
);
