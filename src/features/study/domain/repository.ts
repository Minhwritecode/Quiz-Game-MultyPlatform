import type { Attempt, StudyProgress } from '@/core/domain/models';

export interface StudyRepository {
  saveAttempt(attempt: Attempt): Promise<void>;
  getLatestAttempt(questionSetId: string): Promise<Attempt | null>;
  getAttempt(attemptId: string): Promise<Attempt | null>;
  listAttempts(): Promise<Attempt[]>;
  getProgress(questionSetId: string): Promise<StudyProgress | null>;
  listProgress(): Promise<StudyProgress[]>;
  saveProgress(progress: StudyProgress): Promise<void>;
  clearProgress(questionSetId: string): Promise<void>;
}
