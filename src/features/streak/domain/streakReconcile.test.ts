import { reconcileStreakWithHistory } from './models';
import { useStreakStore } from '../state/useStreakStore';

jest.mock('@/composition/preferences', () => ({
  fetchCloudProfileSnapshot: jest.fn().mockResolvedValue(null),
  syncUserProgressToCloud: jest.fn().mockResolvedValue(true),
  preferenceStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Streak Calendar & Counter Synchronization', () => {
  it('reconciles consecutive lit days (e.g. T3..T6 = 4 days) accurately with currentStreak', () => {
    const today = '2026-11-27';
    const history = ['2026-11-27', '2026-11-26', '2026-11-25', '2026-11-24'];
    const result = reconcileStreakWithHistory(history, today);
    expect(result.consecutiveDays).toBe(4);
    expect(result.longestInHistory).toBe(4);
    expect(result.latestDate).toBe('2026-11-27');
  });

  it('auto-corrects out-of-sync currentStreak (3 -> 4) on refreshStreakStatus', () => {
    const now = new Date();
    const fmt = (delta: number) => {
      const d = new Date(now);
      d.setDate(now.getDate() + delta);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const d0 = fmt(0);
    const d1 = fmt(-1);
    const d2 = fmt(-2);
    const d3 = fmt(-3);

    useStreakStore.setState({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: d0,
      todayCompleted: true,
      status: 'active',
      historyDates: [d0, d1, d2, d3],
    });

    useStreakStore.getState().refreshStreakStatus();
    expect(useStreakStore.getState().currentStreak).toBe(4);
  });
});
