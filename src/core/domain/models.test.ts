import { calculateSpeedScore, calculateTieredSpeedScore, isValidQuestion } from './models';

describe('Papyrus domain rules', () => {
  it('requires exactly four distinct answer options', () => {
    expect(isValidQuestion({ id: 'q', content: 'A question', options: ['A', 'B', 'C', 'D'], correctIndex: 1, explanation: '', position: 0 })).toBe(true);
    expect(isValidQuestion({ id: 'q', content: 'A question', options: ['A', 'B', 'B', 'D'], correctIndex: 1, explanation: '', position: 0 })).toBe(false);
  });

  it('keeps speed scoring server-compatible', () => {
    expect(calculateSpeedScore(true, 50_000)).toBe(1500);
    expect(calculateSpeedScore(true, 1_200)).toBe(1012);
    expect(calculateSpeedScore(false, 50_000)).toBe(0);
  });

  it('computes 10-tier competitive speed bonus', () => {
    // Fast (<5% of 15s = elapsed < 750ms -> remaining > 14250)
    expect(calculateTieredSpeedScore(true, 14_500, 15_000)).toBe(1500);
    // Moderate (~35% elapsed -> remaining ~9750)
    expect(calculateTieredSpeedScore(true, 9_500, 15_000)).toBe(1220);
    // Incorrect -> 0
    expect(calculateTieredSpeedScore(false, 14_500, 15_000)).toBe(0);
  });
});
