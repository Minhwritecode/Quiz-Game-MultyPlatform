export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuestionCitation {
  label: string;
  documentName: string;
  headingPath?: string;
  pageNumber?: number;
  excerpt?: string;
}

export interface GeneratedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  codeSnippet?: string;
  citations?: QuestionCitation[];
}

export interface GeneratedQuiz {
  id: string;
  title: string;
  description: string;
  difficulty: QuizDifficulty;
  source: 'topic' | 'pdf' | 'manual' | 'rag';
  provider?: string;
  runId?: string;
  tokenBalance?: number;
  questions: GeneratedQuestion[];
  createdAt: string;
}

export interface GenerateTopicPayload {
  topic: string;
  difficulty: QuizDifficulty;
  questions: number;
  includeCodeSnippet?: boolean;
  language?: 'vi' | 'en';
}

export interface GenerateRagPayload {
  spaceId?: string;
  spaceName: string;
  documents: Array<{ name: string; content: string }>;
  prompt?: string;
  difficulty: QuizDifficulty;
  questions: number;
  includeCodeSnippet?: boolean;
  language?: 'vi' | 'en';
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: 'pdf' | 'docx' | 'md' | 'txt' | 'note';
  excerpt: string;
  fileBase64?: string;
  chunkCount?: number;
  synced?: boolean;
  addedAt: string;
}

export interface KnowledgeSpace {
  id: string;
  cloudId?: string;
  name: string;
  subject: string;
  documents: KnowledgeDoc[];
  createdAt: string;
}
