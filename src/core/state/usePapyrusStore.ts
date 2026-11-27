import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  fetchCloudProfileSnapshot,
  preferenceStorage,
  seedQuestionSets,
  syncUserProgressToCloud,
} from '@/composition/preferences';
import type { QuestionSet, SourceDocument } from '@/core/domain/models';
import { useAuthStore } from './useAuthStore';
import { computeNextElo, ELO_INITIAL, type EloMatchOutcome } from '@/features/room-battle/domain/elo';

export interface PerUserStatsSlice {
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  wins: number;
  eloRating: number;
  eloPeak: number;
  lastEloDelta: number;
  categoryElos: Record<string, number>;
}

const DEFAULT_USER_STATS: PerUserStatsSlice = {
  gamesPlayed: 0,
  totalScore: 0,
  bestScore: 0,
  wins: 0,
  eloRating: ELO_INITIAL,
  eloPeak: ELO_INITIAL,
  lastEloDelta: 0,
  categoryElos: {},
};

type PapyrusState = {
  activeUserId: string;
  statsByUser: Record<string, PerUserStatsSlice>;
  questionSets: QuestionSet[];
  deletedSetIds: string[];
  sourceDocument: SourceDocument | null;
  sourceDocumentOwner: string | null;
  hydrated: boolean;
  syncMessage: string;
  setSyncMessage: (message: string) => void;
  replaceQuestionSets: (sets: QuestionSet[]) => void;
  resetAccountView: () => void;
  switchAccountScope: (userId: string) => void;
  haptics: boolean;
  reduceMotion: boolean;
  language: 'vi' | 'en';
  theme: 'system' | 'light' | 'dark';
  render3DMode: boolean;
  bgmMuted: boolean;
  /** Per-account game stats & competitive ELO rating */
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  wins: number;
  eloRating: number;
  eloPeak: number;
  lastEloDelta: number;
  categoryElos: Record<string, number>;
  recordGameResult: (score: number, isWin: boolean, opponentElo?: number) => void;
  addBonusXp: (xp: number) => void;
  recordCategoryElo: (categoryId: string, outcome: EloMatchOutcome, opponentElo: number, rated: boolean) => number;
  hydrateCloudProfile: () => Promise<void>;
  setTheme: (theme: 'system' | 'light' | 'dark') => void;
  hydrateQuestionSets: (load: () => Promise<QuestionSet[]>) => Promise<void>;
  saveSourceDocument: (document: SourceDocument) => void;
  clearSourceDocument: () => void;
  saveQuestionSet: (questionSet: QuestionSet) => void;
  deleteQuestionSet: (id: string) => void;
  toggleHaptics: () => void;
  toggleReduceMotion: () => void;
  setLanguage: (language: 'vi' | 'en') => void;
  toggleLanguage: () => void;
  toggleRender3DMode: () => void;
  setRender3DMode: (enabled: boolean) => void;
  toggleBgmMuted: () => void;
};

export const usePapyrusStore = create<PapyrusState>()(
  persist(
    (set, get) => ({
      activeUserId: 'guest',
      statsByUser: {},
      questionSets: seedQuestionSets,
      deletedSetIds: [],
      sourceDocument: null,
      sourceDocumentOwner: null,
      hydrated: false,
      syncMessage: '',
      setSyncMessage: (syncMessage) => set({ syncMessage }),
      replaceQuestionSets: (questionSets) => set({ questionSets, hydrated: true }),
      resetAccountView: () => set({ questionSets: seedQuestionSets, sourceDocument: null, sourceDocumentOwner: null, hydrated: false, syncMessage: '' }),
      switchAccountScope: (nextUserId) => {
        const cleanId = nextUserId || 'guest';
        const state = get();
        if (state.activeUserId === cleanId) return;

        // Save current user's stats slice before switching
        const currentSlice: PerUserStatsSlice = {
          gamesPlayed: state.gamesPlayed,
          totalScore: state.totalScore,
          bestScore: state.bestScore,
          wins: state.wins,
          eloRating: state.eloRating,
          eloPeak: state.eloPeak,
          lastEloDelta: state.lastEloDelta,
          categoryElos: state.categoryElos,
        };
        const updatedMap = {
          ...state.statsByUser,
          [state.activeUserId]: currentSlice,
        };
        const targetSlice = updatedMap[cleanId] ?? DEFAULT_USER_STATS;
        set({
          activeUserId: cleanId,
          statsByUser: updatedMap,
          ...targetSlice,
        });
      },
      haptics: true,
      reduceMotion: false,
      language: 'vi',
      theme: 'system',
      render3DMode: false,
      bgmMuted: false,
      ...DEFAULT_USER_STATS,
      recordGameResult: (score, isWin, opponentElo) => {
        set((state) => {
          const opp = opponentElo ?? state.eloRating;
          const { nextRating, delta } = computeNextElo(
            state.eloRating,
            opp,
            isWin ? 1 : 0,
            state.gamesPlayed
          );
          const nextGames = state.gamesPlayed + 1;
          const nextTotal = state.totalScore + Math.max(0, score);
          const nextBest = Math.max(state.bestScore, score);
          const nextWins = state.wins + (isWin ? 1 : 0);
          const nextPeak = Math.max(state.eloPeak, nextRating);

          const nextSlice: PerUserStatsSlice = {
            gamesPlayed: nextGames,
            totalScore: nextTotal,
            bestScore: nextBest,
            wins: nextWins,
            eloRating: nextRating,
            eloPeak: nextPeak,
            lastEloDelta: delta,
            categoryElos: state.categoryElos,
          };

          if (state.activeUserId !== 'guest') {
            void syncUserProgressToCloud({
              gamesPlayed: nextGames,
              totalScore: nextTotal,
              bestScore: nextBest,
              wins: nextWins,
              eloRating: nextRating,
              eloPeak: nextPeak,
            });
          }

          return {
            ...nextSlice,
            statsByUser: {
              ...state.statsByUser,
              [state.activeUserId]: nextSlice,
            },
          };
        });
      },
      addBonusXp: (xp) => {
        if (xp <= 0) return;
        set((state) => {
          const nextTotal = state.totalScore + Math.round(xp);
          const nextSlice: PerUserStatsSlice = {
            gamesPlayed: state.gamesPlayed,
            totalScore: nextTotal,
            bestScore: state.bestScore,
            wins: state.wins,
            eloRating: state.eloRating,
            eloPeak: state.eloPeak,
            lastEloDelta: state.lastEloDelta,
            categoryElos: state.categoryElos,
          };
          if (state.activeUserId !== 'guest') {
            void syncUserProgressToCloud({ totalScore: nextTotal });
          }
          return {
            totalScore: nextTotal,
            statsByUser: {
              ...state.statsByUser,
              [state.activeUserId]: nextSlice,
            },
          };
        });
      },
      recordCategoryElo: (categoryId, outcome, opponentElo, rated) => {
        if (!rated) return 0;
        const state = get();
        const current = state.categoryElos[categoryId] ?? state.eloRating;
        const { nextRating, delta } = computeNextElo(current, opponentElo, outcome, state.gamesPlayed);
        const nextCatElos = { ...state.categoryElos, [categoryId]: nextRating };
        const nextPeak = Math.max(state.eloPeak, nextRating);
        const nextSlice: PerUserStatsSlice = {
          gamesPlayed: state.gamesPlayed,
          totalScore: state.totalScore,
          bestScore: state.bestScore,
          wins: state.wins,
          eloRating: nextRating,
          eloPeak: nextPeak,
          lastEloDelta: delta,
          categoryElos: nextCatElos,
        };
        set({
          ...nextSlice,
          statsByUser: {
            ...state.statsByUser,
            [state.activeUserId]: nextSlice,
          },
        });
        if (state.activeUserId !== 'guest') {
          void syncUserProgressToCloud({ eloRating: nextRating, eloPeak: nextPeak });
        }
        return delta;
      },
      hydrateCloudProfile: async () => {
        const snapshot = await fetchCloudProfileSnapshot();
        if (!snapshot) return;
        set((state) => {
          const nextSlice: PerUserStatsSlice = {
            eloRating: snapshot.eloRating,
            eloPeak: Math.max(state.eloPeak, snapshot.eloPeak),
            gamesPlayed: Math.max(state.gamesPlayed, snapshot.gamesPlayed),
            totalScore: Math.max(state.totalScore, snapshot.totalScore),
            bestScore: Math.max(state.bestScore, snapshot.bestScore),
            wins: Math.max(state.wins, snapshot.wins),
            lastEloDelta: state.lastEloDelta,
            categoryElos: { ...state.categoryElos, ...snapshot.categoryElos },
          };
          return {
            ...nextSlice,
            statsByUser: {
              ...state.statsByUser,
              [state.activeUserId]: nextSlice,
            },
          };
        });
      },
      setTheme: (theme) => set({ theme }),
      hydrateQuestionSets: async (load) => {
        const stored = await load();
        const existingIds = new Set(stored.map((s) => s.id));
        const merged = [...stored];
        for (const seed of seedQuestionSets) {
          if (!existingIds.has(seed.id) && !get().deletedSetIds.includes(seed.id)) {
            merged.push(seed);
          }
        }
        set({
          questionSets: merged.filter((item) => !get().deletedSetIds.includes(item.id)),
          hydrated: true,
        });
      },
      saveSourceDocument: (document) => set({ sourceDocument: document, sourceDocumentOwner: useAuthStore.getState().user?.id ?? null }),
      clearSourceDocument: () => set({ sourceDocument: null, sourceDocumentOwner: null }),
      saveQuestionSet: (questionSet) =>
        set((state) => ({
          deletedSetIds: state.deletedSetIds.filter((id) => id !== questionSet.id),
          questionSets: [
            questionSet,
            ...state.questionSets.filter((item) => item.id !== questionSet.id),
          ],
        })),
      deleteQuestionSet: (id) =>
        set((state) => ({
          deletedSetIds: [...new Set([...state.deletedSetIds, id])],
          questionSets: state.questionSets.filter((item) => item.id !== id),
        })),
      toggleHaptics: () => set((state) => ({ haptics: !state.haptics })),
      toggleReduceMotion: () => set((state) => ({ reduceMotion: !state.reduceMotion })),
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => set((state) => ({ language: state.language === 'vi' ? 'en' : 'vi' })),
      toggleRender3DMode: () => set((state) => ({ render3DMode: !state.render3DMode })),
      setRender3DMode: (render3DMode) => set({ render3DMode }),
      toggleBgmMuted: () => set((state) => ({ bgmMuted: !state.bgmMuted })),
    }),
    {
      name: 'papyrus.preferences.v2',
      storage: createJSONStorage(() => preferenceStorage),
      partialize: (state) => ({
        activeUserId: state.activeUserId,
        statsByUser: state.statsByUser,
        deletedSetIds: state.deletedSetIds,
        theme: state.theme,
        language: state.language,
        haptics: state.haptics,
        reduceMotion: state.reduceMotion,
        render3DMode: state.render3DMode,
        bgmMuted: state.bgmMuted,
        gamesPlayed: state.gamesPlayed,
        totalScore: state.totalScore,
        bestScore: state.bestScore,
        wins: state.wins,
        eloRating: state.eloRating,
        eloPeak: state.eloPeak,
        lastEloDelta: state.lastEloDelta,
        categoryElos: state.categoryElos,
      }),
    }
  )
);
