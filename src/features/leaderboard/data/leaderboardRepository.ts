import { supabase } from '@/core/network/supabase';
import type {
  BattleHistoryItem,
  FriendSearchCandidate,
  LeaderboardEntry,
  LeaderboardFetchResult,
  LeaderboardTimeframe,
  LeaderboardTopic,
} from '../domain/repository';

export type {
  BattleHistoryItem,
  FriendSearchCandidate,
  LeaderboardEntry,
  LeaderboardFetchResult,
  LeaderboardTimeframe,
  LeaderboardTopic,
};

const TOPIC_KEYWORDS: Record<LeaderboardTopic, string> = {
  all: 'all',
  math: 'toán',
  physics: 'lý',
  chemistry: 'hóa',
  biology: 'sinh',
  history: 'sử',
  english: 'anh',
  science: 'khoa',
};

const AVATARS = ['🏆', '🥈', '🥉', '⭐', '⚡', '🎯', '🔥', '💫', '🌟', '✨'];

const COMMUNITY_BENCHMARK: Array<Omit<LeaderboardEntry, 'scoreLabel'>> = [
  { id: 'b1', rank: 1, name: 'Linh Nguyễn', score: 14500, gamesPlayed: 24, streak: 12, avatar: '🏆', isMe: false, topic: 'math' },
  { id: 'b2', rank: 2, name: 'Minh Trần', score: 12800, gamesPlayed: 19, streak: 9, avatar: '🥈', isMe: false, topic: 'physics' },
  { id: 'b3', rank: 3, name: 'An Phạm', score: 11200, gamesPlayed: 17, streak: 7, avatar: '🥉', isMe: false, topic: 'chemistry' },
  { id: 'b4', rank: 4, name: 'Hải Đăng', score: 9800, gamesPlayed: 15, streak: 5, avatar: '⭐', isMe: false, topic: 'biology' },
  { id: 'b5', rank: 5, name: 'Thu Hà', score: 8500, gamesPlayed: 12, streak: 4, avatar: '⚡', isMe: false, topic: 'history' },
];

type RpcRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_score: number | string;
  games_played: number | string;
  rank: number | string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  total_score?: number | null;
  games_played?: number | null;
  elo_rating?: number | null;
};

function formatXp(score: number): string {
  return `${Math.round(score).toLocaleString('vi-VN')} XP`;
}

export async function fetchGlobalLeaderboard(params: {
  timeframe: LeaderboardTimeframe;
  topic: LeaderboardTopic;
  currentUserId?: string;
  currentUserName?: string;
  localScore?: number;
  localGamesPlayed?: number;
  localStreak?: number;
}): Promise<LeaderboardFetchResult> {
  const {
    timeframe,
    topic,
    currentUserId,
    currentUserName,
    localScore = 0,
    localGamesPlayed = 0,
    localStreak = 0,
  } = params;

  if (supabase) {
    // 1. Primary: real Supabase aggregation RPC
    try {
      const { data, error } = await supabase.rpc('get_leaderboard_players', {
        p_timeframe: timeframe,
        p_topic: TOPIC_KEYWORDS[topic],
        p_limit: 50,
        p_offset: 0,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const rows = data as RpcRow[];
        const entries: LeaderboardEntry[] = rows.map((row, idx) => {
          const numericScore = Number(row.total_score ?? 0);
          const numericRank = Number(row.rank ?? idx + 1);
          const games = Number(row.games_played ?? 0);
          return {
            id: row.user_id,
            rank: numericRank,
            name: row.display_name || 'Học giả Papyrus',
            score: numericScore,
            scoreLabel: formatXp(numericScore),
            gamesPlayed: games,
            streak: row.user_id === currentUserId ? localStreak : Math.max(1, Math.min(14, games)),
            avatar: AVATARS[idx % AVATARS.length] ?? '⭐',
            avatarUrl: row.avatar_url ?? null,
            isMe: Boolean(currentUserId && row.user_id === currentUserId),
            topic,
          };
        });
        return { entries, source: 'live', totalCount: entries.length };
      }
    } catch {
      // Fall through to real profiles query
    }

    // 2. Fallback on live backend: query real registered profiles directly (no fake mock names!)
    try {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, total_score, games_played, elo_rating')
        .order('total_score', { ascending: false })
        .order('elo_rating', { ascending: false })
        .limit(50);

      if (!profErr && Array.isArray(profiles) && profiles.length > 0) {
        const entries: LeaderboardEntry[] = (profiles as ProfileRow[]).map((p, idx) => {
          const score = Number(p.total_score ?? 0);
          const games = Number(p.games_played ?? 0);
          return {
            id: p.id,
            rank: idx + 1,
            name: p.display_name || 'Học giả Papyrus',
            score,
            scoreLabel: formatXp(score),
            gamesPlayed: games,
            streak: p.id === currentUserId ? localStreak : Math.max(0, Math.min(14, games)),
            avatar: AVATARS[idx % AVATARS.length] ?? '⭐',
            avatarUrl: p.avatar_url ?? null,
            isMe: Boolean(currentUserId && p.id === currentUserId),
            topic,
          };
        });
        return { entries, source: 'live', totalCount: entries.length };
      }
    } catch {
      // Fall through to offline mode only if completely unreachable
    }
  }

  // 3. Offline-only fallback when Supabase is unreachable / unconfigured
  const multiplier = timeframe === 'week' ? 1 : timeframe === 'month' ? 2.8 : 6.5;
  const filtered = COMMUNITY_BENCHMARK
    .filter((p) => topic === 'all' || p.topic === topic)
    .map((p) => ({
      ...p,
      score: Math.round(p.score * multiplier),
    }));

  const meScore = Math.max(localScore, 1450);
  const myRow: Omit<LeaderboardEntry, 'scoreLabel'> = {
    id: currentUserId || 'local-me',
    rank: 0,
    name: currentUserName || 'Bạn (Học giả)',
    score: Math.round(meScore * (timeframe === 'week' ? 1 : timeframe === 'month' ? 1.5 : 2)),
    gamesPlayed: Math.max(1, localGamesPlayed),
    streak: Math.max(1, localStreak),
    avatar: '🧙',
    isMe: true,
    topic: topic === 'all' ? 'math' : topic,
  };

  const merged = [...filtered, myRow]
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      scoreLabel: formatXp(item.score),
    }));

  return { entries: merged, source: 'offline', totalCount: merged.length };
}

export async function fetchFriendsLeaderboard(params: {
  timeframe: LeaderboardTimeframe;
  currentUserId?: string;
  currentUserName?: string;
  localScore?: number;
  localGamesPlayed?: number;
  localStreak?: number;
}): Promise<LeaderboardFetchResult> {
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? params.currentUserId;
      if (sessionData.session && uid) {
        const entryMap = new Map<string, LeaderboardEntry>();
        const acceptedFriendIds = new Set<string>();

        // 1. Formal friends from RPC
        const { data, error } = await supabase.rpc('get_friends_leaderboard', {
          p_timeframe: params.timeframe,
          p_limit: 30,
          p_offset: 0,
        });

        if (!error && Array.isArray(data)) {
          data.forEach((row: Record<string, unknown>, idx: number) => {
            const id = String(row.user_id ?? `f-${idx}`);
            const score = Number(row.total_score ?? 0);
            const games = Number(row.games_played ?? 0);
            const isMe = id === uid;
            if (!isMe) acceptedFriendIds.add(id);
            entryMap.set(id, {
              id,
              rank: Number(row.rank ?? idx + 1),
              name: String(row.display_name || 'Bạn học Papyrus'),
              score,
              scoreLabel: formatXp(score),
              gamesPlayed: games,
              streak: isMe ? params.localStreak ?? 1 : Math.max(1, Math.min(14, games)),
              avatar: AVATARS[idx % AVATARS.length] ?? '👥',
              avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
              isMe,
              isFriend: !isMe,
              topic: 'all',
            });
          });
        }

        // 2. Also discover real recent battle opponents from duel_matches & room_players
        //    so players you just battled (e.g. khoaimichaelminh) appear immediately with 1-tap Add Friend!
        const opponentIds = new Set<string>();
        try {
          const { data: duels } = await supabase
            .from('duel_matches')
            .select('challenger_id, opponent_id')
            .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
            .order('created_at', { ascending: false })
            .limit(30);

          for (const d of (duels ?? []) as Array<{ challenger_id?: string | null; opponent_id?: string | null }>) {
            if (d.challenger_id && d.challenger_id !== uid) opponentIds.add(d.challenger_id);
            if (d.opponent_id && d.opponent_id !== uid) opponentIds.add(d.opponent_id);
          }
        } catch {
          // Non-fatal if duel_matches query restricted
        }

        const missingIds = Array.from(opponentIds).filter((id) => !entryMap.has(id));
        if (missingIds.length > 0) {
          try {
            const { data: oppProfiles } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url, total_score, games_played')
              .in('id', missingIds);

            for (const p of (oppProfiles ?? []) as ProfileRow[]) {
              const score = Number(p.total_score ?? 0);
              const games = Number(p.games_played ?? 1);
              entryMap.set(p.id, {
                id: p.id,
                rank: 0,
                name: p.display_name || 'Đối thủ gần đây',
                score,
                scoreLabel: formatXp(score),
                gamesPlayed: games,
                streak: Math.max(1, Math.min(14, games)),
                avatar: '⚔️',
                avatarUrl: p.avatar_url ?? null,
                isMe: false,
                isFriend: acceptedFriendIds.has(p.id),
                topic: 'all',
              });
            }
          } catch {
            // Non-fatal
          }
        }

        if (entryMap.size > 0) {
          const sorted = Array.from(entryMap.values())
            .sort((a, b) => b.score - a.score)
            .map((entry, idx) => ({
              ...entry,
              rank: idx + 1,
            }));
          return { entries: sorted, source: 'live', totalCount: sorted.length };
        }
      }
    } catch {
      // Fall through only when offline
    }
  }

  // Offline / signed-out fallback (honest single user row if signed out)
  const myScore = params.localScore ?? 0;
  const selfOnly: LeaderboardEntry[] = [
    {
      id: params.currentUserId || 'local-me',
      rank: 1,
      name: params.currentUserName || 'Bạn (Học giả)',
      score: myScore,
      scoreLabel: formatXp(myScore),
      gamesPlayed: params.localGamesPlayed ?? 0,
      streak: params.localStreak ?? 0,
      avatar: '🧙',
      isMe: true,
      topic: 'all',
    },
  ];
  return { entries: selfOnly, source: 'offline', totalCount: selfOnly.length };
}

export async function searchPlayersForFriend(query: string): Promise<FriendSearchCandidate[]> {
  const clean = query.trim();
  if (!supabase || clean.length < 2) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const myId = sessionData.session?.user?.id;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, elo_rating, total_score')
      .ilike('display_name', `%${clean}%`)
      .limit(12);
    if (error || !Array.isArray(data)) return [];
    return (data as ProfileRow[])
      .filter((row) => row.id !== myId)
      .map((row) => ({
        id: row.id,
        displayName: row.display_name || 'Học giả Papyrus',
        avatarUrl: row.avatar_url ?? null,
        eloRating: Number(row.elo_rating ?? 1200),
        totalScore: Number(row.total_score ?? 0),
      }));
  } catch {
    return [];
  }
}

export async function addFriendById(friendId: string): Promise<boolean> {
  if (!supabase || !friendId) return false;
  const { data, error } = await supabase.rpc('add_friend_by_id', { p_friend_id: friendId });
  if (error) return false;
  return Boolean(data);
}

export async function fetchMyBattleHistory(limit = 15): Promise<BattleHistoryItem[]> {
  if (!supabase) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return [];
    const { data, error } = await supabase.rpc('get_my_battle_history', {
      p_limit: limit,
      p_offset: 0,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
      matchId: String(row.match_id ?? ''),
      kind: String(row.kind ?? 'room'),
      label: String(row.label ?? 'Trận đấu'),
      myScore: Number(row.my_score ?? 0),
      opponentOrPlayers: String(row.opponent_or_players ?? ''),
      outcome: (['win', 'loss', 'draw', 'forfeit'].includes(String(row.outcome))
        ? String(row.outcome)
        : 'loss') as BattleHistoryItem['outcome'],
      eloDelta: Number(row.elo_delta ?? 0),
      playedAt: String(row.played_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}
