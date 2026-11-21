import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeneratedQuiz, QuizDifficulty } from '../domain/models';

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: 'pdf' | 'md' | 'txt' | 'note';
  excerpt: string;
  addedAt: string;
}

export interface KnowledgeSpace {
  id: string;
  name: string;
  subject: string;
  documents: KnowledgeDoc[];
  createdAt: string;
}

interface KnowledgeSpacesState {
  spaces: KnowledgeSpace[];
  createSpace: (name: string, subject: string) => KnowledgeSpace;
  removeSpace: (spaceId: string) => void;
  addDocument: (spaceId: string, doc: Omit<KnowledgeDoc, 'id' | 'addedAt'>) => void;
  removeDocument: (spaceId: string, docId: string) => void;
}

const DEFAULT_SPACES: KnowledgeSpace[] = [
  {
    id: 'space-web-dev',
    name: 'Kho Kiến thức Web & TypeScript',
    subject: 'Lập trình',
    createdAt: '2026-11-01T00:00:00Z',
    documents: [
      {
        id: 'doc-ts-1',
        name: 'typescript-handbook-notes.md',
        kind: 'md',
        excerpt: 'Utility types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, Record<K, V> và type narrowing với unknown.',
        addedAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'doc-react-1',
        name: 'react-hooks-patterns.pdf',
        kind: 'pdf',
        excerpt: 'useMemo, useCallback, useEffect cleanup và tối ưu hóa render cây component trên mobile/web.',
        addedAt: '2026-11-02T00:00:00Z',
      },
    ],
  },
];

export function buildCitedQuizFromSpace(
  space: KnowledgeSpace,
  difficulty: QuizDifficulty,
  count: number,
  includeCodeSnippet = false
): GeneratedQuiz {
  const docs = space.documents.length > 0
    ? space.documents
    : [{ id: 'fallback', name: `${space.name}.md`, kind: 'md' as const, excerpt: space.subject, addedAt: new Date().toISOString() }];

  const questions = Array.from({ length: count }, (_, idx) => {
    const src = docs[idx % docs.length]!;
    return {
      question: `[${src.name}] Dựa trên tài liệu "${src.name}" trong kho "${space.name}", nội dung cốt lõi số ${idx + 1} nào dưới đây là chính xác?`,
      ...(includeCodeSnippet
        ? {
            codeSnippet: `// Trích dẫn từ: ${src.name}\nconst ref = "${src.name}";\nconsole.log("Source verified:", ref);`,
          }
        : {}),
      options: [
        `Trọng tâm nêu trong ${src.name}: ${src.excerpt.slice(0, 62)}${src.excerpt.length > 62 ? '...' : ''}`,
        `Khái niệm đối lập không xuất hiện trong ${src.name}`,
        `Quy ước cũ đã bị thay thế ở phần phụ lục`,
        `Chưa có dữ liệu liên quan trong kho ${space.name}`,
      ],
      correctAnswer: 0,
    };
  });

  return {
    id: `quiz-space-${Date.now()}`,
    title: `RAG Quiz: ${space.name}`,
    description: `Sinh tự động có trích dẫn từ ${docs.length} tài liệu trong kho "${space.name}".`,
    difficulty,
    source: 'pdf',
    questions,
    createdAt: new Date().toISOString(),
  };
}

export const useKnowledgeSpacesStore = create<KnowledgeSpacesState>()(
  persist(
    (set) => ({
      spaces: DEFAULT_SPACES,

      createSpace: (name, subject) => {
        const space: KnowledgeSpace = {
          id: `space-${Date.now()}`,
          name: name.trim(),
          subject: subject.trim() || 'Tổng hợp',
          documents: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ spaces: [space, ...state.spaces] }));
        return space;
      },

      removeSpace: (spaceId) =>
        set((state) => ({ spaces: state.spaces.filter((s) => s.id !== spaceId) })),

      addDocument: (spaceId, doc) =>
        set((state) => ({
          spaces: state.spaces.map((s) =>
            s.id === spaceId
              ? {
                  ...s,
                  documents: [
                    { ...doc, id: `doc-${Date.now()}`, addedAt: new Date().toISOString() },
                    ...s.documents,
                  ],
                }
              : s
          ),
        })),

      removeDocument: (spaceId, docId) =>
        set((state) => ({
          spaces: state.spaces.map((s) =>
            s.id === spaceId
              ? { ...s, documents: s.documents.filter((d) => d.id !== docId) }
              : s
          ),
        })),
    }),
    {
      name: 'papyrus.knowledge-spaces',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
