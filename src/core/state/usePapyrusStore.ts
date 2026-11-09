import { create } from 'zustand';
import { seedQuestionSets } from '@/core/data/seed';
import type { QuestionSet, SourceDocument } from '@/core/domain/models';

type PapyrusState = {
  questionSets: QuestionSet[];
  sourceDocument: SourceDocument | null;
  hydrated: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  hydrateQuestionSets: (load: () => Promise<QuestionSet[]>) => Promise<void>;
  saveSourceDocument: (document: SourceDocument) => void;
  clearSourceDocument: () => void;
  saveQuestionSet: (questionSet: QuestionSet) => void;
  deleteQuestionSet: (id: string) => void;
  toggleHaptics: () => void;
  toggleReduceMotion: () => void;
};

export const usePapyrusStore = create<PapyrusState>((set) => ({
  questionSets: seedQuestionSets,
  sourceDocument: null,
  hydrated: false,
  haptics: true,
  reduceMotion: false,
  hydrateQuestionSets: async (load) => {
    const stored = await load();
    set({ questionSets: stored.length > 0 ? stored : seedQuestionSets, hydrated: true });
  },
  saveSourceDocument: (document) => set({ sourceDocument: document }),
  clearSourceDocument: () => set({ sourceDocument: null }),
  saveQuestionSet: (questionSet) => set((state) => ({
    questionSets: [questionSet, ...state.questionSets.filter((item) => item.id !== questionSet.id)],
  })),
  deleteQuestionSet: (id) => set((state) => ({ questionSets: state.questionSets.filter((item) => item.id !== id) })),
  toggleHaptics: () => set((state) => ({ haptics: !state.haptics })),
  toggleReduceMotion: () => set((state) => ({ reduceMotion: !state.reduceMotion })),
}));
