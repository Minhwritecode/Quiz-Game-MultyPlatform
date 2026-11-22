import { create } from 'zustand';
import type { GeneratedQuestion, GeneratedQuiz, GenerateRagPayload, QuizDifficulty } from '../domain/models';
import { aiQuizApi } from '@/composition/platform';

interface AiQuizState {
  generatedQuiz: GeneratedQuiz | null;
  history: GeneratedQuiz[];
  isLoading: boolean;
  error: string | null;
  tokenBalance: number | null;
  refreshTokenBalance: () => Promise<void>;
  loadCloudRuns: () => Promise<void>;
  selectRunFromHistory: (quizId: string) => void;
  updateGeneratedQuestion: (index: number, updated: GeneratedQuestion) => void;
  discardGeneratedQuestion: (index: number) => void;
  generateFromTopic: (
    topic: string,
    difficulty: QuizDifficulty,
    questions: number,
    includeCodeSnippet?: boolean
  ) => Promise<GeneratedQuiz>;
  generateFromSpace: (payload: GenerateRagPayload) => Promise<GeneratedQuiz>;
  generateFromPdf: (fileUri: string, fileName: string, difficulty: QuizDifficulty, questions: number) => Promise<GeneratedQuiz>;
  clearCurrentQuiz: () => void;
}

export const useAiQuizStore = create<AiQuizState>((set, get) => ({
  generatedQuiz: null,
  history: [],
  isLoading: false,
  error: null,
  tokenBalance: null,

  refreshTokenBalance: async () => {
    const balance = await aiQuizApi.fetchTokenBalance();
    if (balance !== null) {
      set({ tokenBalance: balance });
    }
  },

  loadCloudRuns: async () => {
    const cloudRuns = await aiQuizApi.fetchGenerationRuns();
    if (cloudRuns.length === 0) return;
    set((state) => {
      const existingIds = new Set(state.history.map((h) => h.runId || h.id));
      const merged = [
        ...state.history,
        ...cloudRuns.filter((r) => !existingIds.has(r.runId || r.id)),
      ];
      return { history: merged.slice(0, 20) };
    });
  },

  selectRunFromHistory: (quizId) => {
    const found = get().history.find((h) => h.id === quizId || h.runId === quizId);
    if (found) {
      set({ generatedQuiz: found, error: null });
    }
  },

  updateGeneratedQuestion: (index, updated) => {
    const current = get().generatedQuiz;
    if (!current) return;
    const nextQuestions = current.questions.map((q, idx) => (idx === index ? updated : q));
    const nextQuiz: GeneratedQuiz = { ...current, questions: nextQuestions };
    set((state) => ({
      generatedQuiz: nextQuiz,
      history: state.history.map((h) => (h.id === nextQuiz.id ? nextQuiz : h)),
    }));
    if (nextQuiz.runId) {
      void aiQuizApi.syncRunQuestions(nextQuiz.runId, nextQuestions);
    }
  },

  discardGeneratedQuestion: (index) => {
    const current = get().generatedQuiz;
    if (!current || current.questions.length <= 1) return;
    const nextQuestions = current.questions.filter((_, idx) => idx !== index);
    const nextQuiz: GeneratedQuiz = { ...current, questions: nextQuestions };
    set((state) => ({
      generatedQuiz: nextQuiz,
      history: state.history.map((h) => (h.id === nextQuiz.id ? nextQuiz : h)),
    }));
    if (nextQuiz.runId) {
      void aiQuizApi.syncRunQuestions(nextQuiz.runId, nextQuestions);
    }
  },

  generateFromTopic: async (topic, difficulty, questions, includeCodeSnippet = false) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await aiQuizApi.generateFromTopic({ topic, difficulty, questions, includeCodeSnippet });
      set((state) => ({
        generatedQuiz: quiz,
        history: [quiz, ...state.history],
        tokenBalance: typeof quiz.tokenBalance === 'number' ? quiz.tokenBalance : state.tokenBalance,
        isLoading: false,
      }));
      return quiz;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi tạo quiz bằng AI';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  generateFromSpace: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await aiQuizApi.generateFromSpace(payload);
      set((state) => ({
        generatedQuiz: quiz,
        history: [quiz, ...state.history],
        tokenBalance: typeof quiz.tokenBalance === 'number' ? quiz.tokenBalance : state.tokenBalance,
        isLoading: false,
      }));
      return quiz;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi khi tạo quiz RAG từ Kho tri thức';
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
        tokenBalance: typeof quiz.tokenBalance === 'number' ? quiz.tokenBalance : state.tokenBalance,
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
