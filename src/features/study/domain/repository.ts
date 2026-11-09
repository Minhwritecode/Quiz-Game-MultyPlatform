import type { Attempt } from '@/core/domain/models';

export interface StudyRepository {
  saveAttempt(attempt: Attempt): Promise<void>;
  getLatestAttempt(questionSetId: string): Promise<Attempt | null>;
}
