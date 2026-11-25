// Pure Domain Models for Papyrus Production Social Media, Meta Threads + Facebook Groups,
// Unified Zalo Polls, Dedicated Messaging Center, PapyAI Social, Analytics, Moderation & Admin Gifts.

export type EmojiReactionType =
  | 'like'
  | 'love'
  | 'haha'
  | 'wow'
  | 'sad'
  | 'angry'
  | 'fire'
  | 'bulb'
  | 'clap';

export const EMOJI_REACTION_CATALOG: Array<{
  type: EmojiReactionType;
  emoji: string;
  label: string;
  color: string;
}> = [
  { type: 'like', emoji: '👍', label: 'Thích', color: '#3B82F6' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích', color: '#EF4444' },
  { type: 'haha', emoji: '😆', label: 'Haha', color: '#F59E0B' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: '#FBBF24' },
  { type: 'sad', emoji: '😢', label: 'Buồn', color: '#38BDF8' },
  { type: 'angry', emoji: '😠', label: 'Phẫn nộ', color: '#F97316' },
  { type: 'fire', emoji: '🔥', label: 'Đỉnh', color: '#EC4899' },
  { type: 'bulb', emoji: '💡', label: 'Hữu ích', color: '#10B981' },
  { type: 'clap', emoji: '👏', label: 'Cảm ơn', color: '#8B5CF6' },
];

export type PostAudience =
  | 'public'
  | 'followers'
  | 'friends'
  | 'close_friends'
  | 'only_me'
  | 'community'
  | 'selected';

export type ReplyPermission =
  | 'everyone'
  | 'followers'
  | 'friends'
  | 'mentioned'
  | 'selected'
  | 'nobody';

export type PostLifecycleStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'expired'
  | 'removed'
  | 'pending_approval';

export type PostKind =
  | 'standard'
  | 'thread'
  | 'ghost'
  | 'anonymous'
  | 'debate'
  | 'article'
  | 'quiz_interactive';

export type UserRelationType = 'block' | 'mute' | 'restrict';

export interface SocialPrivacySettings {
  isPrivateAccount: boolean;
  allowMessagesFrom: 'everyone' | 'friends_and_followers' | 'friends' | 'nobody';
  allowMentionsFrom: 'everyone' | 'followers' | 'friends' | 'nobody';
  showOnlineStatus: boolean;
  showJoinedCommunities: boolean;
  showPersonalInfo: 'public' | 'friends' | 'only_me';
  discoverableInRecommendations: boolean;
}

export interface SocialUserProfile {
  id: string; // Immutable UUID / User ID (primary key)
  displayName: string; // Main Profile Name used everywhere on UI (never scholar codes!)
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  university: string;
  major: string;
  interests: string[];
  locationArea: string;
  websiteUrl: string;
  badges: string[];
  reputationScore: number;
  role: 'user' | 'moderator' | 'admin' | 'superadmin';
  accountStatus: 'active' | 'restricted' | 'suspended' | 'banned';
  privacy: SocialPrivacySettings;
  followersCount: number;
  followingCount: number;
  friendsCount: number;
  profileViewsCount: number;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface FollowEdge {
  followerId: string;
  followingId: string;
  status: 'pending' | 'accepted';
  isCloseFriend: boolean;
  createdAt: string;
}

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
}

export interface FriendRecommendationItem {
  profile: SocialUserProfile;
  score: number;
  reasonLabel: string;
  sharedTopics: string[];
  mutualFriendsCount: number;
  mutualFollowersCount: number;
}

export interface SocialMediaItem {
  id: string;
  kind: 'image' | 'video' | 'gif' | 'sticker' | 'audio' | 'file';
  uri: string;
  thumbnailUri?: string | null; // Mandatory video cover / thumbnail before play!
  coverTimestampSec?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  width?: number;
  height?: number;
  durationSec?: number;
  altText?: string;
  mimeType?: string;
  fileName?: string;
  attribution?: string;
}

export interface UnifiedPollOption {
  id: string;
  text: string;
  voterIds: string[];
  addedByUserId?: string;
  addedByName?: string;
}

export interface UnifiedPoll {
  id: string;
  scopeType: 'post' | 'community' | 'chat' | 'live';
  question: string;
  options: UnifiedPollOption[];
  allowMultiple: boolean;
  isAnonymous: boolean;
  allowAddOptions: boolean;
  allowChangeVote: boolean;
  isClosed: boolean;
  expiresAt?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface PostVersionRecord {
  id: string;
  editedAt: string;
  editorId: string;
  previousParts: string[];
  previousLongForm?: string;
}

export interface ThreadedReplyItem {
  id: string;
  postId: string;
  parentCommentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  mediaItem?: SocialMediaItem | null;
  mentionedUserIds: string[];
  reactions: Partial<Record<EmojiReactionType, string[]>>;
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DebateArgumentItem {
  id: string;
  side: 'A' | 'B';
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  upvoterIds: string[];
  createdAt: string;
}

export interface DebateConfig {
  sideALabel: string;
  sideBLabel: string;
  sideAVoterIds: string[];
  sideBVoterIds: string[];
  arguments: DebateArgumentItem[];
  aiNeutralSummary?: string;
}

export interface AiPostSummary {
  summaryText: string;
  keyTakeaways: string[];
  generatedAt: string;
  contentRevisionHash: string;
}

export interface LinkPreviewMetadata {
  url: string;
  title: string;
  description: string;
  siteName: string;
  imageUrl?: string | null;
}

export interface SocialPostItem {
  id: string;
  authorId: string; // Masked to 'anonymous' on UI projection when isAnonymous === true
  internalAuthorId?: string; // Retained strictly for author/moderator accountability
  authorName: string;
  authorAvatar: string | null;
  authorBio?: string;
  authorBadges?: string[];
  communityId?: string | null;
  communityName?: string | null;

  postKind: PostKind;
  threadParts: string[];
  longFormBody?: string;
  mediaItems: SocialMediaItem[];
  poll?: UnifiedPoll | null;
  attachedQuiz?: {
    setId: string;
    title: string;
    questionCount: number;
    subject: string;
  } | null;
  codeSnippet?: string;
  linkPreview?: LinkPreviewMetadata | null;
  debate?: DebateConfig | null;

  repostOfId?: string | null;
  isQuote?: boolean;

  isSpoiler: boolean;
  spoilerWarning?: string;
  isAnonymous: boolean;

  audience: PostAudience;
  selectedAudienceIds: string[];
  replyPermission: ReplyPermission;
  selectedReplyUserIds?: string[];

  topics: string[];
  hashtags: string[];
  mentionedUserIds: string[];
  locationLabel?: string | null;

  reactions: Partial<Record<EmojiReactionType, string[]>>;
  repostedByIds: string[];
  quoteCount: number;
  comments: ThreadedReplyItem[];

  isPinnedProfile: boolean;
  isPinnedCommunity: boolean;

  lifecycleStatus: PostLifecycleStatus;
  scheduledFor?: string | null;
  expiresAt?: string | null; // Server-evaluated Ghost Post expiration!

  editHistory: PostVersionRecord[];
  aiSummary?: AiPostSummary | null;

  impressionsCount: number;
  viewsCount: number;
  sharesCount: number;
  videoWatchSec: number;

  createdAt: string;
  updatedAt: string;
}

export interface BookmarkCollection {
  id: string;
  ownerId: string;
  name: string;
  coverEmoji: string;
  topicRule?: string;
  isSmart: boolean;
  postIds: string[];
  createdAt: string;
}

export type FeedModeType =
  | 'for_you'
  | 'home'
  | 'following'
  | 'friends'
  | 'trending'
  | 'knowledge'
  | 'debate'
  | 'nearby'
  | 'mood'
  | 'custom';

export interface CustomFeedConfig {
  id: string;
  ownerId: string;
  name: string;
  topics: string[];
  accountIds: string[];
  communityIds: string[];
  isPinned: boolean;
  isPublic: boolean;
  order: number;
}

export interface YourAlgoConfig {
  boostedTopics: string[];
  hiddenTopics: string[];
  mutedKeywords: string[];
  prioritizedAccountIds: string[];
  showLessAccountIds: string[];
  notInterestedPostIds: string[];
  knowledgeMode: boolean;
  activeMood: 'all' | 'focus' | 'chill' | 'inspire' | 'debate';
  preferenceExpiresAt?: string | null;
}

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member' | 'pending' | 'banned';

export interface CommunityMemberEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: CommunityRole;
  reputationPoints: number;
  helpfulCount: number;
  badges: string[];
  joinedAt: string;
}

export interface CommunityEventItem {
  id: string;
  communityId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  locationLabel: string;
  startsAt: string;
  endsAt?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  rsvpUserIds: string[];
  reminderUserIds: string[];
}

export interface SocialCommunityGroup {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatarEmoji: string;
  accentColor: string;
  coverUrl: string | null;
  visibility: 'public' | 'private' | 'hidden';
  topics: string[];
  rules: string[];
  requirePostApproval: boolean;
  requireMemberApproval: boolean;
  allowAnonymousPosts: boolean;
  isSuspended: boolean;
  ownerId: string;
  members: CommunityMemberEntry[];
  pinnedPostIds: string[];
  announcements: string[];
  events: CommunityEventItem[];
  activityLogs: Array<{ id: string; actorName: string; action: string; createdAt: string }>;
  createdAt: string;
}

export interface SharedPostReference {
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  previewText: string;
  thumbnailUri?: string | null;
  mediaKind?: 'image' | 'video' | 'text' | 'poll' | 'quiz';
  postKind: PostKind;
  createdAt: string;
}

export interface DirectOrGroupMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  mediaAttachments: SocialMediaItem[];
  sharedPost?: SharedPostReference | null;
  poll?: UnifiedPoll | null;
  quizCard?: { setId: string; title: string; questionCount: number } | null;
  replyTo?: { id: string; senderName: string; preview: string } | null;
  forwardedFromName?: string;
  reactions: Record<string, string[]>;
  isEdited: boolean;
  isRecalled: boolean;
  deliveryStatus: 'sent' | 'delivered' | 'read';
  readByIds: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface MessagingConversation {
  id: string;
  kind: 'direct' | 'group' | 'live_room';
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  accentColor: string;
  peerUserId?: string;
  communityId?: string;
  memberIds: string[];
  adminIds: string[];
  requestState: 'accepted' | 'pending' | 'archived';
  isPinned: boolean;
  isMuted: boolean;
  pinnedMessageId: string | null;
  announcement: string;
  typingUserNames: string[];
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadByUserIds: Record<string, number>;
}

export type ModerationWorkflowStatus =
  | 'reported'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'action_applied'
  | 'appealed'
  | 'resolved';

export type ModerationActionKind =
  | 'warning'
  | 'hide_content'
  | 'remove_content'
  | 'restrict_interaction'
  | 'temp_suspension'
  | 'community_ban'
  | 'account_suspension'
  | 'account_ban'
  | 'restore_content';

export interface SocialModerationCase {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'post' | 'comment' | 'user' | 'story' | 'message' | 'community';
  targetId: string;
  targetPreview: string;
  targetOwnerId: string;
  reason: string;
  details: string;
  aiFlagSummary?: string;
  aiSpamScore?: number;
  workflowStatus: ModerationWorkflowStatus;
  appliedAction?: ModerationActionKind;
  appealReason?: string;
  appealDecision?: 'accepted' | 'rejected';
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLogItem {
  id: string;
  actorName: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface AdminManagedDocument {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  category: string;
  tags: string[];
  fileFormat: 'pdf' | 'doc' | 'docx' | 'markdown' | 'txt';
  fileName?: string;
  fileSizeBytes?: number;
  storagePath?: string | null;
  richContent: string;
  status: 'draft' | 'scheduled' | 'published' | 'unpublished';
  scheduledPublishAt?: string | null;
  allowDownload: boolean;
  expiresAt?: string | null;
  downloadCount: number;
  recipientUserIds: string[]; // 'all' in array means gifted to all eligible users
  recipientCommunityIds: string[];
  giftHistory: Array<{
    id: string;
    targetLabel: string;
    giftedAt: string;
    expiresAt?: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}
