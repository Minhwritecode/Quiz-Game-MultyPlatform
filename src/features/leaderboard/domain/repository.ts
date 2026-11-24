import { AppError } from '@/core/domain/failure';

export type Ranking = { rank: number; displayName: string; points: number; matches: number; isMe: boolean };
export interface LeaderboardRepository {
  list(offset: number): Promise<Ranking[]>;
}

export type LeaderboardTimeframe = 'week' | 'month' | 'all';
export type LeaderboardTopic =
  | 'all'
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'history'
  | 'english'
  | 'science';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  score: number;
  scoreLabel: string;
  gamesPlayed: number;
  streak: number;
  avatar: string;
  avatarUrl?: string | null;
  isMe: boolean;
  isFriend?: boolean;
  topic: LeaderboardTopic;
}

export interface FriendSearchCandidate {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  eloRating: number;
  totalScore: number;
}

export interface LeaderboardFetchResult {
  entries: LeaderboardEntry[];
  source: 'live' | 'offline';
  totalCount: number;
}

export interface BattleHistoryItem {
  matchId: string;
  kind: string;
  label: string;
  myScore: number;
  opponentOrPlayers: string;
  outcome: 'win' | 'loss' | 'draw' | 'forfeit';
  eloDelta: number;
  playedAt: string;
}

export function createLeaderboardUseCases(repository: LeaderboardRepository) {
  return {
    list(offset: number) {
      if (!Number.isInteger(offset) || offset < 0 || offset > 10000) {
        throw new AppError('validation', 'Trang xếp hạng không hợp lệ.');
      }
      return repository.list(offset);
    },
  };
}
