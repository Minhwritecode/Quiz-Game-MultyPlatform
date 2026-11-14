import { clearProgress, getAttempt, getLatestAttempt, getProgress, listAttempts, listProgress, saveAttempt, saveProgress } from '@/core/database/sqlite';
import type { Attempt } from '@/core/domain/models';
import type { StudyRepository } from '../domain/repository';

let progressWrites: Promise<void> = Promise.resolve();
function orderedWrite(action: () => Promise<void>): Promise<void> {
  const next = progressWrites.then(action, action);
  progressWrites = next.catch(() => undefined);
  return next;
}

export const studyRepository: StudyRepository = {
  saveAttempt: async (attempt: Attempt) => {
    await saveAttempt(attempt);
  },
  getLatestAttempt: async (questionSetId: string) => getLatestAttempt(questionSetId),
  getAttempt: async (attemptId: string) => getAttempt(attemptId),
  listAttempts: async () => listAttempts(),
  getProgress: async (questionSetId: string) => getProgress(questionSetId),
  listProgress: async () => listProgress(),
  saveProgress: async (progress) => orderedWrite(() => saveProgress(progress)),
  clearProgress: async (questionSetId) => orderedWrite(() => clearProgress(questionSetId)),
};
