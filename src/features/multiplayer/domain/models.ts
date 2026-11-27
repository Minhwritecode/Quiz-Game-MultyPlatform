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
      explanation?: string;
      codeSnippet?: string;
    }>;
  };
  status: RoomStatus;
  currentQuestionIndex: number;
  players: RoomPlayer[];
  remainingTime?: number;
  maxPlayers?: number;
  timeLimit?: number;
  readTimeSec?: 0 | 3 | 5 | 10;
  reactionsEnabled?: boolean;
}

export interface CurrentQuestionData {
  index: number;
  totalQuestions: number;
  question: string;
  options: string[];
  remainingTime: number;
  explanation?: string;
  codeSnippet?: string;
}

export interface LeaderboardPlayer {
  playerId: string;
  nickname: string;
  score: number;
  rank?: number;
}

export interface LeaderboardData {
  leaderboard: LeaderboardPlayer[];
}
