import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/core/network/supabase';
import type { QuestionSet } from '@/core/domain/models';

export type ExternalPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export async function getExternalNotificationPermission(): Promise<ExternalPermissionState> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission as ExternalPermissionState;
  }
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return 'granted';
    return perm.canAskAgain ? 'default' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function requestExternalNotificationPermission(): Promise<ExternalPermissionState> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
    try {
      const res = await Notification.requestPermission();
      return res as ExternalPermissionState;
    } catch {
      return 'denied';
    }
  }
  try {
    const res = await Notifications.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/**
 * Fires a real OS/Browser notification that appears even when the user is outside the app
 * or on another browser tab (PWA / Web Notifications API / Expo Local Notification).
 */
export async function dispatchExternalNotification(title: string, body: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    try {
      const reg =
        'serviceWorker' in navigator
          ? await navigator.serviceWorker.getRegistration().catch(() => null)
          : null;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `papyrus-${Date.now()}`,
        });
        return true;
      }
      new Notification(title, { body, icon: '/icons/icon-192.png' });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export interface AdminUserSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  eloRating: number;
  totalScore: number;
  gamesPlayed: number;
  role: string;
  membershipTier: string;
}

export async function listAllUsersForAdmin(): Promise<AdminUserSummary[]> {
  if (!supabase) return [];
  const byId = new Map<string, AdminUserSummary>();

  try {
    const { data, error } = await supabase.rpc('get_leaderboard_players', {
      p_timeframe: 'all',
      p_topic: 'all',
      p_limit: 100,
      p_offset: 0,
    });
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<Record<string, unknown>>) {
        const id = String(row.user_id ?? '');
        if (!id) continue;
        byId.set(id, {
          id,
          displayName: String(row.display_name || 'Học giả Papyrus'),
          avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
          eloRating: 1200,
          totalScore: Number(row.total_score ?? 0),
          gamesPlayed: Number(row.games_played ?? 0),
          role: 'user',
          membershipTier: 'apprentice',
        });
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, elo_rating, total_score, games_played, role, membership_tier')
      .limit(100);
    if (Array.isArray(data)) {
      for (const p of data as Array<Record<string, unknown>>) {
        const id = String(p.id ?? '');
        if (!id) continue;
        byId.set(id, {
          id,
          displayName: String(p.display_name || 'Học giả Papyrus'),
          avatarUrl: typeof p.avatar_url === 'string' ? p.avatar_url : null,
          eloRating: Number(p.elo_rating ?? 1200),
          totalScore: Number(p.total_score ?? 0),
          gamesPlayed: Number(p.games_played ?? 0),
          role: String(p.role || 'user'),
          membershipTier: String(p.membership_tier || 'apprentice'),
        });
      }
    }
  } catch {
    // Non-fatal
  }

  return Array.from(byId.values());
}

export async function sendAdminGiftToCloud(input: {
  recipientId: string;
  recipientName: string;
  giftType: 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze';
  title: string;
  message: string;
  questionSet?: QuestionSet;
  documentText?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('admin_gifts').insert({
      recipient_id: input.recipientId,
      recipient_name: input.recipientName,
      gift_type: input.giftType,
      title: input.title,
      message: input.message,
      payload: {
        questionSet: input.questionSet ?? null,
        documentText: input.documentText ?? null,
      },
    });
    return !error;
  } catch {
    return false;
  }
}

export async function fetchCloudGiftsForCurrentUser(): Promise<
  Array<{
    id: string;
    recipientId: string;
    recipientName: string;
    giftType: 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze';
    title: string;
    message: string;
    questionSet?: QuestionSet;
    documentText?: string;
    claimed: boolean;
    createdAt: string;
  }>
> {
  if (!supabase) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return [];
    const { data, error } = await supabase
      .from('admin_gifts')
      .select('id, recipient_id, recipient_name, gift_type, title, message, payload, claimed, created_at')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => {
      const payload = (row.payload ?? {}) as { questionSet?: QuestionSet; documentText?: string };
      return {
        id: String(row.id),
        recipientId: String(row.recipient_id),
        recipientName: String(row.recipient_name ?? ''),
        giftType: (row.gift_type as 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze') ?? 'question_set',
        title: String(row.title ?? 'Quà tặng từ Quản trị viên'),
        message: String(row.message ?? ''),
        questionSet: payload.questionSet ?? undefined,
        documentText: payload.documentText ?? undefined,
        claimed: Boolean(row.claimed),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      };
    });
  } catch {
    return [];
  }
}
