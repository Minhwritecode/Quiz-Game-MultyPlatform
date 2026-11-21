import { supabase } from '@/core/network/supabase';
import type {
  GeneratedQuestion,
  GeneratedQuiz,
  GenerateRagPayload,
  GenerateTopicPayload,
  QuestionCitation,
} from '../domain/models';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type EdgeQuestionRow = {
  content?: string;
  question?: string;
  options?: string[];
  correct_index?: number;
  correctAnswer?: number;
  explanation?: string;
  code_snippet?: string;
  codeSnippet?: string;
  citations?: Array<{
    label?: string;
    documentName?: string;
    headingPath?: string;
    pageNumber?: number;
    excerpt?: string;
  }>;
};

function mapEdgeQuestions(rows: EdgeQuestionRow[]): GeneratedQuestion[] {
  return rows.map((q) => {
    const citations: QuestionCitation[] | undefined = Array.isArray(q.citations)
      ? q.citations
          .filter((c) => Boolean(c?.documentName))
          .map((c) => ({
            label: String(c.label ?? 'S1'),
            documentName: String(c.documentName ?? ''),
            headingPath: c.headingPath ? String(c.headingPath) : undefined,
            pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : undefined,
            excerpt: c.excerpt ? String(c.excerpt) : undefined,
          }))
      : undefined;

    return {
      question: String(q.content ?? q.question ?? ''),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: typeof q.correct_index === 'number' ? q.correct_index : Number(q.correctAnswer ?? 0),
      ...(q.explanation ? { explanation: String(q.explanation) } : {}),
      ...(q.code_snippet || q.codeSnippet ? { codeSnippet: String(q.code_snippet ?? q.codeSnippet) } : {}),
      ...(citations && citations.length > 0 ? { citations } : {}),
    };
  });
}

function generateFallbackQuestions(topic: string, count: number, includeCodeSnippet = false): GeneratedQuiz {
  const diffLabels = ['Cơ bản', 'Nâng cao', 'Chuyên sâu'];
  const questions = Array.from({ length: count }, (_, i) => ({
    question: `Câu hỏi ${i + 1} về chủ đề "${topic}": Khái niệm hoặc ứng dụng trọng tâm là gì?`,
    ...(includeCodeSnippet
      ? {
          codeSnippet: `// Ví dụ minh hoạ #${i + 1} — ${topic}\nconst sample = { topic: "${topic}", step: ${i + 1} };\nconsole.log(sample.step * 2);`,
        }
      : {}),
    options: [
      `Nguyên lý nền tảng của ${topic} và cách vận hành`,
      `Phương pháp áp dụng thực tiễn trong trường hợp đặc biệt`,
      `Quy chuẩn mở rộng theo tiêu chuẩn hiện đại`,
      `Tất cả các phương án trên đều đúng`,
    ],
    correctAnswer: 3,
  }));

  return {
    id: `quiz-ai-${Date.now()}`,
    title: `Trắc nghiệm: ${topic}`,
    description: `Bộ câu hỏi AI tự động tổng hợp từ chủ đề "${topic}". Gồm ${count} câu hỏi ${diffLabels[0]}.`,
    difficulty: 'medium',
    source: 'topic',
    provider: 'offline-fallback',
    questions,
    createdAt: new Date().toISOString(),
  };
}

function generateRagFallback(payload: GenerateRagPayload): GeneratedQuiz {
  const docs =
    payload.documents.length > 0
      ? payload.documents
      : [{ name: `${payload.spaceName}.md`, content: payload.spaceName }];

  const questions: GeneratedQuestion[] = Array.from({ length: payload.questions }, (_, idx) => {
    const src = docs[idx % docs.length]!;
    return {
      question: `[${src.name}] Dựa trên tài liệu "${src.name}" trong kho "${payload.spaceName}", nội dung cốt lõi số ${idx + 1} nào dưới đây là chính xác?`,
      ...(payload.includeCodeSnippet
        ? {
            codeSnippet: `// Trích dẫn từ: ${src.name}\nconst ref = "${src.name}";\nconsole.log("Source verified:", ref);`,
          }
        : {}),
      options: [
        `Trọng tâm nêu trong ${src.name}: ${src.content.slice(0, 62)}${src.content.length > 62 ? '...' : ''}`,
        `Khái niệm đối lập không xuất hiện trong ${src.name}`,
        `Quy ước cũ đã bị thay thế ở phần phụ lục`,
        `Chưa có dữ liệu liên quan trong kho ${payload.spaceName}`,
      ],
      correctAnswer: 0,
      citations: [
        {
          label: `S${(idx % docs.length) + 1}`,
          documentName: src.name,
          pageNumber: 1,
          excerpt: src.content.slice(0, 120),
        },
      ],
    };
  });

  return {
    id: `quiz-rag-${Date.now()}`,
    title: `RAG Quiz: ${payload.spaceName}`,
    description: `Sinh có trích dẫn nguồn từ ${docs.length} tài liệu trong kho "${payload.spaceName}".`,
    difficulty: payload.difficulty,
    source: 'rag',
    provider: 'offline-fallback',
    questions,
    createdAt: new Date().toISOString(),
  };
}

export const aiQuizApi = {
  async fetchTokenBalance(): Promise<number | null> {
    if (!supabase) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;
      const { data, error } = await supabase.rpc('get_ai_token_balance');
      if (!error && typeof data === 'number') return data;
    } catch {
      // Offline / unconfigured
    }
    return null;
  },

  async generateFromTopic(payload: GenerateTopicPayload): Promise<GeneratedQuiz> {
    // 1. Primary path: Supabase Edge Function (Gemini / OpenAI-compatible + token wallet + generation_runs)
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data, error } = await supabase.functions.invoke('generate-questions', {
            body: {
              mode: 'topic',
              topic: payload.topic,
              question_count: payload.questions,
              difficulty: payload.difficulty,
              language: payload.language ?? 'vi',
              include_code_snippet: Boolean(payload.includeCodeSnippet),
            },
          });

          if (!error && Array.isArray(data?.questions) && data.questions.length > 0) {
            return {
              id: `quiz-sb-${Date.now()}`,
              title: `Trắc nghiệm: ${payload.topic}`,
              description: `Sinh trực tiếp bởi Supabase AI (${String(data.provider ?? 'gemini')}) · ${data.questions.length} câu hỏi.`,
              difficulty: payload.difficulty,
              source: 'topic',
              provider: String(data.provider ?? 'gemini'),
              runId: data.run_id ? String(data.run_id) : undefined,
              tokenBalance: typeof data.token_balance === 'number' ? data.token_balance : undefined,
              questions: mapEdgeQuestions(data.questions as EdgeQuestionRow[]),
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Fall through to secondary backend or offline fallback
      }
    }

    // 2. Secondary path: Optional external backend URL
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/generate/topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.quiz) {
          return {
            id: data.quiz._id || `quiz-${Date.now()}`,
            title: data.quiz.title,
            description: data.quiz.description,
            difficulty: data.quiz.difficulty || payload.difficulty,
            source: 'topic',
            questions: data.quiz.questions || [],
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback for offline or local dev without active backend server
    }

    return generateFallbackQuestions(payload.topic, payload.questions, payload.includeCodeSnippet);
  },

  async generateFromSpace(payload: GenerateRagPayload): Promise<GeneratedQuiz> {
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data, error } = await supabase.functions.invoke('generate-questions', {
            body: {
              mode: 'rag',
              space_id: payload.spaceId,
              documents: payload.documents,
              prompt: payload.prompt?.trim() || undefined,
              question_count: payload.questions,
              difficulty: payload.difficulty,
              language: payload.language ?? 'vi',
              include_code_snippet: Boolean(payload.includeCodeSnippet),
            },
          });

          if (!error && Array.isArray(data?.questions) && data.questions.length > 0) {
            return {
              id: `quiz-rag-${Date.now()}`,
              title: `RAG Quiz: ${payload.spaceName}`,
              description: `Truy xuất pgvector + MMR từ kho "${payload.spaceName}" (${String(data.provider ?? 'gemini')}) kèm trích dẫn nguồn đã xác thực.`,
              difficulty: payload.difficulty,
              source: 'rag',
              provider: String(data.provider ?? 'gemini'),
              runId: data.run_id ? String(data.run_id) : undefined,
              tokenBalance: typeof data.token_balance === 'number' ? data.token_balance : undefined,
              questions: mapEdgeQuestions(data.questions as EdgeQuestionRow[]),
              createdAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // Offline / fallback
      }
    }

    return generateRagFallback(payload);
  },

  async generateFromPdf(
    fileUri: string,
    fileName: string,
    difficulty: 'easy' | 'medium' | 'hard',
    questionsCount: number
  ): Promise<GeneratedQuiz> {
    try {
      const formData = new FormData();
      formData.append('pdf', {
        uri: fileUri,
        name: fileName,
        type: 'application/pdf',
      } as unknown as Blob);
      formData.append('difficulty', difficulty);
      formData.append('questions', String(questionsCount));

      const response = await fetch(`${BACKEND_URL}/api/pdf/generate`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.quiz) {
          return {
            id: data.quiz._id || `quiz-pdf-${Date.now()}`,
            title: data.quiz.title || `Trắc nghiệm từ: ${fileName}`,
            description: data.quiz.description || `Sinh tự động từ tài liệu PDF ${fileName}`,
            difficulty: data.quiz.difficulty || difficulty,
            source: 'pdf',
            questions: data.quiz.questions || [],
            createdAt: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback
    }

    const cleanName = fileName.replace(/\.[^/.]+$/, '');
    return {
      id: `quiz-pdf-${Date.now()}`,
      title: `Trắc nghiệm PDF: ${cleanName}`,
      description: `Bộ ${questionsCount} câu hỏi được phân tích và trích xuất từ tài liệu "${fileName}".`,
      difficulty,
      source: 'pdf',
      provider: 'offline-fallback',
      questions: Array.from({ length: questionsCount }, (_, i) => ({
        question: `[Tài liệu: ${cleanName}] Điểm then chốt ở phần ${i + 1} của tài liệu là gì?`,
        options: [
          `Định nghĩa và bối cảnh cốt lõi được nêu trong phần mở đầu`,
          `Giải pháp thực nghiệm và các luận điểm chứng minh`,
          `Kết luận và khuyến nghị ứng dụng thực tế`,
          `Cả ba yếu tố trên đều được đề cập`,
        ],
        correctAnswer: i % 4,
      })),
      createdAt: new Date().toISOString(),
    };
  },
};
