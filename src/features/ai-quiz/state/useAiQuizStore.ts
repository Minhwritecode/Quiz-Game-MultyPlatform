import { create } from 'zustand';
import type { GeneratedQuiz, QuizDifficulty } from '../domain/models';
import { aiQuizApi } from '../services/aiQuiz.api';

interface AiQuizState {
  generatedQuiz: GeneratedQuiz | null;
  history: GeneratedQuiz[];
  isLoading: boolean;
  error: string | null;
  generateFromTopic: (topic: string, difficulty: QuizDifficulty, questions: number) => Promise<GeneratedQuiz>;
  generateFromPdf: (fileUri: string, fileName: string, difficulty: QuizDifficulty, questions: number) => Promise<GeneratedQuiz>;
  clearCurrentQuiz: () => void;
}

export const useAiQuizStore = create<AiQuizState>((set) => ({
  generatedQuiz: null,
  history: [],
  isLoading: false,
  error: null,

  generateFromTopic: async (topic, difficulty, questions) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await aiQuizApi.generateFromTopic({ topic, difficulty, questions });
      set((state) => ({
        generatedQuiz: quiz,
        history: [quiz, ...state.history],
        isLoading: false,
      }));
      return quiz;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi tạo quiz bằng AI';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  generateFromPdf: async (fileUri, fileName, difficulty, questions) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await aiQuizApi.generateFromPdf(fileUri, fileName, difficulty, questions);
      set((state) => ({
        generatedQuiz: quiz,
        history: [quiz, ...state.history],
        isLoading: false,
      }));
      return quiz;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi tạo quiz từ file PDF';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearCurrentQuiz: () => set({ generatedQuiz: null, error: null }),
}));
