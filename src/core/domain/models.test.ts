import { calculateSpeedScore, isValidQuestion } from './models';

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
});
