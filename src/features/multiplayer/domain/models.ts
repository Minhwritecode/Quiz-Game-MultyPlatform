export interface RoomPlayer {
  playerId: string;
  nickname: string;
  score: number;
  isHost?: boolean;
}

export type RoomStatus = 'waiting' | 'live' | 'paused' | 'ended';

export interface RoomData {
  roomCode: string;
  quizId: {
    _id?: string;
    id?: string;
    title: string;
    description: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer?: number;
    }>;
  };
  status: RoomStatus;
  currentQuestionIndex: number;
  players: RoomPlayer[];
  remainingTime?: number;
}

export interface CurrentQuestionData {
  index: number;
  totalQuestions: number;
  question: string;
  options: string[];
  remainingTime: number;
}

export interface LeaderboardPlayer {
  playerId: string;
  nickname: string;
  score: number;
}

export interface LeaderboardData {
  leaderboard: LeaderboardPlayer[];
}
