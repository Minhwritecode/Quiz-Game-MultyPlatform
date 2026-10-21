import { isValidQuestion } from '@/core/domain/models';
import type { Question } from '@/core/domain/models';

export function validateQuestion(question: Question): Question | null {
  return isValidQuestion(question) ? question : null;
}
