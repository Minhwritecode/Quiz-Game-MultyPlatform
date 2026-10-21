export type SyncStatus = 'synced' | 'pending' | 'failed';

export type Question = {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  position: number;
};

export type QuestionSet = {
  id: string;
  title: string;
  subject: string;
  questions: Question[];
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type AppUser = {
  id: string;
  email?: string;
  displayName: string;
};

export type Attempt = {
  id: string;
  questionSetId: string;
  score: number;
  total: number;
  startedAt: string;
  finishedAt?: string;
};

export type SyncOperation = 'insert' | 'update' | 'delete';

export type SyncItem = {
  id: number;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
};

export type SourceDocument = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
};

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export type GenerationRequest = {
  sourceText: string;
  questionCount: number;
  difficulty: QuestionDifficulty;
  languageCode: string;
};

export type Room = {
  id: string;
  code: string;
  players: number;
  status: 'waiting' | 'countdown' | 'question_open' | 'finished';
};

export function isValidQuestion(question: Question): boolean {
  return question.content.trim().length > 0 &&
    question.options.length === 4 &&
    question.options.every((option) => option.trim().length > 0) &&
    new Set(question.options).size === 4 &&
    question.correctIndex >= 0 && question.correctIndex < question.options.length;
}

export function calculateSpeedScore(isCorrect: boolean, remainingMs: number): number {
  if (!isCorrect) return 0;
  return 1000 + Math.min(500, Math.max(0, Math.floor(remainingMs / 100)));
}
