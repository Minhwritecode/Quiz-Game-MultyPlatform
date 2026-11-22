import {
  ONBOARDING_ACT_SLIDES,
  onboardingStorageKey,
  resolveOnboardingActIndex,
  shouldAutoShowOnboarding,
} from './onboardingState';

describe('onboardingState (First-Time Optical Illusion Intro)', () => {
  it('scopes onboarding persistence keys cleanly per userId', () => {
    expect(onboardingStorageKey('user-123')).toBe('papyrus:onboarding:illusion-intro:v1:user-123');
    expect(onboardingStorageKey('  user-abc  ')).toBe('papyrus:onboarding:illusion-intro:v1:user-abc');
    expect(onboardingStorageKey('')).toBe('papyrus:onboarding:illusion-intro:v1:guest');
  });

  it('auto-triggers only for newly signed-in users who have not seen the intro', () => {
    expect(shouldAutoShowOnboarding({ userId: 'u-1', hasSeen: false, isTestEnv: false })).toBe(true);
    expect(shouldAutoShowOnboarding({ userId: 'u-1', hasSeen: true, isTestEnv: false })).toBe(false);
    expect(shouldAutoShowOnboarding({ userId: null, hasSeen: false, isTestEnv: false })).toBe(false);
    expect(shouldAutoShowOnboarding({ userId: '   ', hasSeen: false, isTestEnv: false })).toBe(false);
    expect(shouldAutoShowOnboarding({ userId: 'u-1', hasSeen: false, isTestEnv: true })).toBe(false);
  });

  it('maps playback timestamps to the 3 Pain Point -> Solution -> Payoff acts', () => {
    expect(ONBOARDING_ACT_SLIDES).toHaveLength(3);
    expect(resolveOnboardingActIndex(0)).toBe(0);
    expect(resolveOnboardingActIndex(2.9)).toBe(0);
    expect(resolveOnboardingActIndex(3.0)).toBe(1);
    expect(resolveOnboardingActIndex(6.7)).toBe(1);
    expect(resolveOnboardingActIndex(6.8)).toBe(2);
    expect(resolveOnboardingActIndex(9.5)).toBe(2);
  });
});
