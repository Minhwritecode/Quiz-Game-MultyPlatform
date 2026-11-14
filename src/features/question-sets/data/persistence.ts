import { loadQuestionSets, persistQuestionSet, removeQuestionSet } from '@/core/database/sqlite';
import type { QuestionSet } from '@/core/domain/models';
import type { QuestionSetRepository } from '../domain/repository';

export const questionSetRepository: QuestionSetRepository = {
  list: () => loadQuestionSets(),
  save: (questionSet) => persistQuestionSet(questionSet),
  remove: (questionSetId) => removeQuestionSet(questionSetId),
};

export function saveQuestionSetOffline(questionSet: QuestionSet): Promise<void> {
  return questionSetRepository.save(questionSet);
}
