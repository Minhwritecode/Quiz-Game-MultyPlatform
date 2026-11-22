import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage, syncUserProgressToCloud } from '@/composition/preferences';
import { UserTier, TIER_CONFIGS, TierPrivileges } from '../domain/models';
import { getLocalDateString } from '@/features/streak/domain/models';

interface MembershipState {
  tier: UserTier;
  dailyScansUsed: number;
  dailyBattlesCreated: number;
  lastResetDate: string;

  getPrivileges: () => TierPrivileges;
  canScan: () => boolean;
  consumeScan: () => boolean;
  canCreateBattle: () => boolean;
  consumeBattle: () => boolean;
  getRemainingScans: () => number;
  getRemainingBattles: () => number;
  upgradeToVip: () => void;
  downgradeToApprentice: () => void;
  toggleTier: () => void;
}

export const useMembershipStore = create<MembershipState>()(
  persist(
    (set, get) => ({
      tier: 'apprentice',
      dailyScansUsed: 0,
      dailyBattlesCreated: 0,
      lastResetDate: getLocalDateString(),

      getPrivileges: () => {
        const state = get();
        return TIER_CONFIGS[state.tier];
      },

      canScan: () => {
        const state = get();
        const today = getLocalDateString();
        if (state.lastResetDate !== today) {
          // Auto reset for new day
          set({ lastResetDate: today, dailyScansUsed: 0, dailyBattlesCreated: 0 });
          return true;
        }
        const config = TIER_CONFIGS[state.tier];
        return state.dailyScansUsed < config.dailyScanLimit;
      },

      consumeScan: () => {
        const state = get();
        if (!state.canScan()) return false;
        set((prev) => ({ dailyScansUsed: prev.dailyScansUsed + 1 }));
        return true;
      },

      canCreateBattle: () => {
        const state = get();
        const today = getLocalDateString();
        if (state.lastResetDate !== today) {
          set({ lastResetDate: today, dailyScansUsed: 0, dailyBattlesCreated: 0 });
          return true;
        }
        const config = TIER_CONFIGS[state.tier];
        return state.dailyBattlesCreated < config.dailyBattleCreateLimit;
      },

      consumeBattle: () => {
        const state = get();
        if (!state.canCreateBattle()) return false;
        set((prev) => ({ dailyBattlesCreated: prev.dailyBattlesCreated + 1 }));
        return true;
      },

      getRemainingScans: () => {
        const state = get();
        const today = getLocalDateString();
        const used = state.lastResetDate === today ? state.dailyScansUsed : 0;
        const config = TIER_CONFIGS[state.tier];
        return Math.max(0, config.dailyScanLimit - used);
      },

      getRemainingBattles: () => {
        const state = get();
        const today = getLocalDateString();
        const used = state.lastResetDate === today ? state.dailyBattlesCreated : 0;
        const config = TIER_CONFIGS[state.tier];
        return Math.max(0, config.dailyBattleCreateLimit - used);
      },

      upgradeToVip: () => {
        set({ tier: 'archmage' });
        void syncUserProgressToCloud({ membershipTier: 'archmage' });
      },

      downgradeToApprentice: () => {
        set({ tier: 'apprentice' });
        void syncUserProgressToCloud({ membershipTier: 'apprentice' });
      },

      toggleTier: () => {
        set((prev) => {
          const next = prev.tier === 'apprentice' ? 'archmage' : 'apprentice';
          void syncUserProgressToCloud({ membershipTier: next });
          return { tier: next };
        });
      },
    }),
    {
      name: 'papyrus.membership',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
