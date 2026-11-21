// Pure domain helpers for Library & Study modes (Group E — FR-08–10)
// Supports set cloning, shuffled/timed/wrong-only study queues, safe progress resume, and per-set analytics.

import type { Attempt, Question, QuestionSet, StudyProgress } from '@/core/domain/models';

export type StudyMode = 'sequential' | 'shuffled' | 'timed' | 'wrong_only';

export interface PerSetAnalytics {
  setId: string;
  setTitle: string;
  attemptsCount: number;
  bestAccuracy: number;
  latestAccuracy: number;
  avgAccuracy: number;
  /** Positive = improving compared to first attempt */
  trendDelta: number;
}

export interface FrequentlyMissedQuestion {
  setId: string;
  setTitle: string;
  questionId: string;
  content: string;
  missCount: number;
  totalSeen: number;
}

export function cloneQuestionSet(
  original: QuestionSet,
  newSetId: string,
  makeQuestionId: (index: number) => string,
  suffix = '(Bản sao)'
): QuestionSet {
  const now = new Date().toISOString();
  return {
    ...original,
    id: newSetId,
    title: `${original.title} ${suffix}`.trim(),
    updatedAt: now,
    syncStatus: 'pending',
    questions: original.questions.map((q, idx) => ({
      ...q,
      id: makeQuestionId(idx),
      position: idx,
    })),
  };
}

/**
 * Safely reconciles saved study progress when the underlying question set was edited or trimmed.
 */
export function sanitizeStudyProgress(
  progress: StudyProgress,
  questionSet: QuestionSet
): StudyProgress {
  const validIds = new Set(questionSet.questions.map((q) => q.id));
  const validAnswers = progress.answers.filter((a) => validIds.has(a.questionId));
  const maxIndex = Math.max(0, questionSet.questions.length - 1);
  const clampedIndex = Math.max(0, Math.min(progress.currentIndex, maxIndex));
  const currentQ = questionSet.questions[clampedIndex];
  const maxOpt = currentQ ? currentQ.options.length - 1 : -1;
  const safeSelected =
    progress.selectedIndex !== null &&
    progress.selectedIndex >= 0 &&
    progress.selectedIndex <= maxOpt
      ? progress.selectedIndex
      : null;

  return {
    ...progress,
    currentIndex: clampedIndex,
    selectedIndex: safeSelected,
    revealed: safeSelected !== null ? progress.revealed : false,
    answers: validAnswers,
  };
}

/**
 * Deterministic-friendly Fisher-Yates shuffle helper.
 */
function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Builds the question list for the requested study mode (sequential, shuffled, timed, wrong_only).
 */
export function buildStudyQueue(
  questionSet: QuestionSet,
  mode: StudyMode,
  pastAttempts: Attempt[] = [],
  rng: () => number = Math.random
): { questions: Question[]; missedCount: number } {
  const base = questionSet.questions;
  const missedIds = new Set<string>();
  for (const attempt of pastAttempts) {
    if (attempt.questionSetId !== questionSet.id) continue;
    for (const ans of attempt.answers) {
      if (!ans.isCorrect) missedIds.add(ans.questionId);
    }
  }

  if (mode === 'wrong_only') {
    const onlyMissed = base.filter((q) => missedIds.has(q.id));
    return {
      questions: onlyMissed.length > 0 ? onlyMissed : base,
      missedCount: onlyMissed.length,
    };
  }

  if (mode === 'shuffled') {
    return {
      questions: shuffleArray(base, rng),
      missedCount: missedIds.size,
    };
  }

  return {
    questions: base,
    missedCount: missedIds.size,
  };
}

/**
 * Computes per-set accuracy progression trends and top frequently missed questions across history.
 */
export function computeLibraryAnalytics(
  sets: QuestionSet[],
  attempts: Attempt[]
): {
  perSet: PerSetAnalytics[];
  frequentlyMissed: FrequentlyMissedQuestion[];
} {
  const setById = new Map(sets.map((s) => [s.id, s]));
  const attemptsBySet = new Map<string, Attempt[]>();

  for (const a of attempts) {
    const list = attemptsBySet.get(a.questionSetId) ?? [];
    list.push(a);
    attemptsBySet.set(a.questionSetId, list);
  }

  const perSet: PerSetAnalytics[] = [];
  for (const [setId, list] of attemptsBySet.entries()) {
    const sorted = [...list].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    const pcts = sorted.map((a) => (a.total > 0 ? Math.round((a.correctCount / a.total) * 100) : 0));
    const first = pcts[0] ?? 0;
    const latest = pcts[pcts.length - 1] ?? 0;
    const best = Math.max(...pcts, 0);
    const avg = pcts.length > 0 ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length) : 0;

    perSet.push({
      setId,
      setTitle: setById.get(setId)?.title ?? 'Bộ câu hỏi đã lưu',
      attemptsCount: sorted.length,
      bestAccuracy: best,
      latestAccuracy: latest,
      avgAccuracy: avg,
      trendDelta: latest - first,
    });
  }
  perSet.sort((a, b) => b.attemptsCount - a.attemptsCount);

  const missMap = new Map<string, { setId: string; questionId: string; missCount: number; totalSeen: number }>();
  for (const a of attempts) {
    for (const ans of a.answers) {
      const key = `${a.questionSetId}::${ans.questionId}`;
      const prev = missMap.get(key) ?? {
        setId: a.questionSetId,
        questionId: ans.questionId,
        missCount: 0,
        totalSeen: 0,
      };
      prev.totalSeen += 1;
      if (!ans.isCorrect) prev.missCount += 1;
      missMap.set(key, prev);
    }
  }

  const frequentlyMissed: FrequentlyMissedQuestion[] = [];
  for (const rec of missMap.values()) {
    if (rec.missCount <= 0) continue;
    const set = setById.get(rec.setId);
    const q = set?.questions.find((item) => item.id === rec.questionId);
    if (!set || !q) continue;
    frequentlyMissed.push({
      setId: set.id,
      setTitle: set.title,
      questionId: q.id,
      content: q.content,
      missCount: rec.missCount,
      totalSeen: rec.totalSeen,
    });
  }
  frequentlyMissed.sort((a, b) => b.missCount - a.missCount || b.totalSeen - a.totalSeen);

  return { perSet, frequentlyMissed: frequentlyMissed.slice(0, 8) };
}
