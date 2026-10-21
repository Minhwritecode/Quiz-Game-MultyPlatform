import type { QuestionSet } from '@/core/domain/models';

// Metro selects sqlite.native.ts on iOS/Android and sqlite.web.ts on web.
// This type-only fallback keeps plain TypeScript tooling platform-agnostic.
export function getLocalDatabase(): unknown {
  return null;
}

export function persistQuestionSet(_questionSet: QuestionSet): void {
  // Implemented by the platform-specific adapter.
}
