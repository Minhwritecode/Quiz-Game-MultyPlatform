import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';
import { roomRepository } from '@/features/room-battle/data/roomRepository';
import { localSyncQueue } from '@/features/sync/data/localQueue';
import { authRepository } from '@/features/auth/data/authRepository';

export const dependencies = {
  questionSets: questionSetRepository,
  study: studyRepository,
  rooms: roomRepository,
  syncQueue: localSyncQueue,
  auth: authRepository,
};
