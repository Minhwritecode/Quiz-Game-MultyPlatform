import { buildLeaderboardCsv, buildStudySessionReport, formatMsSeconds } from './sessionReport';
import type { Attempt } from '@/core/domain/models';

describe('Session analytics report builder', () => {
  it('computes accuracy, average time, and fastest correct time', () => {
    const attempt: Attempt = {
      id: 'att-1',
      questionSetId: 'set-1',
      score: 240,
      correctCount: 2,
      total: 3,
      status: 'completed',
      startedAt: '2026-11-21T00:00:00Z',
      finishedAt: '2026-11-21T00:00:12Z',
      answers: [
        { questionId: 'q1', chosenIndex: 0, isCorrect: true, timeMs: 2500 },
        { questionId: 'q2', chosenIndex: 1, isCorrect: false, timeMs: 6500 },
        { questionId: 'q3', chosenIndex: 2, isCorrect: true, timeMs: 3000 },
      ],
    };
    const report = buildStudySessionReport(attempt, 'Lịch sử');
    expect(report.accuracyPercent).toBe(67);
    expect(report.avgTimeMs).toBe(4000);
    expect(report.fastestCorrectMs).toBe(2500);
    expect(formatMsSeconds(report.fastestCorrectMs)).toBe('2.5s');
  });

  it('builds CSV export for multiplayer leaderboard', () => {
    const csv = buildLeaderboardCsv('ABC123', [
      { nickname: 'Minh', score: 1500 },
      { nickname: 'Lan', score: 1200 },
    ]);
    expect(csv).toContain('"1","Minh","1500","ABC123"');
    expect(csv).toContain('"2","Lan","1200","ABC123"');
  });
});
