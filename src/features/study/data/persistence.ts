import { getLatestAttempt, saveAttempt } from '@/core/database/sqlite';
import type { Attempt } from '@/core/domain/models';
import type { StudyRepository } from '../domain/repository';

export const studyRepository: StudyRepository = {
  saveAttempt: async (attempt: Attempt) => {
    await saveAttempt(attempt);
  },
  getLatestAttempt: async (questionSetId: string) => getLatestAttempt(questionSetId),
};
