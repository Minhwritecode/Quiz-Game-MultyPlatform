export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  codeSnippet?: string;
}

export interface GeneratedQuiz {
  id: string;
  title: string;
  description: string;
  difficulty: QuizDifficulty;
  source: 'topic' | 'pdf' | 'manual';
  questions: GeneratedQuestion[];
  createdAt: string;
}

export interface GenerateTopicPayload {
  topic: string;
  difficulty: QuizDifficulty;
  questions: number;
  includeCodeSnippet?: boolean;
}
