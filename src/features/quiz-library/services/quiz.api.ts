import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CreateQuizInput, QuizItem } from '../domain/models';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const STORAGE_KEY = '@papyrus_custom_quizzes';

const DEFAULT_QUIZZES: QuizItem[] = [
  {
    id: 'quiz-default-1',
    title: 'Thần thoại Hy Lạp & Văn minh Cổ đại',
    description: 'Thử thách trí nhớ về các vị thần đỉnh Olympus và kỳ quan cổ đại thế giới.',
    difficulty: 'easy',
    source: 'manual',
    questions: [
      {
        question: 'Vị thần tối cao trong thần thoại Hy Lạp cai quản đỉnh Olympus là ai?',
        options: ['Zeus', 'Poseidon', 'Hades', 'Apollo'],
        correctAnswer: 0,
      },
      {
        question: 'Kim tự tháp Giza thuộc về nền văn minh nào?',
        options: ['Lưỡng Hà', 'Ai Cập', 'Hy Lạp', 'La Mã'],
        correctAnswer: 1,
      },
      {
        question: 'Thần tình yêu và sắc đẹp Hy Lạp tên là gì?',
        options: ['Hera', 'Athena', 'Aphrodite', 'Artemis'],
        correctAnswer: 2,
      },
    ],
    createdBy: 'Papyrus Team',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'quiz-default-2',
    title: 'Khoa học Vũ trụ & Hệ Mặt Trời',
    description: 'Bộ câu hỏi khám phá thiên văn học và bí ẩn các hành tinh.',
    difficulty: 'medium',
    source: 'ai',
    questions: [
      {
        question: 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?',
        options: ['Sao Kim', 'Sao Thủy', 'Sao Hỏa', 'Trái Đất'],
        correctAnswer: 1,
      },
      {
        question: 'Hành tinh nào có kích thước lớn nhất trong Hệ Mặt Trời?',
        options: ['Sao Thổ', 'Sao Thiên Vương', 'Sao Mộc', 'Sao Hải Vương'],
        correctAnswer: 2,
      },
      {
        question: 'Ánh sáng từ Mặt Trời mất khoảng bao lâu để tới Trái Đất?',
        options: ['Khoảng 8 phút 20 giây', 'Khoảng 1 giây', 'Khoảng 1 giờ', 'Tức thì'],
        correctAnswer: 0,
      },
    ],
    createdBy: 'AI Quiz Pulse',
    createdAt: new Date().toISOString(),
  },
];

export const quizApi = {
  async getAll(): Promise<QuizItem[]> {
    // 1. Try backend
    try {
      const response = await fetch(`${BACKEND_URL}/api/quizzes`);
      if (response.ok) {
        const json = await response.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          const remoteItems: QuizItem[] = json.data.map((item: any) => ({
            id: item._id || item.id,
            title: item.title,
            description: item.description,
            difficulty: item.difficulty || 'easy',
            source: item.source || 'manual',
            questions: item.questions || [],
            createdBy: item.createdBy,
            createdAt: item.createdAt || new Date().toISOString(),
          }));
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remoteItems));
          return remoteItems;
        }
      }
    } catch {
      // Offline fallback
    }

    // 2. Local storage
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }

    // 3. Fallback defaults
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_QUIZZES));
    return DEFAULT_QUIZZES;
  },

  async create(input: CreateQuizInput): Promise<QuizItem> {
    const newItem: QuizItem = {
      id: `quiz-${Date.now()}`,
      title: input.title,
      description: input.description,
      difficulty: input.difficulty,
      source: 'manual',
      questions: input.questions,
      createdBy: input.createdBy || 'User',
      createdAt: new Date().toISOString(),
    };

    // Try backend
    try {
      const res = await fetch(`${BACKEND_URL}/api/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?._id) {
          newItem.id = json.data._id;
        }
      }
    } catch {
      // Offline mode
    }

    // Persist locally
    const current = await quizApi.getAll();
    const updated = [newItem, ...current.filter((q) => q.id !== newItem.id)];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  },

  async deleteById(id: string): Promise<void> {
    try {
      await fetch(`${BACKEND_URL}/api/quizzes/${id}`, { method: 'DELETE' });
    } catch {
      // Offline
    }

    const current = await quizApi.getAll();
    const updated = current.filter((q) => q.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
};
