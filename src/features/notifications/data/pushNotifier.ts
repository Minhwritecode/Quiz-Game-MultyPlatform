import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/core/network/supabase';
import type { QuestionSet } from '@/core/domain/models';
import { readKnownUserAccounts } from '@/features/profile/data/profileCloudSync';
import { getOnlineScholarCandidates } from '@/features/leaderboard/data/liveScholarDirectory';

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
    // Never fire user OS toast if current screen is the /admin console itself!
    if (window.location?.pathname?.startsWith('/admin')) return false;
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
  email?: string;
  displayName: string;
  avatarUrl: string | null;
  eloRating: number;
  totalScore: number;
  gamesPlayed: number;
  currentStreak?: number;
  isOnline?: boolean;
  role: string;
  membershipTier: string;
}

/**
 * Unified Enterprise User Discovery for `/admin`:
 * 1) `get_superadmin_overview` SECURITY DEFINER RPC (returns ALL `public.profiles` rows in Supabase Cloud!)
 * 2) `get_leaderboard_players` RPC
 * 3) Live Online Scholars via Supabase Realtime Presence (`liveScholarDirectory`)
 * 4) Known Registered Accounts Registry (`readKnownUserAccounts`) + active auth session
 */
export async function listAllUsersForAdmin(): Promise<AdminUserSummary[]> {
  const byId = new Map<string, AdminUserSummary>();
  const onlineList = getOnlineScholarCandidates();
  const onlineIds = new Set(onlineList.map((o) => o.id));

  // 1. Seed with Known Registered Accounts (includes email, avatar & streak)
  const known = await readKnownUserAccounts();
  for (const k of known) {
    byId.set(k.id, {
      id: k.id,
      email: k.email,
      displayName: k.displayName,
      avatarUrl: k.avatarUrl,
      eloRating: k.eloRating,
      totalScore: k.totalScore,
      gamesPlayed: k.gamesPlayed,
      currentStreak: k.currentStreak,
      isOnline: onlineIds.has(k.id),
      role: k.role || 'user',
      membershipTier: k.membershipTier || 'apprentice',
    });
  }

  // 2. Merge Live Online Scholars across devices
  for (const onl of onlineList) {
    const prev = byId.get(onl.id);
    byId.set(onl.id, {
      id: onl.id,
      email: prev?.email,
      displayName: onl.displayName || prev?.displayName || 'Học giả Trực tuyến',
      avatarUrl: onl.avatarUrl ?? prev?.avatarUrl ?? null,
      eloRating: Math.max(onl.eloRating, prev?.eloRating ?? 1200),
      totalScore: Math.max(onl.totalScore, prev?.totalScore ?? 0),
      gamesPlayed: prev?.gamesPlayed ?? 0,
      currentStreak: prev?.currentStreak ?? 0,
      isOnline: true,
      role: prev?.role ?? 'user',
      membershipTier: prev?.membershipTier ?? 'apprentice',
    });
  }

  if (!supabase) return Array.from(byId.values());

  // 3. Include currently signed-in Supabase user on this browser if any
  try {
    const { data: sess } = await supabase.auth.getSession();
    const u = sess.session?.user;
    if (u?.id) {
      const prev = byId.get(u.id);
      const sync = (u.user_metadata?.papyrus_sync as Record<string, unknown> | undefined) ?? {};
      byId.set(u.id, {
        id: u.id,
        email: u.email ?? prev?.email,
        displayName:
          (u.user_metadata?.full_name as string | undefined) ||
          prev?.displayName ||
          (u.email ? u.email.split('@')[0]! : 'Học giả Papyrus'),
        avatarUrl: (u.user_metadata?.avatar_url as string | undefined) ?? prev?.avatarUrl ?? null,
        eloRating: Number(sync.eloRating ?? prev?.eloRating ?? 1200),
        totalScore: Number(sync.totalScore ?? prev?.totalScore ?? 0),
        gamesPlayed: Number(sync.gamesPlayed ?? prev?.gamesPlayed ?? 0),
        currentStreak: Number(sync.currentStreak ?? prev?.currentStreak ?? 0),
        isOnline: true,
        role: prev?.role ?? 'user',
        membershipTier: String(sync.membershipTier ?? prev?.membershipTier ?? 'apprentice'),
      });
    }
  } catch {
    // Non-fatal
  }

  // 4. Call SECURITY DEFINER `get_superadmin_overview` RPC — fetches ALL rows in `public.profiles`!
  try {
    const { data: overview, error: ovErr } = await supabase.rpc('get_superadmin_overview');
    if (!ovErr && overview && typeof overview === 'object') {
      const cloudUsers = (overview as { users?: Array<Record<string, unknown>> }).users;
      if (Array.isArray(cloudUsers)) {
        for (const cu of cloudUsers) {
          const id = String(cu.id ?? '');
          if (!id) continue;
          const prev = byId.get(id);
          byId.set(id, {
            id,
            email: prev?.email,
            displayName: String(cu.displayName || prev?.displayName || 'Học giả Papyrus'),
            avatarUrl: prev?.avatarUrl ?? null,
            eloRating: Math.max(Number(cu.eloRating ?? 1200), prev?.eloRating ?? 1200),
            totalScore: prev?.totalScore ?? Number(cu.gamesPlayed ?? 0) * 120,
            gamesPlayed: Math.max(Number(cu.gamesPlayed ?? 0), prev?.gamesPlayed ?? 0),
            currentStreak: prev?.currentStreak ?? 0,
            isOnline: onlineIds.has(id) || Boolean(prev?.isOnline),
            role: String(cu.role || prev?.role || 'user'),
            membershipTier: String(cu.membershipTier || prev?.membershipTier || 'apprentice'),
          });
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // 5. Merge `get_leaderboard_players` for totalScore & avatars
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
        const prev = byId.get(id);
        byId.set(id, {
          id,
          email: prev?.email,
          displayName: String(row.display_name || prev?.displayName || 'Học giả Papyrus'),
          avatarUrl:
            typeof row.avatar_url === 'string' && row.avatar_url
              ? row.avatar_url
              : prev?.avatarUrl ?? null,
          eloRating: prev?.eloRating ?? 1200,
          totalScore: Math.max(Number(row.total_score ?? 0), prev?.totalScore ?? 0),
          gamesPlayed: Math.max(Number(row.games_played ?? 0), prev?.gamesPlayed ?? 0),
          currentStreak: Math.max(Number(row.streak ?? 0), prev?.currentStreak ?? 0),
          isOnline: onlineIds.has(id) || Boolean(prev?.isOnline),
          role: prev?.role ?? 'user',
          membershipTier: prev?.membershipTier ?? 'apprentice',
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
    // Also broadcast gift over Supabase Realtime so connected user devices get instant delivery even before SQL table migration!
    const bch = supabase.channel('papyrus:admin-broadcasts');
    bch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void bch
          .send({
            type: 'broadcast',
            event: 'admin-gift',
            payload: input,
          })
          .finally(() => {
            setTimeout(() => void supabase?.removeChannel(bch), 1200);
          });
      }
    });

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

export async function broadcastAdminNotificationToCloud(input: {
  recipientId: string | 'all';
  kind: 'system' | 'gift' | 'friend' | 'duel' | 'streak' | 'update';
  title: string;
  body: string;
  actionRoute?: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    const ch = supabase.channel('papyrus:admin-broadcasts');
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void ch
          .send({
            type: 'broadcast',
            event: 'admin-notif',
            payload: input,
          })
          .finally(() => {
            setTimeout(() => void supabase?.removeChannel(ch), 1200);
          });
      }
    });
  } catch {
    // Ignore
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
