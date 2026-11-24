import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage, syncUserProgressToCloud } from '@/composition/preferences';
import {
  StreakData,
  StreakActivityType,
  getLocalDateString,
  getDaysDifference,
} from '../domain/models';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';

interface StreakState extends StreakData {
  historyDates: string[];
  refreshStreakStatus: () => void;
  recordActivity: (type: StreakActivityType) => { streakUpdated: boolean; newStreak: number };
  checkInToday: () => { streakUpdated: boolean; newStreak: number };
  recoverStreakWithQuest: () => boolean;
  addStreakFreeze: (amount?: number) => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      todayCompleted: false,
      streakFreezeCount: 1,
      status: 'at_risk',
      brokenStreakDays: 0,
      brokenAtDate: null,
      recoveryQuestAvailable: false,
      lastFreezeGrantDate: null,
      historyDates: [],

      refreshStreakStatus: () => {
        const state = get();
        const today = getLocalDateString();

        const isVip = useMembershipStore.getState().tier === 'archmage';
        if (isVip) {
          const lastGrant = state.lastFreezeGrantDate;
          const daysSinceGrant = lastGrant ? getDaysDifference(lastGrant, today) : 999;
          if (daysSinceGrant >= 7 && state.streakFreezeCount < 5) {
            set((prev) => ({
              streakFreezeCount: Math.min(5, prev.streakFreezeCount + 2),
              lastFreezeGrantDate: today,
            }));
          }
        }

        if (!state.lastActiveDate) {
          set({
            status: 'at_risk',
            todayCompleted: false,
          });
          return;
        }

        if (state.lastActiveDate === today) {
          set({ todayCompleted: true, status: 'active' });
          return;
        }

        const diff = getDaysDifference(state.lastActiveDate, today);

        if (diff === 1) {
          set({ todayCompleted: false, status: 'at_risk' });
        } else if (diff === 2 && state.streakFreezeCount > 0) {
          set((prev) => ({
            streakFreezeCount: Math.max(0, prev.streakFreezeCount - 1),
            status: 'frozen',
            todayCompleted: false,
          }));
        } else if (diff >= 2) {
          const brokenDays = state.currentStreak;
          set({
            brokenStreakDays: brokenDays,
            brokenAtDate: today,
            currentStreak: 0,
            status: 'broken',
            todayCompleted: false,
            recoveryQuestAvailable: brokenDays > 0,
          });
        }
      },

      recordActivity: (_type: StreakActivityType) => {
        const today = getLocalDateString();
        const state = get();

        if (state.todayCompleted && state.lastActiveDate === today) {
          return { streakUpdated: false, newStreak: state.currentStreak };
        }

        let newStreak = state.currentStreak;
        if (!state.lastActiveDate) {
          newStreak = 1;
        } else {
          const diff = getDaysDifference(state.lastActiveDate, today);
          if (diff <= 1 || state.status === 'frozen') {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }

        const longest = Math.max(state.longestStreak, newStreak);
        const nextHistory = Array.from(new Set([today, ...(state.historyDates ?? [])])).slice(0, 30);

        set({
          currentStreak: newStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          recoveryQuestAvailable: false,
          historyDates: nextHistory,
        });

        void syncUserProgressToCloud({
          currentStreak: newStreak,
          longestStreak: longest,
          streakFreezeCount: state.streakFreezeCount,
          lastActiveDate: today,
        });

        return { streakUpdated: true, newStreak };
      },

      checkInToday: () => {
        return get().recordActivity('daily_checkin');
      },

      recoverStreakWithQuest: () => {
        const state = get();
        const today = getLocalDateString();
        if (state.brokenStreakDays <= 0) return false;

        const restoredStreak = state.brokenStreakDays + 1;
        const longest = Math.max(state.longestStreak, restoredStreak);
        const nextHistory = Array.from(new Set([today, ...(state.historyDates ?? [])])).slice(0, 30);

        set({
          currentStreak: restoredStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          brokenAtDate: null,
          recoveryQuestAvailable: false,
          historyDates: nextHistory,
        });

        return true;
      },

      addStreakFreeze: (amount = 1) => {
        set((prev) => ({
          streakFreezeCount: Math.min(5, prev.streakFreezeCount + amount),
        }));
      },
    }),
    {
      name: 'papyrus.streak.v2',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
