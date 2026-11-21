import { supabase } from '@/core/network/supabase';
import type { DuelCategoryId, EloMatchOutcome } from '@/features/room-battle/domain/elo';

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
  categoryElos: Record<string, number>;
}

/**
 * Best-effort cloud sync for 1v1 Ranked / Unrated Friend Invite duels.
 * Never throws so offline play remains smooth.
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
 * Best-effort cloud sync for streak, membership tier, and aggregate gameplay progress.
 */
export async function syncUserProgressToCloud(input: {
  currentStreak?: number;
  longestStreak?: number;
  streakFreezeCount?: number;
  lastActiveDate?: string | null;
  membershipTier?: 'apprentice' | 'archmage';
  gamesPlayed?: number;
  totalScore?: number;
  bestScore?: number;
  wins?: number;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return false;
    const { error } = await supabase.rpc('sync_user_progress', {
      p_current_streak: input.currentStreak ?? null,
      p_longest_streak: input.longestStreak ?? null,
      p_streak_freeze_count: input.streakFreezeCount ?? null,
      p_last_active_date: input.lastActiveDate ?? null,
      p_membership_tier: input.membershipTier ?? null,
      p_games_played: input.gamesPlayed ?? null,
      p_total_score: input.totalScore ?? null,
      p_best_score: input.bestScore ?? null,
      p_wins: input.wins ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Pull the authenticated user's profile stats and per-category ELOs from Supabase.
 */
export async function fetchCloudProfileSnapshot(): Promise<CloudProfileSnapshot | null> {
  if (!supabase) return null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const [{ data: profile }, { data: catRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'elo_rating, elo_peak, games_played, total_score, best_score, wins, membership_tier, current_streak, longest_streak, streak_freeze_count, last_active_date'
        )
        .eq('id', userData.user.id)
        .maybeSingle(),
      supabase
        .from('category_elos')
        .select('category_id, elo_rating')
        .eq('user_id', userData.user.id),
    ]);

    if (!profile) return null;
    const categoryElos: Record<string, number> = {};
    if (Array.isArray(catRows)) {
      for (const row of catRows) {
        if (typeof row.category_id === 'string' && typeof row.elo_rating === 'number') {
          categoryElos[row.category_id] = row.elo_rating;
        }
      }
    }

    return {
      eloRating: Number(profile.elo_rating ?? 1200),
      eloPeak: Number(profile.elo_peak ?? 1200),
      gamesPlayed: Number(profile.games_played ?? 0),
      totalScore: Number(profile.total_score ?? 0),
      bestScore: Number(profile.best_score ?? 0),
      wins: Number(profile.wins ?? 0),
      membershipTier: profile.membership_tier === 'archmage' ? 'archmage' : 'apprentice',
      currentStreak: Number(profile.current_streak ?? 0),
      longestStreak: Number(profile.longest_streak ?? 0),
      streakFreezeCount: Number(profile.streak_freeze_count ?? 1),
      lastActiveDate: typeof profile.last_active_date === 'string' ? profile.last_active_date : null,
      categoryElos,
    };
  } catch {
    return null;
  }
}
