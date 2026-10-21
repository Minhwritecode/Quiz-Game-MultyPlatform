import type { QuestionSet } from '@/core/domain/models';

export type WebDatabase = null;

export function getLocalDatabase(): WebDatabase {
  return null;
}

export function persistQuestionSet(_questionSet: QuestionSet): void {
  // Web uses the Zustand demo cache until a WASM SQLite asset is explicitly shipped.
}
