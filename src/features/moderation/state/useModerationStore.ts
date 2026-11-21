import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/core/network/supabase';

export type ModerationStatus = 'open' | 'reviewed' | 'dismissed';

export interface QuestionReportItem {
  id: string;
  questionRef: string;
  questionPreview: string;
  reason: 'wrong_answer' | 'typo_format' | 'inappropriate' | 'duplicate';
  status: ModerationStatus;
  createdAt: string;
  source: 'local' | 'cloud';
}

interface ModerationState {
  reports: QuestionReportItem[];
  loading: boolean;
  addLocalReport: (item: Omit<QuestionReportItem, 'id' | 'status' | 'createdAt' | 'source'>) => void;
  updateStatus: (id: string, status: ModerationStatus) => Promise<void>;
  syncFromCloud: () => Promise<void>;
}

const SEED_REPORTS: QuestionReportItem[] = [
  {
    id: 'seed-rep-1',
    questionRef: 'sample-js-1',
    questionPreview: 'Giá trị của typeof null trong JavaScript là gì?',
    reason: 'typo_format',
    status: 'open',
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    source: 'local',
  },
];

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
      reports: SEED_REPORTS,
      loading: false,

      addLocalReport: (item) =>
        set((state) => ({
          reports: [
            {
              ...item,
              id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              status: 'open',
              createdAt: new Date().toISOString(),
              source: 'local',
            },
            ...state.reports,
          ],
        })),

      updateStatus: async (id, status) => {
        const target = get().reports.find((r) => r.id === id);
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)),
        }));
        if (target?.source === 'cloud' && supabase) {
          try {
            await supabase.from('question_reports').update({ status }).eq('id', id);
          } catch {
            // Keep optimistic local update
          }
        }
      },

      syncFromCloud: async () => {
        if (!supabase) return;
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('question_reports')
            .select('id, question_ref, question_preview, reason, status, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && Array.isArray(data)) {
            const cloudItems: QuestionReportItem[] = data.map((row) => ({
              id: String(row.id),
              questionRef: String(row.question_ref ?? ''),
              questionPreview: String(row.question_preview ?? ''),
              reason: (row.reason as QuestionReportItem['reason']) ?? 'wrong_answer',
              status: (row.status as ModerationStatus) ?? 'open',
              createdAt: String(row.created_at ?? new Date().toISOString()),
              source: 'cloud',
            }));
            set((state) => {
              const cloudIds = new Set(cloudItems.map((c) => c.id));
              const localOnly = state.reports.filter((r) => r.source === 'local' && !cloudIds.has(r.id));
              return { reports: [...cloudItems, ...localOnly] };
            });
          }
        } catch {
          // Offline fallback
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'papyrus.moderation',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ reports: state.reports }),
    }
  )
);
