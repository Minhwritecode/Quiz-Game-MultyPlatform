export type QuizSource = 'manual' | 'ai';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface QuizItem {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: QuizSource;
  questions: QuizQuestion[];
  createdBy?: string;
  createdAt: string;
}

export interface CreateQuizInput {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdBy?: string;
  questions: QuizQuestion[];
}
