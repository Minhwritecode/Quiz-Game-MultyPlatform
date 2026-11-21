import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/core/network/supabase';
import type { GeneratedQuiz, QuizDifficulty } from '../domain/models';

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: 'pdf' | 'md' | 'txt' | 'note';
  excerpt: string;
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

async function ensureCloudSpace(space: KnowledgeSpace): Promise<string | null> {
  if (!supabase) return null;
  if (space.cloudId) return space.cloudId;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: created } = await supabase
      .from('knowledge_spaces')
      .insert({
        owner_id: userData.user.id,
        name: space.name,
        subject: space.subject,
      })
      .select('id')
      .single();
    return created?.id ? String(created.id) : null;
  } catch {
    return null;
  }
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
        void ensureCloudSpace(space).then((cloudId) => {
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
        if (supabase && target?.cloudId) {
          void Promise.resolve(supabase.from('knowledge_spaces').delete().eq('id', target.cloudId)).catch(
            () => undefined
          );
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
        if (supabase && targetSpace) {
          void (async () => {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (!sessionData.session) return;
              const cloudSpaceId = await ensureCloudSpace(targetSpace);
              if (!cloudSpaceId) return;

              const { data: ingested, error } = await supabase.functions.invoke('rag-ingest', {
                body: {
                  space_id: cloudSpaceId,
                  space_name: targetSpace.name,
                  space_subject: targetSpace.subject,
                  name: doc.name,
                  kind: doc.kind,
                  raw_text: doc.excerpt,
                },
              });

              if (!error && ingested?.document?.id) {
                set((state) => ({
                  spaces: state.spaces.map((s) =>
                    s.id === spaceId
                      ? {
                          ...s,
                          cloudId: cloudSpaceId,
                          documents: s.documents.map((d) =>
                            d.id === localDocId
                              ? {
                                  ...d,
                                  id: String(ingested.document.id),
                                  chunkCount: Number(ingested.chunk_count ?? ingested.document.chunk_count ?? 1),
                                  synced: true,
                                }
                              : d
                          ),
                        }
                      : s
                  ),
                }));
              }
            } catch {
              // Keep local document available offline
            }
          })();
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
        if (supabase && targetDoc?.synced) {
          void Promise.resolve(supabase.from('knowledge_documents').delete().eq('id', docId)).catch(
            () => undefined
          );
        }
      },

      syncFromCloud: async () => {
        if (!supabase) return;
        set({ syncing: true });
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) return;

          const [{ data: spaceRows }, { data: docRows }] = await Promise.all([
            supabase
              .from('knowledge_spaces')
              .select('id, name, subject, created_at')
              .order('updated_at', { ascending: false })
              .limit(30),
            supabase
              .from('knowledge_documents')
              .select('id, space_id, name, kind, excerpt, chunk_count, created_at')
              .order('created_at', { ascending: false })
              .limit(120),
          ]);

          if (!Array.isArray(spaceRows) || spaceRows.length === 0) return;

          const docsBySpace = new Map<string, KnowledgeDoc[]>();
          for (const row of Array.isArray(docRows) ? docRows : []) {
            const sid = String(row.space_id ?? '');
            const list = docsBySpace.get(sid) ?? [];
            list.push({
              id: String(row.id),
              name: String(row.name ?? 'Document'),
              kind: (row.kind as KnowledgeDoc['kind']) ?? 'note',
              excerpt: String(row.excerpt ?? ''),
              chunkCount: Number(row.chunk_count ?? 0),
              synced: true,
              addedAt: String(row.created_at ?? new Date().toISOString()),
            });
            docsBySpace.set(sid, list);
          }

          const cloudSpaces: KnowledgeSpace[] = spaceRows.map((row) => {
            const cid = String(row.id);
            return {
              id: cid,
              cloudId: cid,
              name: String(row.name ?? 'Kho tri thức'),
              subject: String(row.subject ?? 'Tổng hợp'),
              documents: docsBySpace.get(cid) ?? [],
              createdAt: String(row.created_at ?? new Date().toISOString()),
            };
          });

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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ spaces: state.spaces }),
    }
  )
);
