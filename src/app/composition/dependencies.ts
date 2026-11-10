import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';
import { roomRepository, battleRepository } from '@/features/room-battle/data/roomRepository';
import { localSyncQueue } from '@/features/sync/data/localQueue';
import { authRepository } from '@/features/auth/data/authRepository';
import { cloudSets } from '@/features/sync/data/cloudSets';

export const dependencies = {
  questionSets: questionSetRepository,
  study: studyRepository,
  rooms: roomRepository,
  battle: battleRepository,
  syncQueue: localSyncQueue,
  auth: authRepository,
  cloudSets,
};
