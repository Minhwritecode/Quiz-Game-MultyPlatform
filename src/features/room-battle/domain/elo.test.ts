import { applyEloFloor, computeNextElo, ELO_FLOOR, eloDelta, eloSearchBand, getEloTier, kFactor, pickTieredBot } from './elo';

describe('ELO rating system', () => {
  it('uses higher provisional K-factor for first 10 matches', () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(24);
    expect(kFactor(50)).toBe(24);
  });

  it('computes symmetric delta for equal ratings', () => {
    expect(eloDelta(1200, 1200, 1, 40)).toBe(20);
    expect(eloDelta(1200, 1200, 0, 40)).toBe(-20);
    expect(eloDelta(1200, 1200, 0.5, 40)).toBe(0);
  });

  it('never drops below ELO_FLOOR', () => {
    expect(applyEloFloor(50)).toBe(ELO_FLOOR);
    const result = computeNextElo(105, 1600, 0, 2);
    expect(result.nextRating).toBeGreaterThanOrEqual(ELO_FLOOR);
  });

  it('maps ratings to the expected tier', () => {
    expect(getEloTier(950).id).toBe('bronze');
    expect(getEloTier(1200).id).toBe('silver');
    expect(getEloTier(1300).id).toBe('gold');
    expect(getEloTier(1450).id).toBe('platinum');
    expect(getEloTier(1650).id).toBe('diamond');
    expect(getEloTier(1900).id).toBe('archmage');
  });

  it('widens ELO search band over wait time and mirrors bot ELO', () => {
    expect(eloSearchBand(0)).toBe(100);
    expect(eloSearchBand(8)).toBe(300);
    expect(eloSearchBand(60)).toBe(500);
    const bot = pickTieredBot(1300);
    expect(Math.abs(bot.elo - 1300)).toBeLessThanOrEqual(75);
  });
});
