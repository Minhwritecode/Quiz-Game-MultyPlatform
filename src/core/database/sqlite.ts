import type { Attempt, QuestionSet } from '@/core/domain/models';

// Metro selects sqlite.native.ts on iOS/Android and sqlite.web.ts on web.
// This type-only fallback keeps plain TypeScript tooling platform-agnostic.
export function getLocalDatabase(): unknown {
  return null;
}

export async function persistQuestionSet(_questionSet: QuestionSet): Promise<void> {
  // Implemented by the platform-specific adapter.
}

export async function loadQuestionSets(): Promise<QuestionSet[]> {
  return [];
}

export async function saveAttempt(_attempt: Attempt): Promise<void> {
  // Implemented by the platform-specific adapter.
}

export async function getLatestAttempt(_questionSetId: string): Promise<Attempt | null> {
  return null;
}
