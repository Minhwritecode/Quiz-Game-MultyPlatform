import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';
import { roomRepository } from '@/features/room-battle/data/roomRepository';

export const dependencies = {
  questionSets: questionSetRepository,
  study: studyRepository,
  rooms: roomRepository,
};
