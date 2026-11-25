import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  fetchCloudProfileSnapshot,
  preferenceStorage,
  syncUserProgressToCloud,
} from '@/composition/preferences';
import {
  StreakData,
  StreakActivityType,
  getLocalDateString,
  getDaysDifference,
} from '../domain/models';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';

export interface PerUserStreakSlice extends StreakData {
  historyDates: string[];
}

const DEFAULT_STREAK_SLICE: PerUserStreakSlice = {
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
};

function extractSlice(state: StreakState): PerUserStreakSlice {
  return {
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastActiveDate: state.lastActiveDate,
    todayCompleted: state.todayCompleted,
    streakFreezeCount: state.streakFreezeCount,
    status: state.status,
    brokenStreakDays: state.brokenStreakDays,
    brokenAtDate: state.brokenAtDate,
    recoveryQuestAvailable: state.recoveryQuestAvailable,
    lastFreezeGrantDate: state.lastFreezeGrantDate,
    historyDates: state.historyDates,
  };
}

interface StreakState extends PerUserStreakSlice {
  activeUserId: string;
  byUser: Record<string, PerUserStreakSlice>;
  switchAccountScope: (userId: string) => void;
  hydrateFromCloud: () => Promise<void>;
  refreshStreakStatus: () => void;
  recordActivity: (type: StreakActivityType) => { streakUpdated: boolean; newStreak: number };
  checkInToday: () => { streakUpdated: boolean; newStreak: number };
  recoverStreakWithQuest: () => boolean;
  addStreakFreeze: (amount?: number) => void;
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      activeUserId: 'guest',
      byUser: {},
      ...DEFAULT_STREAK_SLICE,

      switchAccountScope: (nextUserId: string) => {
        const cleanId = nextUserId || 'guest';
        const state = get();
        if (state.activeUserId === cleanId) {
          get().refreshStreakStatus();
          return;
        }
        const updatedMap = {
          ...state.byUser,
          [state.activeUserId]: extractSlice(state),
        };
        const target = updatedMap[cleanId] ?? DEFAULT_STREAK_SLICE;
        set({
          activeUserId: cleanId,
          byUser: updatedMap,
          ...target,
        });
        get().refreshStreakStatus();
      },

      hydrateFromCloud: async () => {
        const state = get();
        if (state.activeUserId === 'guest') return;
        const snap = await fetchCloudProfileSnapshot();
        if (!snap) return;
        const today = getLocalDateString();
        set((prev) => {
          const mergedDates = Array.from(
            new Set([...(prev.historyDates ?? []), ...(snap.historyDates ?? [])])
          ).slice(0, 35);
          const mergedLast =
            prev.lastActiveDate && snap.lastActiveDate
              ? prev.lastActiveDate >= snap.lastActiveDate
                ? prev.lastActiveDate
                : snap.lastActiveDate
              : prev.lastActiveDate || snap.lastActiveDate;
          const mergedCurrent = Math.max(prev.currentStreak, snap.currentStreak);
          const mergedLongest = Math.max(prev.longestStreak, snap.longestStreak, mergedCurrent);
          const nextSlice: PerUserStreakSlice = {
            ...extractSlice(prev),
            currentStreak: mergedCurrent,
            longestStreak: mergedLongest,
            streakFreezeCount: Math.max(prev.streakFreezeCount, snap.streakFreezeCount),
            lastActiveDate: mergedLast,
            todayCompleted: mergedLast === today,
            status: mergedLast === today ? 'active' : prev.status,
            historyDates: mergedDates,
          };
          return {
            ...nextSlice,
            byUser: {
              ...prev.byUser,
              [prev.activeUserId]: nextSlice,
            },
          };
        });
      },

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
          set((prev) => {
            const nextSlice = { ...extractSlice(prev), status: 'at_risk' as const, todayCompleted: false };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
          return;
        }

        if (state.lastActiveDate === today) {
          set((prev) => {
            const nextSlice = { ...extractSlice(prev), todayCompleted: true, status: 'active' as const };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
          return;
        }

        const diff = getDaysDifference(state.lastActiveDate, today);

        if (diff === 1) {
          set((prev) => {
            const nextSlice = { ...extractSlice(prev), todayCompleted: false, status: 'at_risk' as const };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
        } else if (diff === 2 && state.streakFreezeCount > 0) {
          set((prev) => {
            const nextSlice = {
              ...extractSlice(prev),
              streakFreezeCount: Math.max(0, prev.streakFreezeCount - 1),
              status: 'frozen' as const,
              todayCompleted: false,
            };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
        } else if (diff >= 2) {
          const brokenDays = state.currentStreak;
          set((prev) => {
            const nextSlice = {
              ...extractSlice(prev),
              brokenStreakDays: brokenDays,
              brokenAtDate: today,
              currentStreak: 0,
              status: 'broken' as const,
              todayCompleted: false,
              recoveryQuestAvailable: brokenDays > 0,
            };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
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
        const nextHistory = Array.from(new Set([today, ...(state.historyDates ?? [])])).slice(0, 35);

        const nextSlice: PerUserStreakSlice = {
          ...extractSlice(state),
          currentStreak: newStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          recoveryQuestAvailable: false,
          historyDates: nextHistory,
        };

        set((prev) => ({
          ...nextSlice,
          byUser: {
            ...prev.byUser,
            [prev.activeUserId]: nextSlice,
          },
        }));

        if (state.activeUserId !== 'guest') {
          void syncUserProgressToCloud({
            currentStreak: newStreak,
            longestStreak: longest,
            streakFreezeCount: state.streakFreezeCount,
            lastActiveDate: today,
            historyDates: nextHistory,
          });
        }

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
        const nextHistory = Array.from(new Set([today, ...(state.historyDates ?? [])])).slice(0, 35);

        const nextSlice: PerUserStreakSlice = {
          ...extractSlice(state),
          currentStreak: restoredStreak,
          longestStreak: longest,
          lastActiveDate: today,
          todayCompleted: true,
          status: 'active',
          brokenStreakDays: 0,
          brokenAtDate: null,
          recoveryQuestAvailable: false,
          historyDates: nextHistory,
        };

        set((prev) => ({
          ...nextSlice,
          byUser: {
            ...prev.byUser,
            [prev.activeUserId]: nextSlice,
          },
        }));

        if (state.activeUserId !== 'guest') {
          void syncUserProgressToCloud({
            currentStreak: restoredStreak,
            longestStreak: longest,
            lastActiveDate: today,
            historyDates: nextHistory,
          });
        }

        return true;
      },

      addStreakFreeze: (amount = 1) => {
        set((prev) => {
          const nextCount = Math.min(5, prev.streakFreezeCount + amount);
          const nextSlice = { ...extractSlice(prev), streakFreezeCount: nextCount };
          return {
            streakFreezeCount: nextCount,
            byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
          };
        });
      },
    }),
    {
      name: 'papyrus.streak.v3',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
