import { persistQuestionSet } from '@/core/database/sqlite';
import type { QuestionSet } from '@/core/domain/models';

export function saveQuestionSetOffline(questionSet: QuestionSet): void {
  persistQuestionSet(questionSet);
}
