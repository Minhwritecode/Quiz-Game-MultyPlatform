import { getLocalDateString, getDaysDifference, StreakData } from './models';

describe('Streak Domain Logic', () => {
  it('returns valid YYYY-MM-DD local date string', () => {
    const fixedDate = new Date('2026-11-19T10:00:00');
    const str = getLocalDateString(fixedDate);
    expect(str).toBe('2026-11-19');
  });

  it('correctly calculates difference between dates in days', () => {
    expect(getDaysDifference('2026-11-18', '2026-11-19')).toBe(1);
    expect(getDaysDifference('2026-11-01', '2026-11-19')).toBe(18);
    expect(getDaysDifference('2026-11-19', '2026-11-19')).toBe(0);
  });

  it('supports initial streak data structure', () => {
    const sampleStreak: StreakData = {
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: '2026-11-18',
      todayCompleted: false,
      streakFreezeCount: 1,
      status: 'active',
      brokenStreakDays: 0,
      brokenAtDate: null,
      recoveryQuestAvailable: false,
    };

    expect(sampleStreak.currentStreak).toBe(3);
    expect(sampleStreak.status).toBe('active');
  });
});
