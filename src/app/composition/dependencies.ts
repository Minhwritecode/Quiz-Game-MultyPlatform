import { questionSetRepository } from '@/features/question-sets/data/persistence';
import { studyRepository } from '@/features/study/data/persistence';

export const dependencies = {
  questionSets: questionSetRepository,
  study: studyRepository,
};
