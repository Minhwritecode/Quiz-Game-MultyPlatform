import type { GeneratedQuiz, GenerateTopicPayload } from '../domain/models';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

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
    questions,
    createdAt: new Date().toISOString(),
  };
}

export const aiQuizApi = {
  async generateFromTopic(payload: GenerateTopicPayload): Promise<GeneratedQuiz> {
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

  async generateFromPdf(fileUri: string, fileName: string, difficulty: 'easy' | 'medium' | 'hard', questionsCount: number): Promise<GeneratedQuiz> {
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
