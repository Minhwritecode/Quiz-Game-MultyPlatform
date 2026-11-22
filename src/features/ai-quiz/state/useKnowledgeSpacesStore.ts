import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import { knowledgeSpacesRepository } from '@/composition/platform';
import type { GeneratedQuiz, KnowledgeDoc, KnowledgeSpace, QuizDifficulty } from '../domain/models';

export type { KnowledgeDoc, KnowledgeSpace };

interface KnowledgeSpacesState {
  spaces: KnowledgeSpace[];
  syncing: boolean;
  createSpace: (name: string, subject: string) => KnowledgeSpace;
  removeSpace: (spaceId: string) => void;
  addDocument: (spaceId: string, doc: Omit<KnowledgeDoc, 'id' | 'addedAt'>) => void;
  removeDocument: (spaceId: string, docId: string) => void;
  syncFromCloud: () => Promise<void>;
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
      citations: [
        {
          label: `S${(idx % docs.length) + 1}`,
          documentName: src.name,
          pageNumber: 1,
          excerpt: src.excerpt.slice(0, 120),
        },
      ],
    };
  });

  return {
    id: `quiz-space-${Date.now()}`,
    title: `RAG Quiz: ${space.name}`,
    description: `Sinh tự động có trích dẫn từ ${docs.length} tài liệu trong kho "${space.name}".`,
    difficulty,
    source: 'rag',
    questions,
    createdAt: new Date().toISOString(),
  };
}

export const useKnowledgeSpacesStore = create<KnowledgeSpacesState>()(
  persist(
    (set, get) => ({
      spaces: DEFAULT_SPACES,
      syncing: false,

      createSpace: (name, subject) => {
        const space: KnowledgeSpace = {
          id: `space-${Date.now()}`,
          name: name.trim(),
          subject: subject.trim() || 'Tổng hợp',
          documents: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ spaces: [space, ...state.spaces] }));

        // Best-effort sync new space to Supabase
        void knowledgeSpacesRepository.ensureCloudSpace(space).then((cloudId) => {
          if (!cloudId) return;
          set((state) => ({
            spaces: state.spaces.map((s) => (s.id === space.id ? { ...s, cloudId } : s)),
          }));
        });

        return space;
      },

      removeSpace: (spaceId) => {
        const target = get().spaces.find((s) => s.id === spaceId);
        set((state) => ({ spaces: state.spaces.filter((s) => s.id !== spaceId) }));
        if (target?.cloudId) {
          void knowledgeSpacesRepository.deleteCloudSpace(target.cloudId);
        }
      },

      addDocument: (spaceId, doc) => {
        const localDocId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newDoc: KnowledgeDoc = {
          ...doc,
          id: localDocId,
          synced: false,
          addedAt: new Date().toISOString(),
        };
        set((state) => ({
          spaces: state.spaces.map((s) =>
            s.id === spaceId
              ? { ...s, documents: [newDoc, ...s.documents] }
              : s
          ),
        }));

        // Best-effort RAG ingestion via Supabase Edge Function `rag-ingest` (chunks + pgvector embeddings)
        const targetSpace = get().spaces.find((s) => s.id === spaceId);
        if (targetSpace) {
          void knowledgeSpacesRepository.ingestDocument(targetSpace, doc).then((ingested) => {
            if (!ingested) return;
            set((state) => ({
              spaces: state.spaces.map((s) =>
                s.id === spaceId
                  ? {
                      ...s,
                      cloudId: ingested.cloudSpaceId,
                      documents: s.documents.map((d) =>
                        d.id === localDocId
                          ? {
                              ...d,
                              id: ingested.documentId,
                              chunkCount: ingested.chunkCount,
                              synced: true,
                            }
                          : d
                      ),
                    }
                  : s
              ),
            }));
          });
        }
      },

      removeDocument: (spaceId, docId) => {
        const targetSpace = get().spaces.find((s) => s.id === spaceId);
        const targetDoc = targetSpace?.documents.find((d) => d.id === docId);
        set((state) => ({
          spaces: state.spaces.map((s) =>
            s.id === spaceId ? { ...s, documents: s.documents.filter((d) => d.id !== docId) } : s
          ),
        }));
        if (targetDoc?.synced) {
          void knowledgeSpacesRepository.deleteCloudDocument(docId);
        }
      },

      syncFromCloud: async () => {
        set({ syncing: true });
        try {
          const cloudSpaces = await knowledgeSpacesRepository.listCloudSpaces();
          if (!cloudSpaces || cloudSpaces.length === 0) return;

          set((state) => {
            const cloudIds = new Set(cloudSpaces.map((s) => s.cloudId));
            const localOnly = state.spaces.filter((s) => !s.cloudId || !cloudIds.has(s.cloudId));
            return { spaces: [...cloudSpaces, ...localOnly] };
          });
        } catch {
          // Offline fallback
        } finally {
          set({ syncing: false });
        }
      },
    }),
    {
      name: 'papyrus.knowledge-spaces',
      storage: createJSONStorage(() => preferenceStorage),
      partialize: (state) => ({ spaces: state.spaces }),
    }
  )
);
