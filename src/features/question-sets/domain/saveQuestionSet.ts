import { isValidQuestion } from '@/core/domain/models';
import type { QuestionSet } from '@/core/domain/models';
import type { QuestionSetRepository } from './repository';

export function saveQuestionSet(repository: QuestionSetRepository, questionSet: QuestionSet): Promise<void> {
  if (!questionSet.title.trim() || !questionSet.subject.trim() || questionSet.questions.length === 0) {
    return Promise.reject(new Error('A question set needs a title, subject and at least one question.'));
  }
  if (questionSet.questions.some((question) => !isValidQuestion(question))) {
    return Promise.reject(new Error('The question set contains an invalid question.'));
  }
  return repository.save(questionSet);
}
