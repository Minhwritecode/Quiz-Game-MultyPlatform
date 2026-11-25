import { supabase } from '@/core/network/supabase';
import { preferenceStorage } from '@/features/preferences/data/storage';
import type { DuelCategoryId, EloMatchOutcome } from '@/features/room-battle/domain/elo';

const KNOWN_USERS_STORAGE_KEY = 'papyrus.known_users_registry.v1';

export interface KnownAccountRecord {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl: string | null;
  eloRating: number;
  totalScore: number;
  gamesPlayed: number;
  currentStreak: number;
  role: string;
  membershipTier: string;
  updatedAt: string;
}

export async function readKnownUserAccounts(): Promise<KnownAccountRecord[]> {
  try {
    const raw = await preferenceStorage.getItem(KNOWN_USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KnownAccountRecord[]) : [];
  } catch {
    return [];
  }
}

export async function recordKnownUserAccount(input: Partial<KnownAccountRecord> & { id: string }): Promise<void> {
  if (!input.id || input.id === 'guest') return;
  try {
    const list = await readKnownUserAccounts();
    const idx = list.findIndex((item) => item.id === input.id);
    const existing = idx >= 0 ? list[idx] : undefined;
    const merged: KnownAccountRecord = {
      id: input.id,
      email: input.email ?? existing?.email,
      displayName: input.displayName || existing?.displayName || 'Học giả Papyrus',
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing?.avatarUrl ?? null,
      eloRating: input.eloRating ?? existing?.eloRating ?? 1200,
      totalScore: input.totalScore ?? existing?.totalScore ?? 0,
      gamesPlayed: input.gamesPlayed ?? existing?.gamesPlayed ?? 0,
      currentStreak: input.currentStreak ?? existing?.currentStreak ?? 0,
      role: input.role ?? existing?.role ?? 'user',
      membershipTier: input.membershipTier ?? existing?.membershipTier ?? 'apprentice',
      updatedAt: new Date().toISOString(),
    };
    const next = idx >= 0 ? list.map((u, i) => (i === idx ? merged : u)) : [merged, ...list].slice(0, 200);
    await preferenceStorage.setItem(KNOWN_USERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

export interface CloudProfileSnapshot {
  eloRating: number;
  eloPeak: number;
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  wins: number;
  membershipTier: 'apprentice' | 'archmage';
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  lastActiveDate: string | null;
  historyDates: string[];
  categoryElos: Record<string, number>;
  coverUrl?: string | null;
  bio?: string;
  university?: string;
  major?: string;
}

/**
 * Best-effort cloud sync for 1v1 Ranked / Unrated Friend Invite duels.
 */
export async function syncDuelResultToCloud(input: {
  categoryId: DuelCategoryId;
  rated: boolean;
  opponentName: string;
  opponentElo: number;
  challengerScore: number;
  opponentScore: number;
  outcome: EloMatchOutcome;
  eloDelta: number;
  nextElo: number;
  inviteCode?: string | null;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return false;
    const { error } = await supabase.rpc('record_duel_result', {
      p_category_id: input.categoryId,
      p_rated: input.rated,
      p_opponent_name: input.opponentName,
      p_opponent_elo: input.opponentElo,
      p_challenger_score: input.challengerScore,
      p_opponent_score: input.opponentScore,
      p_outcome: input.outcome,
      p_elo_delta: input.eloDelta,
      p_next_elo: input.nextElo,
      p_invite_code: input.inviteCode ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Bidirectional Cloud Sync for user progress, streak, XP, ELO, VIP tier, and profile metadata.
 * Persists to BOTH `auth.users.raw_user_meta_data.papyrus_sync` (guaranteed across all Supabase setups)
 * AND `sync_user_progress` RPC + Known Users Registry for Admin Console visibility.
 */
export async function syncUserProgressToCloud(input: {
  currentStreak?: number;
  longestStreak?: number;
  streakFreezeCount?: number;
  lastActiveDate?: string | null;
  historyDates?: string[];
  membershipTier?: 'apprentice' | 'archmage';
  gamesPlayed?: number;
  totalScore?: number;
  bestScore?: number;
  wins?: number;
  eloRating?: number;
  eloPeak?: number;
  coverUrl?: string | null;
  bio?: string;
  university?: string;
  major?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData.session?.user;
    if (!authUser) return false;

    const prevSync =
      (authUser.user_metadata?.papyrus_sync as Record<string, unknown> | undefined) ?? {};
    const mergedSync: Record<string, unknown> = {
      ...prevSync,
      ...(input.currentStreak !== undefined ? { currentStreak: input.currentStreak } : {}),
      ...(input.longestStreak !== undefined ? { longestStreak: input.longestStreak } : {}),
      ...(input.streakFreezeCount !== undefined ? { streakFreezeCount: input.streakFreezeCount } : {}),
      ...(input.lastActiveDate !== undefined ? { lastActiveDate: input.lastActiveDate } : {}),
      ...(input.historyDates !== undefined ? { historyDates: input.historyDates.slice(0, 35) } : {}),
      ...(input.membershipTier !== undefined ? { membershipTier: input.membershipTier } : {}),
      ...(input.gamesPlayed !== undefined ? { gamesPlayed: input.gamesPlayed } : {}),
      ...(input.totalScore !== undefined ? { totalScore: input.totalScore } : {}),
      ...(input.bestScore !== undefined ? { bestScore: input.bestScore } : {}),
      ...(input.wins !== undefined ? { wins: input.wins } : {}),
      ...(input.eloRating !== undefined ? { eloRating: input.eloRating } : {}),
      ...(input.eloPeak !== undefined ? { eloPeak: input.eloPeak } : {}),
      ...(input.coverUrl !== undefined && (!input.coverUrl || input.coverUrl.length < 140_000)
        ? { coverUrl: input.coverUrl }
        : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.university !== undefined ? { university: input.university } : {}),
      ...(input.major !== undefined ? { major: input.major } : {}),
      updatedAt: new Date().toISOString(),
    };

    void recordKnownUserAccount({
      id: authUser.id,
      email: authUser.email,
      displayName:
        (authUser.user_metadata?.full_name as string | undefined) ||
        (authUser.email ? authUser.email.split('@')[0] : 'Học giả'),
      avatarUrl: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
      eloRating: Number(mergedSync.eloRating ?? 1200),
      totalScore: Number(mergedSync.totalScore ?? 0),
      gamesPlayed: Number(mergedSync.gamesPlayed ?? 0),
      currentStreak: Number(mergedSync.currentStreak ?? 0),
      membershipTier: String(mergedSync.membershipTier ?? 'apprentice'),
    });

    await supabase.auth.updateUser({
      data: { papyrus_sync: mergedSync },
    }).catch(() => undefined);

    await supabase
      .rpc('sync_user_progress', {
        p_current_streak: input.currentStreak ?? null,
        p_longest_streak: input.longestStreak ?? null,
        p_streak_freeze_count: input.streakFreezeCount ?? null,
        p_last_active_date: input.lastActiveDate ?? null,
        p_membership_tier: input.membershipTier ?? null,
        p_games_played: input.gamesPlayed ?? null,
        p_total_score: input.totalScore ?? null,
        p_best_score: input.bestScore ?? null,
        p_wins: input.wins ?? null,
      })
      .then(() => undefined, () => undefined);

    return true;
  } catch {
    return false;
  }
}

/**
 * Pull the authenticated user's profile stats, streak, and metadata from Supabase Auth + Profiles.
 */
export async function fetchCloudProfileSnapshot(): Promise<CloudProfileSnapshot | null> {
  if (!supabase) return null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const authUser = userData.user;
    if (!authUser) return null;

    const metaSync =
      (authUser.user_metadata?.papyrus_sync as Record<string, unknown> | undefined) ?? {};

    const [{ data: profile }, { data: catRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'display_name, avatar_url, role, elo_rating, elo_peak, games_played, total_score, best_score, wins, membership_tier, current_streak, longest_streak, streak_freeze_count, last_active_date'
        )
        .eq('id', authUser.id)
        .maybeSingle(),
      supabase
        .from('category_elos')
        .select('category_id, elo_rating')
        .eq('user_id', authUser.id),
    ]);

    const categoryElos: Record<string, number> = {};
    if (Array.isArray(catRows)) {
      for (const row of catRows) {
        if (typeof row.category_id === 'string' && typeof row.elo_rating === 'number') {
          categoryElos[row.category_id] = row.elo_rating;
        }
      }
    }

    const eloRating = Number(metaSync.eloRating ?? profile?.elo_rating ?? 1200);
    const eloPeak = Math.max(eloRating, Number(metaSync.eloPeak ?? profile?.elo_peak ?? 1200));
    const gamesPlayed = Math.max(
      Number(metaSync.gamesPlayed ?? 0),
      Number(profile?.games_played ?? 0)
    );
    const totalScore = Math.max(
      Number(metaSync.totalScore ?? 0),
      Number(profile?.total_score ?? 0)
    );
    const bestScore = Math.max(
      Number(metaSync.bestScore ?? 0),
      Number(profile?.best_score ?? 0)
    );
    const wins = Math.max(Number(metaSync.wins ?? 0), Number(profile?.wins ?? 0));
    const currentStreak = Math.max(
      Number(metaSync.currentStreak ?? 0),
      Number(profile?.current_streak ?? 0)
    );
    const longestStreak = Math.max(
      currentStreak,
      Number(metaSync.longestStreak ?? 0),
      Number(profile?.longest_streak ?? 0)
    );
    const streakFreezeCount = Number(
      metaSync.streakFreezeCount ?? profile?.streak_freeze_count ?? 1
    );
    const lastActiveDate =
      typeof metaSync.lastActiveDate === 'string'
        ? metaSync.lastActiveDate
        : typeof profile?.last_active_date === 'string'
        ? profile.last_active_date
        : null;
    const historyDates = Array.isArray(metaSync.historyDates)
      ? (metaSync.historyDates as string[])
      : lastActiveDate
      ? [lastActiveDate]
      : [];
    const membershipTier =
      metaSync.membershipTier === 'archmage' || profile?.membership_tier === 'archmage'
        ? 'archmage'
        : 'apprentice';

    void recordKnownUserAccount({
      id: authUser.id,
      email: authUser.email,
      displayName:
        (profile?.display_name as string | undefined) ||
        (authUser.user_metadata?.full_name as string | undefined) ||
        (authUser.email ? authUser.email.split('@')[0] : 'Học giả'),
      avatarUrl:
        (authUser.user_metadata?.avatar_url as string | undefined) ||
        (profile?.avatar_url as string | undefined) ||
        null,
      eloRating,
      totalScore,
      gamesPlayed,
      currentStreak,
      role: String(profile?.role ?? 'user'),
      membershipTier,
    });

    return {
      eloRating,
      eloPeak,
      gamesPlayed,
      totalScore,
      bestScore,
      wins,
      membershipTier,
      currentStreak,
      longestStreak,
      streakFreezeCount,
      lastActiveDate,
      historyDates,
      categoryElos,
      coverUrl: typeof metaSync.coverUrl === 'string' ? metaSync.coverUrl : null,
      bio: typeof metaSync.bio === 'string' ? metaSync.bio : undefined,
      university: typeof metaSync.university === 'string' ? metaSync.university : undefined,
      major: typeof metaSync.major === 'string' ? metaSync.major : undefined,
    };
  } catch {
    return null;
  }
}

export interface LiveMatchmakingResult {
  status: 'searching' | 'matched' | 'idle';
  isHuman: boolean;
  opponentId?: string;
  opponentName?: string;
  opponentElo?: number;
}

export async function enqueueLiveDuelQueue(input: {
  categoryId: DuelCategoryId;
  rated: boolean;
  eloRating: number;
  displayName: string;
  inviteCode?: string | null;
  eloBand?: number;
}): Promise<LiveMatchmakingResult | null> {
  if (!supabase) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;
    const { data, error } = await supabase.rpc('enqueue_duel_matchmaking', {
      p_category_id: input.categoryId,
      p_rated: input.rated,
      p_elo_rating: input.eloRating,
      p_display_name: input.displayName,
      p_invite_code: input.inviteCode ?? null,
      p_elo_band: input.eloBand ?? 250,
    });
    if (error || !data) return null;
    return {
      status: data.status === 'matched' ? 'matched' : 'searching',
      isHuman: Boolean(data.isHuman),
      opponentId: data.opponentId ? String(data.opponentId) : undefined,
      opponentName: data.opponentName ? String(data.opponentName) : undefined,
      opponentElo: typeof data.opponentElo === 'number' ? data.opponentElo : undefined,
    };
  } catch {
    return null;
  }
}

export async function pollLiveDuelQueue(
  categoryId: DuelCategoryId,
  eloBand: number
): Promise<LiveMatchmakingResult | null> {
  if (!supabase) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;
    const { data, error } = await supabase.rpc('poll_duel_matchmaking', {
      p_category_id: categoryId,
      p_elo_band: eloBand,
    });
    if (error || !data) return null;
    return {
      status: data.status === 'matched' ? 'matched' : data.status === 'searching' ? 'searching' : 'idle',
      isHuman: Boolean(data.isHuman),
      opponentId: data.opponentId ? String(data.opponentId) : undefined,
      opponentName: data.opponentName ? String(data.opponentName) : undefined,
      opponentElo: typeof data.opponentElo === 'number' ? data.opponentElo : undefined,
    };
  } catch {
    return null;
  }
}

export async function cancelLiveDuelQueue(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    await supabase.rpc('cancel_duel_matchmaking');
  } catch {
    // Ignore
  }
}
