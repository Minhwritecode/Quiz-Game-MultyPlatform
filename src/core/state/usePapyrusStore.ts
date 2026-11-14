import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedQuestionSets } from '@/core/data/seed';
import type { QuestionSet, SourceDocument } from '@/core/domain/models';

type PapyrusState = {
  questionSets: QuestionSet[];
  deletedSetIds: string[];
  sourceDocument: SourceDocument | null;
  hydrated: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  language: 'vi' | 'en';
  theme: 'system' | 'light' | 'dark';
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
};

export const usePapyrusStore = create<PapyrusState>()(persist((set, get) => ({
  questionSets: seedQuestionSets,
  deletedSetIds: [],
  sourceDocument: null,
  hydrated: false,
  haptics: true,
  reduceMotion: false,
  language: 'vi',
  theme: 'system',
  setTheme: (theme) => set({theme}),
  hydrateQuestionSets: async (load) => {
    const stored = await load();
    const existingIds = new Set(stored.map((s) => s.id));
    const merged = [...stored];
    for (const seed of seedQuestionSets) {
      if (!existingIds.has(seed.id) && !get().deletedSetIds.includes(seed.id)) {
        merged.push(seed);
      }
    }
    set({ questionSets: merged.filter(item => !get().deletedSetIds.includes(item.id)), hydrated: true });
  },
  saveSourceDocument: (document) => set({ sourceDocument: document }),
  clearSourceDocument: () => set({ sourceDocument: null }),
  saveQuestionSet: (questionSet) =>
    set((state) => ({
      deletedSetIds: state.deletedSetIds.filter(id => id !== questionSet.id),
      questionSets: [questionSet, ...state.questionSets.filter((item) => item.id !== questionSet.id)],
    })),
  deleteQuestionSet: (id) => set((state) => ({ deletedSetIds: [...new Set([...state.deletedSetIds, id])], questionSets: state.questionSets.filter((item) => item.id !== id) })),
  toggleHaptics: () => set((state) => ({ haptics: !state.haptics })),
  toggleReduceMotion: () => set((state) => ({ reduceMotion: !state.reduceMotion })),
  setLanguage: (language) => set({ language }),
  toggleLanguage: () => set((state) => ({ language: state.language === 'vi' ? 'en' : 'vi' })),
}), {name:'papyrus.preferences',storage:createJSONStorage(()=>AsyncStorage),partialize:state=>({deletedSetIds:state.deletedSetIds,theme:state.theme,language:state.language,haptics:state.haptics,reduceMotion:state.reduceMotion})}));
