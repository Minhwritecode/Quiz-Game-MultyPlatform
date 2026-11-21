import type { Attempt, QuestionSet, StudyProgress } from '@/core/domain/models';
import {
  buildStudyQueue,
  cloneQuestionSet,
  computeLibraryAnalytics,
  sanitizeStudyProgress,
} from './setAnalytics';

const sampleSet: QuestionSet = {
  id: 'set-1',
  title: 'Giải tích 1',
  subject: 'Toán',
  updatedAt: '2026-11-20T00:00:00Z',
  syncStatus: 'synced',
  questions: [
    { id: 'q1', content: 'Đạo hàm của x^2?', options: ['x', '2x', 'x^2', '2'], correctIndex: 1, explanation: '2x', position: 0 },
    { id: 'q2', content: 'Giới hạn sin(x)/x khi x->0?', options: ['0', '1', '∞', '-1'], correctIndex: 1, explanation: '1', position: 1 },
    { id: 'q3', content: 'Nguyên hàm của 1/x?', options: ['ln|x|', 'x', '1/x^2', 'e^x'], correctIndex: 0, explanation: 'ln|x|', position: 2 },
  ],
};

const sampleAttempts: Attempt[] = [
  {
    id: 'att-1',
    questionSetId: 'set-1',
    score: 1,
    correctCount: 1,
    total: 3,
    startedAt: '2026-11-20T08:00:00Z',
    finishedAt: '2026-11-20T08:02:00Z',
    status: 'completed',
    answers: [
      { questionId: 'q1', chosenIndex: 1, isCorrect: true, timeMs: 1200 },
      { questionId: 'q2', chosenIndex: 0, isCorrect: false, timeMs: 2500 },
      { questionId: 'q3', chosenIndex: 2, isCorrect: false, timeMs: 3000 },
    ],
  },
  {
    id: 'att-2',
    questionSetId: 'set-1',
    score: 2,
    correctCount: 2,
    total: 3,
    startedAt: '2026-11-21T08:00:00Z',
    finishedAt: '2026-11-21T08:02:00Z',
    status: 'completed',
    answers: [
      { questionId: 'q1', chosenIndex: 1, isCorrect: true, timeMs: 1000 },
      { questionId: 'q2', chosenIndex: 0, isCorrect: false, timeMs: 2000 },
      { questionId: 'q3', chosenIndex: 0, isCorrect: true, timeMs: 1500 },
    ],
  },
];

describe('setAnalytics & study modes', () => {
  it('clones a question set with fresh IDs and pending sync status', () => {
    const cloned = cloneQuestionSet(sampleSet, 'set-clone', (i) => `clone-q-${i}`);
    expect(cloned.id).toBe('set-clone');
    expect(cloned.title).toContain('(Bản sao)');
    expect(cloned.syncStatus).toBe('pending');
    expect(cloned.questions.map((q) => q.id)).toEqual(['clone-q-0', 'clone-q-1', 'clone-q-2']);
  });

  it('sanitizes stale study progress when a set is edited or shortened', () => {
    const stale: StudyProgress = {
      questionSetId: 'set-1',
      currentIndex: 9,
      selectedIndex: 5,
      revealed: true,
      answers: [
        { questionId: 'q1', chosenIndex: 1, isCorrect: true, timeMs: 1000 },
        { questionId: 'deleted-q', chosenIndex: 0, isCorrect: false, timeMs: 500 },
      ],
      startedAt: '2026-11-20T00:00:00Z',
      updatedAt: '2026-11-20T00:01:00Z',
    };
    const cleaned = sanitizeStudyProgress(stale, sampleSet);
    expect(cleaned.currentIndex).toBe(2);
    expect(cleaned.selectedIndex).toBeNull();
    expect(cleaned.revealed).toBe(false);
    expect(cleaned.answers).toHaveLength(1);
  });

  it('builds wrong_only and shuffled study queues accurately', () => {
    const wrongQueue = buildStudyQueue(sampleSet, 'wrong_only', sampleAttempts);
    expect(wrongQueue.missedCount).toBe(2);
    expect(wrongQueue.questions.map((q) => q.id)).toEqual(['q2', 'q3']);

    const shuffled = buildStudyQueue(sampleSet, 'shuffled', [], () => 0);
    expect(shuffled.questions).toHaveLength(3);
  });

  it('computes per-set progress trends and ranks frequently missed questions', () => {
    const analytics = computeLibraryAnalytics([sampleSet], sampleAttempts);
    expect(analytics.perSet[0]?.attemptsCount).toBe(2);
    expect(analytics.perSet[0]?.bestAccuracy).toBe(67);
    expect(analytics.perSet[0]?.trendDelta).toBe(34);
    expect(analytics.frequentlyMissed[0]?.questionId).toBe('q2');
    expect(analytics.frequentlyMissed[0]?.missCount).toBe(2);
  });
});
