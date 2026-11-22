import { preferenceStorage } from '@/features/preferences/data/storage';
import {
  type OnboardingRepository,
  onboardingStorageKey,
} from '../domain/onboardingState';

export const onboardingRepository: OnboardingRepository = {
  async hasSeenIntro(userId: string): Promise<boolean> {
    if (!userId.trim()) return true;
    try {
      const value = await preferenceStorage.getItem(onboardingStorageKey(userId));
      return value === '1';
    } catch {
      return false;
    }
  },

  async markIntroSeen(userId: string): Promise<void> {
    if (!userId.trim()) return;
    try {
      await preferenceStorage.setItem(onboardingStorageKey(userId), '1');
    } catch {
      // Ignore storage quota errors safely; never block navigation.
    }
  },

  async resetIntroSeen(userId: string): Promise<void> {
    if (!userId.trim()) return;
    try {
      await preferenceStorage.removeItem(onboardingStorageKey(userId));
    } catch {
      // Ignore storage removal errors safely.
    }
  },
};
