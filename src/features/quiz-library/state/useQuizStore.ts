import { create } from 'zustand';
import type { CreateQuizInput, QuizItem } from '../domain/models';
import { quizApi } from '@/composition/platform';

interface QuizStoreState {
  quizzes: QuizItem[];
  isLoading: boolean;
  loadQuizzes: () => Promise<void>;
  createQuiz: (input: CreateQuizInput) => Promise<QuizItem>;
  addQuiz: (item: QuizItem) => void;
  deleteQuiz: (id: string) => Promise<void>;
}

export const useQuizStore = create<QuizStoreState>((set, get) => ({
  quizzes: [],
  isLoading: false,

  loadQuizzes: async () => {
    set({ isLoading: true });
    try {
      const items = await quizApi.getAll();
      set({ quizzes: items, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createQuiz: async (input) => {
    set({ isLoading: true });
    try {
      const item = await quizApi.create(input);
      set((state) => ({
        quizzes: [item, ...state.quizzes.filter((q) => q.id !== item.id)],
        isLoading: false,
      }));
      return item;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  addQuiz: (item) => {
    set((state) => ({
      quizzes: [item, ...state.quizzes.filter((q) => q.id !== item.id)],
    }));
  },

  deleteQuiz: async (id) => {
    await quizApi.deleteById(id);
    set((state) => ({
      quizzes: state.quizzes.filter((q) => q.id !== id),
    }));
  },
}));
