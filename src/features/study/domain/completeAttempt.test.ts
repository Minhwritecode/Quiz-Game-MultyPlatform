import { completeAttempt } from './completeAttempt';

describe('completeAttempt', () => {
  it('builds a persisted result from answer records', () => {
    const result = completeAttempt({
      id: 'attempt-1',
      questionSetId: 'set-1',
      startedAt: '2026-11-10T00:00:00.000Z',
      answers: [
        { questionId: 'q-1', chosenIndex: 0, isCorrect: true, timeMs: 500 },
        { questionId: 'q-2', chosenIndex: 2, isCorrect: false, timeMs: 900 },
      ],
    });

    expect(result).toMatchObject({ score: 1, correctCount: 1, total: 2, status: 'completed' });
  });
});
