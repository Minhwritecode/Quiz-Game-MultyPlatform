import { TIER_CONFIGS, UserTier } from './models';

describe('Membership Domain Logic', () => {
  it('defines apprentice tier with expected daily limits', () => {
    const config = TIER_CONFIGS.apprentice;
    expect(config.tier).toBe('apprentice');
    expect(config.dailyScanLimit).toBe(3);
    expect(config.dailyBattleCreateLimit).toBe(3);
    expect(config.expMultiplier).toBe(1.0);
    expect(config.hasGoldenAura).toBe(false);
  });

  it('defines archmage VIP tier with unlimited perks', () => {
    const vip = TIER_CONFIGS.archmage;
    expect(vip.tier).toBe('archmage');
    expect(vip.dailyScanLimit).toBeGreaterThan(100);
    expect(vip.dailyBattleCreateLimit).toBeGreaterThan(100);
    expect(vip.expMultiplier).toBe(2.0);
    expect(vip.hasGoldenAura).toBe(true);
    expect(vip.unlimitedSets).toBe(true);
  });

  it('has entries for all defined UserTier variants', () => {
    const tiers: UserTier[] = ['apprentice', 'archmage'];
    tiers.forEach((t) => {
      expect(TIER_CONFIGS[t]).toBeDefined();
      expect(TIER_CONFIGS[t].title).toBeTruthy();
    });
  });
});
