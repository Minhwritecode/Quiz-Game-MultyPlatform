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
  reconcileStreakWithHistory,
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
          const mergedLast =
            prev.lastActiveDate && snap.lastActiveDate
              ? prev.lastActiveDate >= snap.lastActiveDate
                ? prev.lastActiveDate
                : snap.lastActiveDate
              : prev.lastActiveDate || snap.lastActiveDate;
          const fallbackBaseStreak = Math.max(prev.currentStreak, snap.currentStreak);
          const combinedRawDates = [...(prev.historyDates ?? []), ...(snap.historyDates ?? [])];
          const reconciled = reconcileStreakWithHistory(combinedRawDates, today, {
            allowFrozenGap: prev.status === 'frozen',
            fallbackLastActiveDate: mergedLast,
            fallbackCurrentStreak: fallbackBaseStreak,
          });
          const effectiveLast = reconciled.latestDate ?? mergedLast;
          const mergedCurrent =
            prev.status === 'broken'
              ? 0
              : reconciled.normalizedDates.length > 0 && prev.status !== 'frozen'
              ? reconciled.consecutiveDays
              : Math.max(fallbackBaseStreak, reconciled.consecutiveDays);
          const mergedLongest = Math.max(
            prev.longestStreak,
            snap.longestStreak,
            mergedCurrent,
            reconciled.longestInHistory
          );
          const nextSlice: PerUserStreakSlice = {
            ...extractSlice(prev),
            currentStreak: mergedCurrent,
            longestStreak: mergedLongest,
            streakFreezeCount: Math.max(prev.streakFreezeCount, snap.streakFreezeCount),
            lastActiveDate: effectiveLast,
            todayCompleted: effectiveLast === today,
            status: effectiveLast === today ? 'active' : prev.status,
            historyDates: reconciled.normalizedDates.slice(0, 35),
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

        const reconciled = reconcileStreakWithHistory(state.historyDates, today, {
          allowFrozenGap: state.status === 'frozen',
          fallbackLastActiveDate: state.lastActiveDate,
          fallbackCurrentStreak: state.currentStreak,
        });
        const effectiveLast = reconciled.latestDate ?? state.lastActiveDate;

        if (!effectiveLast) {
          set((prev) => {
            const nextSlice = {
              ...extractSlice(prev),
              currentStreak: 0,
              status: 'at_risk' as const,
              todayCompleted: false,
            };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
          return;
        }

        if (effectiveLast === today) {
          set((prev) => {
            const syncedCurrent =
              reconciled.normalizedDates.length > 0 && prev.status !== 'frozen'
                ? Math.max(1, reconciled.consecutiveDays)
                : Math.max(1, prev.currentStreak);
            const syncedLongest = Math.max(
              prev.longestStreak,
              syncedCurrent,
              reconciled.longestInHistory
            );
            const nextSlice = {
              ...extractSlice(prev),
              lastActiveDate: effectiveLast,
              currentStreak: syncedCurrent,
              longestStreak: syncedLongest,
              historyDates: reconciled.normalizedDates.slice(0, 35),
              todayCompleted: true,
              status: 'active' as const,
            };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
          return;
        }

        const diff = getDaysDifference(effectiveLast, today);

        if (diff === 1) {
          set((prev) => {
            const syncedCurrent =
              reconciled.normalizedDates.length > 0
                ? reconciled.consecutiveDays
                : prev.currentStreak;
            const syncedLongest = Math.max(
              prev.longestStreak,
              syncedCurrent,
              reconciled.longestInHistory
            );
            const nextSlice = {
              ...extractSlice(prev),
              lastActiveDate: effectiveLast,
              currentStreak: syncedCurrent,
              longestStreak: syncedLongest,
              historyDates: reconciled.normalizedDates.slice(0, 35),
              todayCompleted: false,
              status: 'at_risk' as const,
            };
            return {
              ...nextSlice,
              byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
            };
          });
        } else if (diff === 2 && state.streakFreezeCount > 0) {
          set((prev) => {
            const frozenReconciled = reconcileStreakWithHistory(prev.historyDates, today, {
              allowFrozenGap: true,
              fallbackLastActiveDate: effectiveLast,
              fallbackCurrentStreak: prev.currentStreak,
            });
            const nextSlice = {
              ...extractSlice(prev),
              lastActiveDate: effectiveLast,
              currentStreak: Math.max(prev.currentStreak, frozenReconciled.consecutiveDays),
              historyDates: frozenReconciled.normalizedDates.slice(0, 35),
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
          const brokenDays = Math.max(state.currentStreak, reconciled.consecutiveDays);
          set((prev) => {
            const nextSlice = {
              ...extractSlice(prev),
              lastActiveDate: effectiveLast,
              historyDates: reconciled.normalizedDates.slice(0, 35),
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
        const priorReconciled = reconcileStreakWithHistory(state.historyDates, today, {
          allowFrozenGap: state.status === 'frozen',
          fallbackLastActiveDate: state.lastActiveDate,
          fallbackCurrentStreak: state.currentStreak,
        });

        if (state.todayCompleted && state.lastActiveDate === today) {
          const synced =
            priorReconciled.normalizedDates.length > 0 && state.status !== 'frozen'
              ? Math.max(1, priorReconciled.consecutiveDays)
              : state.currentStreak;
          if (synced !== state.currentStreak) {
            set((prev) => {
              const nextSlice = {
                ...extractSlice(prev),
                currentStreak: synced,
                longestStreak: Math.max(prev.longestStreak, synced),
              };
              return {
                ...nextSlice,
                byUser: { ...prev.byUser, [prev.activeUserId]: nextSlice },
              };
            });
          }
          return { streakUpdated: false, newStreak: synced };
        }

        const nextRawDates = [today, ...priorReconciled.normalizedDates];
        const afterReconciled = reconcileStreakWithHistory(nextRawDates, today);
        let newStreak = afterReconciled.consecutiveDays;
        if (state.status === 'frozen' && state.lastActiveDate) {
          const diff = getDaysDifference(state.lastActiveDate, today);
          if (diff <= 2) {
            newStreak = Math.max(newStreak, state.currentStreak + 1);
          }
        }
        newStreak = Math.max(1, newStreak);

        const longest = Math.max(
          state.longestStreak,
          newStreak,
          afterReconciled.longestInHistory
        );
        const nextHistory = afterReconciled.normalizedDates.slice(0, 35);

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
      onRehydrateStorage: () => (rehydrated) => {
        rehydrated?.refreshStreakStatus();
      },
    }
  )
);
