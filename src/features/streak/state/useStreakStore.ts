import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StreakData,
  StreakActivityType,
  getLocalDateString,
  getDaysDifference,
} from '../domain/models';

interface StreakState extends StreakData {
  refreshStreakStatus: () => void;
  recordActivity: (type: StreakActivityType) => { streakUpdated: boolean; newStreak: number };
  recoverStreakWithQuest: () => boolean;
  addStreakFreeze: (amount?: number) => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: null,
      todayCompleted: false,
      streakFreezeCount: 1,
      status: 'active',
      brokenStreakDays: 0,
      brokenAtDate: null,
      recoveryQuestAvailable: false,

      refreshStreakStatus: () => {
        const state = get();
        const today = getLocalDateString();

        if (!state.lastActiveDate) {
          set({
            status: state.currentStreak > 0 ? 'at_risk' : 'broken',
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
          // Yesterday was active, today is at risk
          set({ todayCompleted: false, status: 'at_risk' });
        } else if (diff === 2 && state.streakFreezeCount > 0) {
          // Missed 1 day, but saved by Streak Freeze!
          set((prev) => ({
            streakFreezeCount: Math.max(0, prev.streakFreezeCount - 1),
            status: 'frozen',
            todayCompleted: false,
          }));
        } else if (diff >= 2) {
          // Streak broken
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
            // Fresh streak restart
            newStreak = 1;
          }
        }

        const longest = Math.max(state.longestStreak, newStreak);

        set({
          currentStreak: newStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          recoveryQuestAvailable: false,
        });

        return { streakUpdated: true, newStreak };
      },

      recoverStreakWithQuest: () => {
        const state = get();
        const today = getLocalDateString();
        if (state.brokenStreakDays <= 0) return false;

        const restoredStreak = state.brokenStreakDays + 1;
        const longest = Math.max(state.longestStreak, restoredStreak);

        set({
          currentStreak: restoredStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          brokenAtDate: null,
          recoveryQuestAvailable: false,
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
      name: 'papyrus.streak',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
