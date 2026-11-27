import { Platform } from 'react-native';
import { fetch } from 'expo/fetch';
import { supabase } from '@/core/network/supabase';
import type { ScholarStory } from '@/features/community/domain/models';
import type {
  AdminManagedDocument,
  AiPostSummary,
  CommunityEventItem,
  CommunityMemberEntry,
  CommunityRole,
  DirectOrGroupMessage,
  EmojiReactionType,
  FollowEdge,
  FriendRequestRecord,
  MessagingConversation,
  SocialCommunityGroup,
  SocialModerationCase,
  SocialPostItem,
  SocialUserProfile,
  ThreadedReplyItem,
  UnifiedPoll,
  YourAlgoConfig,
} from '../domain/models';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value?: string | null): boolean {
  return Boolean(value && UUID_REGEX.test(value));
}

export function generateClientUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    return isValidUuid(uid) ? uid! : null;
  } catch {
    return null;
  }
}

function papybotApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/papybot`;
  }
  return 'https://papyrus-lyart-five.vercel.app/api/papybot';
}

export interface CloudSocialSnapshot {
  profiles: SocialUserProfile[];
  posts: SocialPostItem[];
  stories: ScholarStory[];
  communities: SocialCommunityGroup[];
  conversations: MessagingConversation[];
  chatMessages: DirectOrGroupMessage[];
  follows: FollowEdge[];
  friendRequests: FriendRequestRecord[];
}

function mapProfileRow(row: Record<string, unknown>): SocialUserProfile {
  return {
    id: String(row.id),
    displayName: String(row.display_name || '').trim() || 'Thành viên Papyrus',
    avatarUrl: (row.avatar_url as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    bio: String(row.bio || ''),
    university: String(row.university || ''),
    major: String(row.major || ''),
    interests: Array.isArray(row.interests) ? (row.interests as string[]) : [],
    locationArea: String(row.location_area || ''),
    websiteUrl: String(row.website_url || ''),
    badges: [],
    reputationScore: Number(
      row.reputation_score ?? Math.round(Number(row.total_score ?? 0) / 25)
    ),
    role:
      row.role === 'superadmin' || row.role === 'admin' || row.role === 'moderator'
        ? row.role
        : 'user',
    accountStatus: 'active',
    privacy: {
      isPrivateAccount: Boolean(row.is_private),
      allowMessagesFrom: 'everyone',
      allowMentionsFrom: 'everyone',
      showOnlineStatus: row.show_online_status !== false,
      showJoinedCommunities: true,
      showPersonalInfo: 'public',
      discoverableInRecommendations: true,
    },
    followersCount: 0,
    followingCount: 0,
    friendsCount: 0,
    profileViewsCount: Number(row.profile_views_count ?? 0),
  };
}

/**
 * Syncs updated Profile Name, Avatar, Bio & Privacy to Supabase `public.profiles`
 * so a single unified User Identity powers Social, Communities, Messaging & Notifications.
 */
export async function syncUnifiedProfileToSupabase(
  profile: Partial<SocialUserProfile> & { id: string }
): Promise<boolean> {
  if (!supabase || !isValidUuid(profile.id)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid || uid !== profile.id) return false;
    const patch: Record<string, unknown> = {};
    if (profile.displayName !== undefined) patch.display_name = profile.displayName.trim();
    if (profile.avatarUrl !== undefined) patch.avatar_url = profile.avatarUrl;
    if (profile.coverUrl !== undefined) patch.cover_url = profile.coverUrl;
    if (profile.bio !== undefined) patch.bio = profile.bio;
    if (profile.university !== undefined) patch.university = profile.university;
    if (profile.major !== undefined) patch.major = profile.major;
    if (profile.interests !== undefined) patch.interests = profile.interests;
    if (profile.locationArea !== undefined) patch.location_area = profile.locationArea;
    if (profile.privacy?.isPrivateAccount !== undefined) {
      patch.is_private = profile.privacy.isPrivateAccount;
    }

    if (Object.keys(patch).length === 0) return true;
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches real registered profiles from Supabase so users can search, follow, friend & message
 * each other strictly by their main Profile Name.
 */
export async function fetchRealProfilesDirectory(limit = 60): Promise<SocialUserProfile[]> {
  if (!supabase) return [];
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => mapProfileRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

/**
 * Hydrates full real-data Social Snapshot from Supabase (Posts, Stories, Communities,
 * Conversations, Messages, Follows, Friend Requests & Profiles).
 */
export async function fetchSocialHydrationSnapshot(): Promise<CloudSocialSnapshot | null> {
  if (!supabase) return null;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return null;

    const [
      profilesRes,
      postsRes,
      storiesRes,
      commsRes,
      commMembersRes,
      commEventsRes,
      convsRes,
      convMembersRes,
      msgsRes,
      followsRes,
      freqsRes,
    ] = await Promise.allSettled([
      supabase.from('profiles').select('*').order('total_score', { ascending: false }).limit(80),
      supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('social_stories').select('*').order('created_at', { ascending: false }).limit(80),
      supabase.from('social_communities').select('*').order('created_at', { ascending: true }).limit(40),
      supabase.from('social_community_members').select('*').limit(300),
      supabase.from('social_community_events').select('*').order('starts_at', { ascending: true }).limit(60),
      supabase.from('chat_conversations').select('*').order('updated_at', { ascending: false }).limit(50),
      supabase.from('chat_conversation_members').select('*').limit(200),
      supabase.from('chat_messages').select('*').order('created_at', { ascending: true }).limit(250),
      supabase.from('social_follows').select('*').limit(300),
      supabase.from('social_friend_requests').select('*').limit(200),
    ]);

    const profiles: SocialUserProfile[] =
      profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data)
        ? profilesRes.value.data.map((r) => mapProfileRow(r as Record<string, unknown>))
        : [];

    const profileMap = new Map<string, SocialUserProfile>();
    for (const p of profiles) profileMap.set(p.id, p);

    const posts: SocialPostItem[] =
      postsRes.status === 'fulfilled' && Array.isArray(postsRes.value.data)
        ? postsRes.value.data.map((r: Record<string, unknown>) => {
            const authorId = String(r.author_id || '');
            const prof = profileMap.get(authorId);
            const rawParts = Array.isArray(r.thread_parts)
              ? (r.thread_parts as string[]).map(String).filter(Boolean)
              : [];
            const contentFallback = String(r.content || '').trim();
            const isAnon = Boolean(r.is_anonymous);
            return {
              id: String(r.id),
              authorId: isAnon ? 'anonymous-member' : authorId,
              internalAuthorId: authorId,
              authorName: isAnon
                ? 'Thành viên ẩn danh'
                : prof?.displayName ||
                  String(r.author_name_snapshot || '').trim() ||
                  'Thành viên Papyrus',
              authorAvatar: isAnon
                ? null
                : prof?.avatarUrl ?? ((r.author_avatar_snapshot as string | null) || null),
              authorBio: isAnon ? undefined : prof?.bio,
              communityId: (r.community_id as string | null) ?? null,
              communityName: (r.community_name_snapshot as string | null) ?? null,
              postKind: (r.post_kind as SocialPostItem['postKind']) || 'thread',
              threadParts: rawParts.length > 0 ? rawParts : contentFallback ? [contentFallback] : [''],
              longFormBody: (r.long_form_body as string | null) ?? undefined,
              mediaItems: Array.isArray(r.media_items)
                ? (r.media_items as SocialPostItem['mediaItems'])
                : [],
              poll: (r.poll_snapshot as UnifiedPoll | null) ?? null,
              attachedQuiz: (r.attached_quiz as SocialPostItem['attachedQuiz']) ?? null,
              codeSnippet: (r.code_snippet as string | null) ?? undefined,
              linkPreview: (r.link_preview as SocialPostItem['linkPreview']) ?? null,
              debate: (r.debate_config as SocialPostItem['debate']) ?? undefined,
              aiSummary: (r.ai_summary as SocialPostItem['aiSummary']) ?? null,
              repostOfId: (r.repost_of_id as string | null) ?? null,
              isQuote: Boolean(r.is_quote),
              isSpoiler: Boolean(r.is_spoiler),
              spoilerWarning: String(r.spoiler_warning || ''),
              isAnonymous: isAnon,
              audience: (r.audience as SocialPostItem['audience']) || 'public',
              selectedAudienceIds: Array.isArray(r.selected_audience_ids)
                ? (r.selected_audience_ids as string[])
                : [],
              replyPermission:
                (r.reply_permission as SocialPostItem['replyPermission']) || 'everyone',
              topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
              hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]) : [],
              mentionedUserIds: Array.isArray(r.mentioned_user_ids)
                ? (r.mentioned_user_ids as string[])
                : [],
              locationLabel: (r.location_label as string | null) ?? null,
              reactions:
                r.reactions_map && typeof r.reactions_map === 'object'
                  ? (r.reactions_map as Partial<Record<EmojiReactionType, string[]>>)
                  : {},
              repostedByIds: Array.isArray(r.reposted_by_ids)
                ? (r.reposted_by_ids as string[])
                : [],
              quoteCount: 0,
              comments: Array.isArray(r.comments_snapshot)
                ? (r.comments_snapshot as ThreadedReplyItem[])
                : [],
              isPinnedProfile: Boolean(r.is_pinned_profile),
              isPinnedCommunity: Boolean(r.is_pinned_community),
              lifecycleStatus:
                (r.lifecycle_status as SocialPostItem['lifecycleStatus']) || 'published',
              scheduledFor: (r.scheduled_for as string | null) ?? null,
              expiresAt: (r.expires_at as string | null) ?? null,
              editHistory: [],
              impressionsCount: Number(r.impressions_count ?? 1),
              viewsCount: Number(r.views_count ?? 1),
              sharesCount: 0,
              videoWatchSec: 0,
              createdAt: String(r.created_at || new Date().toISOString()),
              updatedAt: String(r.updated_at || r.created_at || new Date().toISOString()),
            };
          })
        : [];

    const stories: ScholarStory[] =
      storiesRes.status === 'fulfilled' && Array.isArray(storiesRes.value.data)
        ? storiesRes.value.data.map((r: Record<string, unknown>) => {
            const authorId = String(r.author_id || '');
            const prof = profileMap.get(authorId);
            const gradRaw = Array.isArray(r.gradient) ? (r.gradient as string[]) : [];
            const pinned = Boolean(r.pinned_on_profile);
            return {
              id: String(r.id),
              authorId,
              authorName:
                prof?.displayName ||
                String(r.author_name || '').trim() ||
                'Thành viên Papyrus',
              authorAvatar: prof?.avatarUrl ?? ((r.author_avatar as string | null) || null),
              authorLevel: 1,
              text: String(r.text_content || ''),
              subtext: String(r.subtext || ''),
              gradient: [gradRaw[0] || '#312E81', gradRaw[1] || '#7C3AED'],
              mediaType:
                r.media_type === 'video' || r.media_type === 'image' ? r.media_type : 'text',
              imageUri: (r.image_url as string | null) ?? null,
              videoUri: (r.video_url as string | null) ?? null,
              thumbnailUri: (r.thumbnail_url as string | null) ?? null,
              durationSec:
                typeof r.duration_sec === 'number' ? Number(r.duration_sec) : undefined,
              viewedByIds: Array.isArray(r.viewed_by_ids) ? (r.viewed_by_ids as string[]) : [],
              reactions:
                r.reactions && typeof r.reactions === 'object'
                  ? (r.reactions as Record<string, string[]>)
                  : {},
              isHighlight: pinned,
              pinnedOnProfile: pinned,
              expiresAt: (r.expires_at as string | null) ?? undefined,
              createdAt: String(r.created_at || new Date().toISOString()),
            };
          })
        : [];

    const commMembersRaw =
      commMembersRes.status === 'fulfilled' && Array.isArray(commMembersRes.value.data)
        ? (commMembersRes.value.data as Array<Record<string, unknown>>)
        : [];
    const commEventsRaw =
      commEventsRes.status === 'fulfilled' && Array.isArray(commEventsRes.value.data)
        ? (commEventsRes.value.data as Array<Record<string, unknown>>)
        : [];

    const communities: SocialCommunityGroup[] =
      commsRes.status === 'fulfilled' && Array.isArray(commsRes.value.data)
        ? commsRes.value.data.map((r: Record<string, unknown>) => {
            const cid = String(r.id);
            const members: CommunityMemberEntry[] = commMembersRaw
              .filter((m) => String(m.community_id) === cid)
              .map((m) => {
                const mid = String(m.user_id);
                const mp = profileMap.get(mid);
                return {
                  userId: mid,
                  displayName: mp?.displayName || 'Thành viên Papyrus',
                  avatarUrl: mp?.avatarUrl ?? null,
                  role: (m.role as CommunityRole) || 'member',
                  reputationPoints: Number(m.reputation_points ?? 10),
                  helpfulCount: 0,
                  badges: Array.isArray(m.badges) ? (m.badges as string[]) : [],
                  joinedAt: String(m.joined_at || new Date().toISOString()),
                };
              });

            const events: CommunityEventItem[] = commEventsRaw
              .filter((e) => String(e.community_id) === cid)
              .map((e) => {
                const creatorId = String(e.creator_id || '');
                return {
                  id: String(e.id),
                  communityId: cid,
                  creatorId,
                  creatorName: profileMap.get(creatorId)?.displayName || 'Thành viên',
                  title: String(e.title || ''),
                  description: String(e.description || ''),
                  locationLabel: String(e.location_label || 'Trực tuyến'),
                  startsAt: String(e.starts_at || new Date().toISOString()),
                  status: (e.status as CommunityEventItem['status']) || 'scheduled',
                  rsvpUserIds: Array.isArray(e.rsvp_user_ids)
                    ? (e.rsvp_user_ids as string[])
                    : [],
                  reminderUserIds: [],
                };
              });

            return {
              id: cid,
              slug: String(r.slug || cid),
              name: String(r.name || 'Nhóm học tập'),
              description: String(r.description || ''),
              avatarEmoji: '💻',
              accentColor: '#1C3F94',
              coverUrl: (r.cover_url as string | null) ?? null,
              visibility: (r.visibility as SocialCommunityGroup['visibility']) || 'public',
              topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
              rules: Array.isArray(r.rules) ? (r.rules as string[]) : [],
              requirePostApproval: Boolean(r.require_post_approval),
              requireMemberApproval: Boolean(r.require_member_approval),
              allowAnonymousPosts: r.allow_anonymous_posts !== false,
              isSuspended: Boolean(r.is_suspended),
              ownerId: String(r.owner_id || ''),
              members,
              pinnedPostIds: [],
              announcements: [],
              events,
              activityLogs: [],
              createdAt: String(r.created_at || new Date().toISOString()),
            };
          })
        : [];

    const convMembersRaw =
      convMembersRes.status === 'fulfilled' && Array.isArray(convMembersRes.value.data)
        ? (convMembersRes.value.data as Array<Record<string, unknown>>)
        : [];

    const chatMessages: DirectOrGroupMessage[] =
      msgsRes.status === 'fulfilled' && Array.isArray(msgsRes.value.data)
        ? msgsRes.value.data.map((m: Record<string, unknown>) => {
            const senderId = String(m.sender_id || '');
            const sp = profileMap.get(senderId);
            return {
              id: String(m.id),
              conversationId: String(m.conversation_id),
              senderId,
              senderName:
                sp?.displayName ||
                String(m.sender_name_snapshot || '').trim() ||
                'Thành viên Papyrus',
              senderAvatar: sp?.avatarUrl ?? ((m.sender_avatar_snapshot as string | null) || null),
              text: String(m.content || ''),
              mediaAttachments: Array.isArray(m.attachments)
                ? (m.attachments as DirectOrGroupMessage['mediaAttachments'])
                : [],
              sharedPost: (m.shared_post_snapshot as DirectOrGroupMessage['sharedPost']) ?? null,
              poll: (m.poll_snapshot as UnifiedPoll | null) ?? null,
              quizCard: (m.quiz_card as DirectOrGroupMessage['quizCard']) ?? null,
              replyTo: (m.reply_snapshot as DirectOrGroupMessage['replyTo']) ?? null,
              reactions:
                m.reactions_map && typeof m.reactions_map === 'object'
                  ? (m.reactions_map as Record<string, string[]>)
                  : {},
              isEdited: Boolean(m.is_edited),
              isRecalled: Boolean(m.is_recalled),
              deliveryStatus:
                (m.delivery_status as DirectOrGroupMessage['deliveryStatus']) || 'delivered',
              readByIds: [senderId],
              createdAt: String(m.created_at || new Date().toISOString()),
              updatedAt: m.updated_at ? String(m.updated_at) : undefined,
            };
          })
        : [];

    const conversations: MessagingConversation[] =
      convsRes.status === 'fulfilled' && Array.isArray(convsRes.value.data)
        ? convsRes.value.data.map((c: Record<string, unknown>) => {
            const cid = String(c.id);
            const roster = convMembersRaw.filter((m) => String(m.conversation_id) === cid);
            const memberIds = roster.map((m) => String(m.user_id));
            const myMember = roster.find((m) => String(m.user_id) === uid);
            const peerId =
              c.kind === 'direct' ? memberIds.find((id) => id !== uid) : undefined;
            const peerProf = peerId ? profileMap.get(peerId) : undefined;
            const convMsgs = chatMessages.filter((msg) => msg.conversationId === cid);
            const latestMsg = convMsgs[convMsgs.length - 1];
            return {
              id: cid,
              kind: (c.kind as MessagingConversation['kind']) || 'direct',
              title:
                (c.kind === 'direct' && peerProf?.displayName) ||
                String(c.title || '').trim() ||
                'Cuộc trò chuyện',
              subtitle:
                c.kind === 'direct'
                  ? 'Trò chuyện trực tiếp'
                  : `${Math.max(1, memberIds.length)} thành viên`,
              avatarUrl:
                (c.kind === 'direct' ? peerProf?.avatarUrl : (c.avatar_url as string | null)) ??
                null,
              accentColor: '#1C3F94',
              peerUserId: peerId,
              memberIds: memberIds.length > 0 ? memberIds : [uid],
              adminIds: c.created_by ? [String(c.created_by)] : [uid],
              requestState:
                (myMember?.request_state as MessagingConversation['requestState']) || 'accepted',
              isPinned: Boolean(myMember?.is_pinned),
              isMuted: Boolean(myMember?.is_muted),
              pinnedMessageId: (c.pinned_message_id as string | null) ?? null,
              announcement: String(c.announcement || ''),
              typingUserNames: [],
              lastMessagePreview: latestMsg?.text || 'Bắt đầu cuộc trò chuyện',
              lastMessageAt:
                latestMsg?.createdAt || String(c.updated_at || c.created_at || new Date().toISOString()),
              unreadByUserIds: {},
            };
          })
        : [];

    const follows: FollowEdge[] =
      followsRes.status === 'fulfilled' && Array.isArray(followsRes.value.data)
        ? followsRes.value.data.map((f: Record<string, unknown>) => ({
            followerId: String(f.follower_id),
            followingId: String(f.following_id),
            status: f.status === 'pending' ? 'pending' : 'accepted',
            isCloseFriend: Boolean(f.is_close_friend),
            createdAt: String(f.created_at || new Date().toISOString()),
          }))
        : [];

    const friendRequests: FriendRequestRecord[] =
      freqsRes.status === 'fulfilled' && Array.isArray(freqsRes.value.data)
        ? freqsRes.value.data.map((fr: Record<string, unknown>) => ({
            id: String(fr.id),
            senderId: String(fr.sender_id),
            receiverId: String(fr.receiver_id),
            status: (fr.status as FriendRequestRecord['status']) || 'pending',
            createdAt: String(fr.created_at || new Date().toISOString()),
          }))
        : [];

    return {
      profiles,
      posts,
      stories,
      communities,
      conversations,
      chatMessages,
      follows,
      friendRequests,
    };
  } catch {
    return null;
  }
}

/**
 * Persists a Social Post / Thread / Scheduled Post / Ghost Post to Supabase `public.social_posts`.
 */
export async function persistSocialPostToSupabase(post: SocialPostItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;

    const cleanMedia = post.mediaItems.filter((m) => !m.uri.startsWith('blob:'));
    const fullRow: Record<string, unknown> = {
      id: isValidUuid(post.id) ? post.id : undefined,
      author_id: uid,
      community_id: isValidUuid(post.communityId) ? post.communityId : null,
      repost_of_id: isValidUuid(post.repostOfId) ? post.repostOfId : null,
      is_quote: Boolean(post.isQuote),
      post_kind: post.postKind,
      content: post.threadParts.join('\n\n'),
      thread_parts: post.threadParts,
      long_form_body: post.longFormBody ?? null,
      media_items: cleanMedia,
      is_spoiler: post.isSpoiler,
      spoiler_warning: post.spoilerWarning ?? '',
      is_anonymous: post.isAnonymous,
      audience: post.audience,
      selected_audience_ids: post.selectedAudienceIds.filter(isValidUuid),
      reply_permission: post.replyPermission,
      topics: post.topics,
      hashtags: post.hashtags,
      mentioned_user_ids: post.mentionedUserIds.filter(isValidUuid),
      location_label: post.locationLabel ?? null,
      debate_config: post.debate ?? null,
      ai_summary: post.aiSummary ?? null,
      is_pinned_profile: post.isPinnedProfile,
      is_pinned_community: post.isPinnedCommunity,
      lifecycle_status: post.lifecycleStatus,
      scheduled_for: post.scheduledFor ?? null,
      expires_at: post.expiresAt ?? null,
      author_name_snapshot: post.authorName,
      author_avatar_snapshot: post.authorAvatar,
      community_name_snapshot: post.communityName ?? null,
      poll_snapshot: post.poll ?? null,
      attached_quiz: post.attachedQuiz ?? null,
      code_snippet: post.codeSnippet ?? null,
      link_preview: post.linkPreview ?? null,
      reactions_map: post.reactions ?? {},
      reposted_by_ids: post.repostedByIds ?? [],
      comments_snapshot: post.comments ?? [],
    };

    const { error } = await supabase.from('social_posts').upsert(fullRow);
    if (!error) return true;

    // Graceful fallback if optional snapshot columns are not yet applied remotely
    const minimalRow = {
      id: isValidUuid(post.id) ? post.id : undefined,
      author_id: uid,
      community_id: isValidUuid(post.communityId) ? post.communityId : null,
      post_kind: post.postKind,
      content: post.threadParts.join('\n\n'),
      thread_parts: post.threadParts,
      long_form_body: post.longFormBody ?? null,
      media_items: cleanMedia,
      is_spoiler: post.isSpoiler,
      spoiler_warning: post.spoilerWarning ?? '',
      is_anonymous: post.isAnonymous,
      audience: post.audience,
      selected_audience_ids: post.selectedAudienceIds.filter(isValidUuid),
      reply_permission: post.replyPermission,
      topics: post.topics,
      hashtags: post.hashtags,
      location_label: post.locationLabel ?? null,
      lifecycle_status: post.lifecycleStatus,
      scheduled_for: post.scheduledFor ?? null,
      expires_at: post.expiresAt ?? null,
    };
    const retry = await supabase.from('social_posts').upsert(minimalRow);
    return !retry.error;
  } catch {
    return false;
  }
}

export async function syncPostEngagementToSupabase(post: SocialPostItem): Promise<boolean> {
  if (!supabase || !isValidUuid(post.id)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const { error } = await supabase.rpc('sync_social_post_engagement', {
      p_post_id: post.id,
      p_reactions_map: post.reactions ?? {},
      p_comments_snapshot: post.comments ?? [],
      p_poll_snapshot: post.poll ?? null,
      p_reposted_by_ids: post.repostedByIds ?? [],
    });
    return !error;
  } catch {
    return false;
  }
}

export async function persistStoryToSupabase(story: ScholarStory): Promise<boolean> {
  if (!supabase) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const safeImage =
      story.imageUri && !story.imageUri.startsWith('blob:') ? story.imageUri : null;
    const safeVideo =
      story.videoUri && !story.videoUri.startsWith('blob:') ? story.videoUri : null;
    const safeThumb =
      story.thumbnailUri && !story.thumbnailUri.startsWith('blob:')
        ? story.thumbnailUri
        : safeImage;

    const { error } = await supabase.from('social_stories').upsert({
      id: isValidUuid(story.id) ? story.id : undefined,
      author_id: uid,
      author_name: story.authorName,
      author_avatar: story.authorAvatar,
      text_content: story.text,
      subtext: story.subtext ?? '',
      gradient: story.gradient,
      media_type: story.mediaType ?? 'text',
      image_url: safeImage,
      video_url: safeVideo,
      thumbnail_url: safeThumb,
      duration_sec: story.durationSec ?? null,
      pinned_on_profile: Boolean(story.pinnedOnProfile ?? story.isHighlight),
      viewed_by_ids: story.viewedByIds,
      reactions: story.reactions ?? {},
      expires_at:
        story.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: story.createdAt,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function updateStoryPinInSupabase(
  storyId: string,
  pinnedOnProfile: boolean
): Promise<boolean> {
  if (!supabase || !isValidUuid(storyId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const { error } = await supabase
      .from('social_stories')
      .update({ pinned_on_profile: pinnedOnProfile })
      .eq('id', storyId)
      .eq('author_id', uid);
    return !error;
  } catch {
    return false;
  }
}

export async function syncStoryEngagementToSupabase(
  storyId: string,
  viewedByIds: string[],
  reactions: Record<string, string[]>
): Promise<boolean> {
  if (!supabase || !isValidUuid(storyId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const rpcRes = await supabase.rpc('sync_social_story_engagement', {
      p_story_id: storyId,
      p_viewed_by_ids: viewedByIds,
      p_reactions: reactions,
    });
    if (!rpcRes.error) return true;
    const { error } = await supabase
      .from('social_stories')
      .update({
        viewed_by_ids: viewedByIds,
        reactions,
      })
      .eq('id', storyId);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteStoryFromSupabase(storyId: string): Promise<boolean> {
  if (!supabase || !isValidUuid(storyId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const { error } = await supabase
      .from('social_stories')
      .delete()
      .eq('id', storyId)
      .eq('author_id', uid);
    return !error;
  } catch {
    return false;
  }
}

export async function persistFollowEdgeToSupabase(
  targetId: string,
  action: 'upsert' | 'delete',
  status: 'pending' | 'accepted' = 'accepted',
  isCloseFriend = false
): Promise<boolean> {
  if (!supabase || !isValidUuid(targetId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid || uid === targetId) return false;
    if (action === 'delete') {
      const { error } = await supabase
        .from('social_follows')
        .delete()
        .eq('follower_id', uid)
        .eq('following_id', targetId);
      return !error;
    }
    const { error } = await supabase.from('social_follows').upsert({
      follower_id: uid,
      following_id: targetId,
      status,
      is_close_friend: isCloseFriend,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function persistFriendRequestToSupabase(
  req: FriendRequestRecord,
  action: 'upsert' | 'delete'
): Promise<boolean> {
  if (!supabase || !isValidUuid(req.senderId) || !isValidUuid(req.receiverId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    if (action === 'delete') {
      const { error } = await supabase
        .from('social_friend_requests')
        .delete()
        .eq('sender_id', req.senderId)
        .eq('receiver_id', req.receiverId);
      return !error;
    }
    const { error } = await supabase.from('social_friend_requests').upsert(
      {
        id: isValidUuid(req.id) ? req.id : undefined,
        sender_id: req.senderId,
        receiver_id: req.receiverId,
        status: req.status,
      },
      { onConflict: 'sender_id,receiver_id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function persistCommunityToSupabase(comm: SocialCommunityGroup): Promise<boolean> {
  if (!supabase) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const cid = isValidUuid(comm.id) ? comm.id : generateClientUuid();
    const { error } = await supabase.from('social_communities').upsert({
      id: cid,
      slug: comm.slug,
      name: comm.name,
      description: comm.description,
      visibility: comm.visibility,
      topics: comm.topics,
      rules: comm.rules,
      require_post_approval: comm.requirePostApproval,
      require_member_approval: comm.requireMemberApproval,
      allow_anonymous_posts: comm.allowAnonymousPosts,
      owner_id: uid,
      member_count: Math.max(1, comm.members.length),
    });
    if (!error) {
      await supabase.from('social_community_members').upsert({
        community_id: cid,
        user_id: uid,
        role: 'owner',
        reputation_points: 100,
      });
    }
    return !error;
  } catch {
    return false;
  }
}

export async function persistCommunityMembershipToSupabase(
  communityId: string,
  joined: boolean,
  role: CommunityRole = 'member'
): Promise<boolean> {
  if (!supabase || !isValidUuid(communityId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    if (!joined) {
      const { error } = await supabase
        .from('social_community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', uid);
      return !error;
    }
    const { error } = await supabase.from('social_community_members').upsert({
      community_id: communityId,
      user_id: uid,
      role,
      reputation_points: 10,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function persistConversationToSupabase(
  conv: MessagingConversation
): Promise<boolean> {
  if (!supabase || !isValidUuid(conv.id)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const { error } = await supabase.from('chat_conversations').upsert({
      id: conv.id,
      kind: conv.kind,
      title: conv.title,
      avatar_url: conv.avatarUrl,
      created_by: uid,
      announcement: conv.announcement || '',
    });
    if (!error) {
      const validMembers = Array.from(new Set([uid, ...conv.memberIds.filter(isValidUuid)]));
      for (const mid of validMembers) {
        await supabase.from('chat_conversation_members').upsert({
          conversation_id: conv.id,
          user_id: mid,
          role: mid === uid ? 'owner' : 'member',
          request_state: 'accepted',
        });
      }
    }
    return !error;
  } catch {
    return false;
  }
}

export async function persistChatMessageToSupabase(
  conv: MessagingConversation | undefined,
  msg: DirectOrGroupMessage
): Promise<boolean> {
  if (!supabase || !isValidUuid(msg.conversationId)) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    if (conv) {
      await persistConversationToSupabase(conv);
    }
    const cleanAttachments = msg.mediaAttachments.filter((a) => !a.uri.startsWith('blob:'));
    const fullRow: Record<string, unknown> = {
      id: isValidUuid(msg.id) ? msg.id : undefined,
      conversation_id: msg.conversationId,
      sender_id: uid,
      content: msg.text,
      shared_post_id: isValidUuid(msg.sharedPost?.postId) ? msg.sharedPost!.postId : null,
      shared_post_snapshot: msg.sharedPost ?? null,
      poll_snapshot: msg.poll ?? null,
      quiz_card: msg.quizCard ?? null,
      reply_snapshot: msg.replyTo ?? null,
      sender_name_snapshot: msg.senderName,
      sender_avatar_snapshot: msg.senderAvatar,
      reactions_map: msg.reactions ?? {},
      attachments: cleanAttachments,
      is_edited: msg.isEdited,
      is_recalled: msg.isRecalled,
      delivery_status: msg.deliveryStatus,
    };
    const { error } = await supabase.from('chat_messages').upsert(fullRow);
    if (!error) return true;

    const minimalRow = {
      id: isValidUuid(msg.id) ? msg.id : undefined,
      conversation_id: msg.conversationId,
      sender_id: uid,
      content: msg.text,
      attachments: cleanAttachments,
      is_edited: msg.isEdited,
      is_recalled: msg.isRecalled,
      delivery_status: msg.deliveryStatus,
    };
    const retry = await supabase.from('chat_messages').upsert(minimalRow);
    return !retry.error;
  } catch {
    return false;
  }
}

let serverLifecycleRpcAvailable = process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LIFECYCLE_RPC === '1';

export async function triggerServerPostLifecycleSweep(): Promise<void> {
  if (!supabase || !serverLifecycleRpcAvailable) return;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return;
    const { error } = await supabase.rpc('process_social_post_schedules_and_expiry');
    if (error) {
      serverLifecycleRpcAvailable = false;
    }
  } catch {
    serverLifecycleRpcAvailable = false;
  }
}

export async function persistModerationCaseToSupabase(
  item: SocialModerationCase
): Promise<boolean> {
  if (!supabase) return false;
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return false;
    const { error } = await supabase.from('social_moderation_cases').insert({
      reporter_id: uid,
      target_type: item.targetType,
      target_id: item.targetId,
      reason: item.reason,
      details: item.details,
      workflow_status: item.workflowStatus,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Uploads an Admin Gift Document to Supabase Storage (`gift-documents` bucket) with file validation
 * and persists metadata in `public.admin_documents`.
 */
export async function uploadAdminDocumentToSupabase(doc: AdminManagedDocument): Promise<{
  syncedToCloud: boolean;
  storagePath: string | null;
}> {
  if (!supabase) return { syncedToCloud: false, storagePath: null };
  try {
    const uid = await getAuthenticatedUserId();
    if (!uid) return { syncedToCloud: false, storagePath: null };

    let storagePath: string | null = doc.storagePath ?? null;
    if (doc.richContent && !storagePath) {
      const safeSlug =
        doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'doc';
      const candidatePath = `${uid}/${Date.now()}-${safeSlug}.md`;
      const blob = new Blob([doc.richContent], { type: 'text/markdown;charset=utf-8' });
      const uploadRes = await supabase.storage
        .from('gift-documents')
        .upload(candidatePath, blob, { upsert: false });
      if (!uploadRes.error) {
        storagePath = candidatePath;
      }
    }

    const { error } = await supabase.from('admin_documents').insert({
      title: doc.title,
      description: doc.description,
      cover_url: doc.coverUrl,
      category: doc.category,
      tags: doc.tags,
      file_format: doc.fileFormat,
      storage_path: storagePath,
      rich_content: doc.richContent,
      status: doc.status,
      allow_download: doc.allowDownload,
      expires_at: doc.expiresAt ?? null,
      created_by: uid,
    });

    return { syncedToCloud: !error, storagePath };
  } catch {
    return { syncedToCloud: false, storagePath: null };
  }
}

/**
 * PapyAI Summary Generator for Long-Form Posts, Threads & Discussions
 */
export async function generatePapyAiPostSummary(post: SocialPostItem): Promise<AiPostSummary> {
  const fullContent = [
    ...post.threadParts,
    post.longFormBody ?? '',
    ...post.comments.slice(0, 6).map((c) => `Bình luận (${c.authorName}): ${c.content}`),
  ]
    .filter(Boolean)
    .join('\n\n');

  const revisionHash = `${post.updatedAt}-${post.comments.length}`;

  try {
    const res = await fetch(papybotApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'summarize_post',
        query: 'Hãy tóm tắt 3 điểm cốt lõi nhất của bài viết và thảo luận này.',
        document: fullContent.slice(0, 12000),
        context: '/community',
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { answer?: string; keyTakeaways?: string[] };
      if (json.answer) {
        return {
          summaryText: json.answer,
          keyTakeaways: Array.isArray(json.keyTakeaways) ? json.keyTakeaways : [],
          generatedAt: new Date().toISOString(),
          contentRevisionHash: revisionHash,
        };
      }
    }
  } catch {
    // Offline fallback below
  }

  const cleanSentences = fullContent
    .split(/(?<=[.!?…\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16)
    .slice(0, 3);

  return {
    summaryText:
      cleanSentences.length > 0
        ? `Tóm tắt trọng tâm:\n${cleanSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : `Tóm tắt trọng tâm: ${fullContent.slice(0, 240)}`,
    keyTakeaways: cleanSentences,
    generatedAt: new Date().toISOString(),
    contentRevisionHash: revisionHash,
  };
}

/**
 * PapyAI Natural-Language Feed Assistant
 */
export async function askPapyAiFeedAssistant(instruction: string): Promise<{
  replyText: string;
  patch: Partial<YourAlgoConfig>;
}> {
  try {
    const res = await fetch(papybotApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'feed_assistant',
        query: instruction,
        context: '/community',
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        answer?: string;
        preferences?: {
          boostTopics?: string[];
          muteTopics?: string[];
          knowledgeOnly?: boolean;
          mood?: YourAlgoConfig['activeMood'] | null;
        };
      };
      return {
        replyText: json.answer || 'Đã cập nhật tùy chỉnh bảng tin theo yêu cầu của bạn.',
        patch: {
          ...(json.preferences?.boostTopics?.length
            ? { boostedTopics: json.preferences.boostTopics }
            : {}),
          ...(json.preferences?.muteTopics?.length
            ? { hiddenTopics: json.preferences.muteTopics }
            : {}),
          ...(json.preferences?.knowledgeOnly ? { knowledgeMode: true } : {}),
          ...(json.preferences?.mood ? { activeMood: json.preferences.mood } : {}),
        },
      };
    }
  } catch {
    // Offline fallback
  }

  return {
    replyText: 'Đã ghi nhận yêu cầu ưu tiên chủ đề cho bảng tin của bạn.',
    patch: {},
  };
}
