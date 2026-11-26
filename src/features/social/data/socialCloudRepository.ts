import { Platform } from 'react-native';
import { fetch } from 'expo/fetch';
import { supabase } from '@/core/network/supabase';
import type {
  AdminManagedDocument,
  AiPostSummary,
  SocialModerationCase,
  SocialPostItem,
  SocialUserProfile,
  YourAlgoConfig,
} from '../domain/models';

function papybotApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/papybot`;
  }
  return 'https://papyrus-lyart-five.vercel.app/api/papybot';
}

/**
 * Syncs updated Profile Name, Avatar, Bio & Privacy to Supabase `public.profiles`
 * so a single unified User Identity powers Social, Communities, Messaging & Notifications.
 */
export async function syncUnifiedProfileToSupabase(profile: Partial<SocialUserProfile> & { id: string }): Promise<boolean> {
  if (!supabase || !profile.id || profile.id === 'guest') return false;
  try {
    const patch: Record<string, unknown> = {};
    if (profile.displayName !== undefined) patch.display_name = profile.displayName.trim();
    if (profile.avatarUrl !== undefined) patch.avatar_url = profile.avatarUrl;
    if (profile.coverUrl !== undefined) patch.cover_url = profile.coverUrl;
    if (profile.bio !== undefined) patch.bio = profile.bio;
    if (profile.university !== undefined) patch.university = profile.university;
    if (profile.major !== undefined) patch.major = profile.major;
    if (profile.interests !== undefined) patch.interests = profile.interests;
    if (profile.locationArea !== undefined) patch.location_area = profile.locationArea;
    if (profile.privacy?.isPrivateAccount !== undefined) patch.is_private = profile.privacy.isPrivateAccount;

    if (Object.keys(patch).length === 0) return true;
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetches real registered profiles from Supabase so users can search, follow, friend & message
 * each other strictly by their main Profile Name!
 */
export async function fetchRealProfilesDirectory(limit = 50): Promise<SocialUserProfile[]> {
  if (!supabase) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, avatar_url, cover_url, bio, university, major, interests, location_area, is_private, role, reputation_score, followers_count, following_count, friends_count, total_score'
      )
      .order('total_score', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((row: any) => ({
      id: String(row.id),
      displayName: String(row.display_name || '').trim() || 'Thành viên Papyrus',
      avatarUrl: row.avatar_url ?? null,
      coverUrl: row.cover_url ?? null,
      bio: String(row.bio || ''),
      university: String(row.university || ''),
      major: String(row.major || ''),
      interests: Array.isArray(row.interests) ? row.interests : [],
      locationArea: String(row.location_area || ''),
      websiteUrl: '',
      badges: [],
      reputationScore: Number(row.reputation_score ?? Math.round(Number(row.total_score ?? 0) / 25)),
      role: row.role === 'superadmin' || row.role === 'admin' || row.role === 'moderator' ? row.role : 'user',
      accountStatus: 'active',
      privacy: {
        isPrivateAccount: Boolean(row.is_private),
        allowMessagesFrom: 'everyone',
        allowMentionsFrom: 'everyone',
        showOnlineStatus: true,
        showJoinedCommunities: true,
        showPersonalInfo: 'public',
        discoverableInRecommendations: true,
      },
      followersCount: Number(row.followers_count ?? 0),
      followingCount: Number(row.following_count ?? 0),
      friendsCount: Number(row.friends_count ?? 0),
      profileViewsCount: 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Persists a Social Post / Thread / Scheduled Post / Ghost Post to Supabase `public.social_posts`
 * and runs the server-side scheduled/expiry sweep RPC when available.
 */
export async function persistSocialPostToSupabase(post: SocialPostItem): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return false;

    const { error } = await supabase.from('social_posts').upsert({
      id: post.id.length === 36 ? post.id : undefined,
      author_id: uid,
      post_kind: post.postKind,
      content: post.threadParts.join('\n\n'),
      thread_parts: post.threadParts,
      long_form_body: post.longFormBody ?? null,
      media_items: post.mediaItems,
      is_spoiler: post.isSpoiler,
      spoiler_warning: post.spoilerWarning ?? '',
      is_anonymous: post.isAnonymous,
      audience: post.audience,
      selected_audience_ids: post.selectedAudienceIds,
      reply_permission: post.replyPermission,
      topics: post.topics,
      hashtags: post.hashtags,
      location_label: post.locationLabel ?? null,
      lifecycle_status: post.lifecycleStatus,
      scheduled_for: post.scheduledFor ?? null,
      expires_at: post.expiresAt ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

let serverLifecycleRpcAvailable = process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LIFECYCLE_RPC === '1';

export async function triggerServerPostLifecycleSweep(): Promise<void> {
  if (!supabase || !serverLifecycleRpcAvailable) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return;
    const { error } = await supabase.rpc('process_social_post_schedules_and_expiry');
    if (error) {
      serverLifecycleRpcAvailable = false;
    }
  } catch {
    serverLifecycleRpcAvailable = false;
  }
}

export async function persistModerationCaseToSupabase(item: SocialModerationCase): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
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
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return { syncedToCloud: false, storagePath: null };

    let storagePath: string | null = doc.storagePath ?? null;
    if (doc.richContent && !storagePath) {
      const safeSlug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'doc';
      const candidatePath = `${uid}/${Date.now()}-${safeSlug}.md`;
      const blob = new Blob([doc.richContent], { type: 'text/markdown;charset=utf-8' });
      const uploadRes = await supabase.storage.from('gift-documents').upload(candidatePath, blob, {
        upsert: false,
      });
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
 * PapyAI Summary Generator for Long-Form Posts, Threads & Discussions (Section 10.2)
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
        ? `✨ **Tóm tắt bởi PapyAI:**\n${cleanSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : `✨ **Tóm tắt bởi PapyAI:** ${fullContent.slice(0, 240)}`,
    keyTakeaways: cleanSentences,
    generatedAt: new Date().toISOString(),
    contentRevisionHash: revisionHash,
  };
}

/**
 * PapyAI Natural-Language Feed Assistant (Section 10.1)
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
          ...(json.preferences?.boostTopics?.length ? { boostedTopics: json.preferences.boostTopics } : {}),
          ...(json.preferences?.muteTopics?.length ? { hiddenTopics: json.preferences.muteTopics } : {}),
          ...(json.preferences?.knowledgeOnly ? { knowledgeMode: true } : {}),
          ...(json.preferences?.mood ? { activeMood: json.preferences.mood } : {}),
        },
      };
    }
  } catch {
    // Offline fallback
  }

  return {
    replyText: '🤖 PapyAI đã ghi nhận yêu cầu ưu tiên chủ đề cho bảng tin của bạn!',
    patch: {},
  };
}
