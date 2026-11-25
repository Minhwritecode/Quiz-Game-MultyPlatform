import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  fetchCloudProfileSnapshot,
  preferenceStorage,
  syncUserProgressToCloud,
} from '@/composition/preferences';
import { UserTier, TIER_CONFIGS, TierPrivileges } from '../domain/models';
import { getLocalDateString } from '@/features/streak/domain/models';

interface PerUserMembershipSlice {
  tier: UserTier;
  dailyScansUsed: number;
  dailyBattlesCreated: number;
  lastResetDate: string;
}

const defaultMembershipSlice = (): PerUserMembershipSlice => ({
  tier: 'apprentice',
  dailyScansUsed: 0,
  dailyBattlesCreated: 0,
  lastResetDate: getLocalDateString(),
});

interface MembershipState extends PerUserMembershipSlice {
  activeUserId: string;
  byUser: Record<string, PerUserMembershipSlice>;
  switchAccountScope: (userId: string) => void;
  hydrateFromCloud: () => Promise<void>;
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
      activeUserId: 'guest',
      byUser: {},
      ...defaultMembershipSlice(),

      switchAccountScope: (nextUserId: string) => {
        const cleanId = nextUserId || 'guest';
        const state = get();
        if (state.activeUserId === cleanId) return;
        const currentSlice: PerUserMembershipSlice = {
          tier: state.tier,
          dailyScansUsed: state.dailyScansUsed,
          dailyBattlesCreated: state.dailyBattlesCreated,
          lastResetDate: state.lastResetDate,
        };
        const updatedMap = {
          ...state.byUser,
          [state.activeUserId]: currentSlice,
        };
        const target = updatedMap[cleanId] ?? defaultMembershipSlice();
        set({
          activeUserId: cleanId,
          byUser: updatedMap,
          ...target,
        });
      },

      hydrateFromCloud: async () => {
        const state = get();
        if (state.activeUserId === 'guest') return;
        const snap = await fetchCloudProfileSnapshot();
        if (!snap) return;
        set((prev) => {
          const nextSlice: PerUserMembershipSlice = {
            tier: snap.membershipTier,
            dailyScansUsed: prev.dailyScansUsed,
            dailyBattlesCreated: prev.dailyBattlesCreated,
            lastResetDate: prev.lastResetDate,
          };
          return {
            tier: snap.membershipTier,
            byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
          };
        });
      },

      getPrivileges: () => {
        const state = get();
        return TIER_CONFIGS[state.tier];
      },

      canScan: () => {
        const state = get();
        const today = getLocalDateString();
        if (state.lastResetDate !== today) {
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
        set((prev) => {
          const nextSlice: PerUserMembershipSlice = {
            tier: 'archmage',
            dailyScansUsed: prev.dailyScansUsed,
            dailyBattlesCreated: prev.dailyBattlesCreated,
            lastResetDate: prev.lastResetDate,
          };
          if (prev.activeUserId !== 'guest') {
            void syncUserProgressToCloud({ membershipTier: 'archmage' });
          }
          return {
            tier: 'archmage',
            byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
          };
        });
      },

      downgradeToApprentice: () => {
        set((prev) => {
          const nextSlice: PerUserMembershipSlice = {
            tier: 'apprentice',
            dailyScansUsed: prev.dailyScansUsed,
            dailyBattlesCreated: prev.dailyBattlesCreated,
            lastResetDate: prev.lastResetDate,
          };
          if (prev.activeUserId !== 'guest') {
            void syncUserProgressToCloud({ membershipTier: 'apprentice' });
          }
          return {
            tier: 'apprentice',
            byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
          };
        });
      },

      toggleTier: () => {
        set((prev) => {
          const next = prev.tier === 'apprentice' ? 'archmage' : 'apprentice';
          const nextSlice: PerUserMembershipSlice = {
            tier: next,
            dailyScansUsed: prev.dailyScansUsed,
            dailyBattlesCreated: prev.dailyBattlesCreated,
            lastResetDate: prev.lastResetDate,
          };
          if (prev.activeUserId !== 'guest') {
            void syncUserProgressToCloud({ membershipTier: next });
          }
          return {
            tier: next,
            byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
          };
        });
      },
    }),
    {
      name: 'papyrus.membership.v2',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
