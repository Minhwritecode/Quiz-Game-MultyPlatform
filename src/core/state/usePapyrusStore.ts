import { create } from 'zustand';
import { seedQuestionSets } from '@/core/data/seed';
import type { QuestionSet } from '@/core/domain/models';

type PapyrusState = {
  questionSets: QuestionSet[];
  haptics: boolean;
  reduceMotion: boolean;
  saveQuestionSet: (questionSet: QuestionSet) => void;
  deleteQuestionSet: (id: string) => void;
  toggleHaptics: () => void;
  toggleReduceMotion: () => void;
};

export const usePapyrusStore = create<PapyrusState>((set) => ({
  questionSets: seedQuestionSets,
  haptics: true,
  reduceMotion: false,
  saveQuestionSet: (questionSet) => set((state) => ({
    questionSets: [questionSet, ...state.questionSets.filter((item) => item.id !== questionSet.id)],
  })),
  deleteQuestionSet: (id) => set((state) => ({ questionSets: state.questionSets.filter((item) => item.id !== id) })),
  toggleHaptics: () => set((state) => ({ haptics: !state.haptics })),
  toggleReduceMotion: () => set((state) => ({ reduceMotion: !state.reduceMotion })),
}));
