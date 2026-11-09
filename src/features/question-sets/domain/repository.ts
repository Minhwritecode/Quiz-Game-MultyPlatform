import type { QuestionSet } from '@/core/domain/models';

export interface QuestionSetRepository {
  list(): Promise<QuestionSet[]>;
  save(questionSet: QuestionSet): Promise<void>;
}
