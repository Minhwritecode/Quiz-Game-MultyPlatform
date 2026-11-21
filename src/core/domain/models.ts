export type SyncStatus = 'synced' | 'pending' | 'failed';

export type QuestionType = 'multiple_choice' | 'true_false';

export type Question = {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  position: number;
  /** Optional question type; defaults to 4-option multiple_choice */
  questionType?: QuestionType;
  /** Optional code snippet shown before answer options (displayed in monospace block) */
  codeSnippet?: string;
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
  correctCount: number;
  total: number;
  startedAt: string;
  finishedAt: string;
  status: 'completed';
  answers: AttemptAnswer[];
};

export type AttemptAnswer = {
  questionId: string;
  chosenIndex: number | null;
  isCorrect: boolean;
  timeMs: number;
};

export type StudyProgress = {
  questionSetId: string;
  currentIndex: number;
  selectedIndex: number | null;
  revealed: boolean;
  answers: AttemptAnswer[];
  startedAt: string;
  updatedAt: string;
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
  const expectedLength = question.questionType === 'true_false' ? 2 : 4;
  return (
    question.content.trim().length > 0 &&
    question.options.length === expectedLength &&
    question.options.every((option) => option.trim().length > 0) &&
    new Set(question.options.map((option) => option.trim().toLocaleLowerCase())).size === expectedLength &&
    Number.isInteger(question.correctIndex) &&
    question.correctIndex >= 0 &&
    question.correctIndex < question.options.length
  );
}

export function calculateSpeedScore(isCorrect: boolean, remainingMs: number): number {
  if (!isCorrect) return 0;
  return 1000 + Math.min(500, Math.max(0, Math.floor(remainingMs / 100)));
}

/**
 * 10-tier competitive speed scoring (inspired by competitive quiz ranking systems).
 * Base: 1000 pts always for correct answer.
 * Speed bonus (0–500): based on how quickly player answered relative to timeLimit.
 * Tier breakdown (elapsed ratio → bonus):
 *   <5%  → 500   <10% → 445   <15% → 390   <20% → 335
 *   <30% → 280   <40% → 220   <55% → 165   <70% → 110
 *   <85% → 55    else → 0
 */
export function calculateTieredSpeedScore(
  isCorrect: boolean,
  remainingMs: number,
  timeLimitMs = 15_000,
): number {
  if (!isCorrect) return 0;
  const elapsedMs = Math.max(0, timeLimitMs - remainingMs);
  const ratio = elapsedMs / Math.max(1, timeLimitMs);
  let bonus = 0;
  if      (ratio < 0.05) bonus = 500;
  else if (ratio < 0.10) bonus = 445;
  else if (ratio < 0.15) bonus = 390;
  else if (ratio < 0.20) bonus = 335;
  else if (ratio < 0.30) bonus = 280;
  else if (ratio < 0.40) bonus = 220;
  else if (ratio < 0.55) bonus = 165;
  else if (ratio < 0.70) bonus = 110;
  else if (ratio < 0.85) bonus = 55;
  else                   bonus = 0;
  return 1000 + bonus;
}
