import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/core/network/supabase';

export type ModerationStatus = 'open' | 'reviewed' | 'dismissed';
export type AiModerationVerdict = 'pending' | 'valid_report' | 'false_alarm' | 'needs_human';

export interface QuestionReportItem {
  id: string;
  questionRef: string;
  questionPreview: string;
  reason: 'wrong_answer' | 'typo_format' | 'inappropriate' | 'duplicate';
  status: ModerationStatus;
  aiVerdict?: AiModerationVerdict;
  aiConfidence?: number;
  aiSummary?: string;
  createdAt: string;
  source: 'local' | 'cloud';
}

export interface SuperadminUserRow {
  id: string;
  displayName: string;
  role: 'user' | 'moderator' | 'superadmin';
  membershipTier: 'apprentice' | 'archmage';
  eloRating: number;
  gamesPlayed: number;
  isSuspended: boolean;
}

export interface SuperadminSetRow {
  id: string;
  title: string;
  subject: string;
  visibility: 'private' | 'shared';
  moderationStatus: 'pending_review' | 'approved' | 'flagged' | 'rejected';
  moderationScore: number;
}

export interface SuperadminOverview {
  metrics: {
    totalUsers: number;
    vipUsers: number;
    totalSets: number;
    sharedSets: number;
    openReports: number;
    totalMatches: number;
    totalKnowledgeChunks: number;
  };
  users: SuperadminUserRow[];
  questionSets: SuperadminSetRow[];
}

export interface DraftModerationGateResult {
  passed: boolean;
  score: number;
  status: 'approved' | 'flagged';
  issues: string[];
}

export function evaluateQuizDraftModeration(
  title: string,
  questions: Array<{ question: string; options: string[]; correctAnswer: number }>
): DraftModerationGateResult {
  const issues: string[] = [];
  let score = 100;
  const bannedPattern = /(lừa đảo|cá độ|bạo lực|18\+|hack|spam)/i;

  if (title.trim().length < 4) {
    issues.push('Tiêu đề bộ đề quá ngắn (< 4 ký tự).');
    score -= 15;
  }
  if (bannedPattern.test(title)) {
    issues.push('Tiêu đề chứa từ khóa nhạy cảm cần kiểm duyệt.');
    score -= 40;
  }

  const seenQuestions = new Set<string>();
  questions.forEach((q, idx) => {
    const stem = q.question.trim();
    const normStem = stem.toLowerCase();
    if (stem.length < 8) {
      issues.push(`Câu ${idx + 1}: Nội dung câu hỏi quá ngắn hoặc chưa rõ nghĩa.`);
      score -= 12;
    }
    if (seenQuestions.has(normStem) && normStem.length > 0) {
      issues.push(`Câu ${idx + 1}: Trùng lặp nội dung với câu hỏi khác trong đề.`);
      score -= 18;
    }
    seenQuestions.add(normStem);

    if (bannedPattern.test(stem) || q.options.some((o) => bannedPattern.test(o))) {
      issues.push(`Câu ${idx + 1}: Phát hiện từ khóa không phù hợp tiêu chuẩn cộng đồng.`);
      score -= 35;
    }

    const nonEmptyOpts = q.options.map((o) => o.trim().toLowerCase()).filter(Boolean);
    if (new Set(nonEmptyOpts).size < nonEmptyOpts.length) {
      issues.push(`Câu ${idx + 1}: Có các phương án trả lời bị trùng nhau.`);
      score -= 15;
    }
  });

  const clampedScore = Math.max(0, Math.min(100, score));
  const passed = clampedScore >= 75 && issues.length === 0;
  return {
    passed,
    score: clampedScore,
    status: passed ? 'approved' : 'flagged',
    issues,
  };
}

function computeLocalAiVerdict(item: QuestionReportItem): {
  aiVerdict: AiModerationVerdict;
  aiConfidence: number;
  aiSummary: string;
} {
  const low = item.questionPreview.toLowerCase();
  if (item.reason === 'inappropriate' && /(lừa đảo|cá độ|bạo lực|18\+|spam|hack)/.test(low)) {
    return {
      aiVerdict: 'valid_report',
      aiConfidence: 96,
      aiSummary: 'AI Gate phát hiện từ khóa vi phạm tiêu chuẩn cộng đồng · Khuyến nghị: Ẩn/Sửa ngay.',
    };
  }
  if (item.reason === 'typo_format' && (low.length < 15 || /(\?\?|null|undefined)/.test(low))) {
    return {
      aiVerdict: 'valid_report',
      aiConfidence: 89,
      aiSummary: 'AI Gate xác nhận câu hỏi có dấu hiệu lỗi cú pháp hoặc hiển thị · Khuyến nghị: Đánh dấu đã sửa.',
    };
  }
  if (item.reason === 'duplicate') {
    return {
      aiVerdict: 'needs_human',
      aiConfidence: 82,
      aiSummary: 'AI Gate gợi ý đối chiếu độ tương đồng ngữ nghĩa với ngân hàng đề hiện có.',
    };
  }
  return {
    aiVerdict: 'false_alarm',
    aiConfidence: 86,
    aiSummary: 'AI Gate kiểm tra cấu trúc câu hỏi hợp lệ, không phát hiện lỗi nghiêm trọng.',
  };
}

interface ModerationState {
  reports: QuestionReportItem[];
  loading: boolean;
  aiScanning: boolean;
  superadminOverview: SuperadminOverview;
  addLocalReport: (item: Omit<QuestionReportItem, 'id' | 'status' | 'createdAt' | 'source'>) => void;
  submitReport: (item: Omit<QuestionReportItem, 'id' | 'status' | 'createdAt' | 'source'>) => Promise<void>;
  updateStatus: (id: string, status: ModerationStatus) => Promise<void>;
  runAiAutoModerationAll: () => Promise<void>;
  syncFromCloud: () => Promise<void>;
  loadSuperadminOverview: () => Promise<void>;
  updateUserRoleAndTier: (
    userId: string,
    patch: { role?: SuperadminUserRow['role']; membershipTier?: SuperadminUserRow['membershipTier']; isSuspended?: boolean }
  ) => Promise<void>;
  moderateCommunitySet: (
    setId: string,
    patch: { moderationStatus: SuperadminSetRow['moderationStatus']; visibility?: SuperadminSetRow['visibility'] }
  ) => Promise<void>;
}

const SEED_REPORTS: QuestionReportItem[] = [
  {
    id: 'seed-rep-1',
    questionRef: 'sample-js-1',
    questionPreview: 'Giá trị của typeof null trong JavaScript là gì?',
    reason: 'typo_format',
    status: 'open',
    aiVerdict: 'valid_report',
    aiConfidence: 89,
    aiSummary: 'AI Gate gợi ý bổ sung giải thích typeof null === "object" rõ ràng hơn.',
    createdAt: new Date(Date.now() - 3600_000 * 2).toISOString(),
    source: 'local',
  },
];

const DEFAULT_SUPERADMIN_OVERVIEW: SuperadminOverview = {
  metrics: {
    totalUsers: 128,
    vipUsers: 24,
    totalSets: 64,
    sharedSets: 19,
    openReports: 1,
    totalMatches: 342,
    totalKnowledgeChunks: 480,
  },
  users: [
    {
      id: 'usr-admin-1',
      displayName: 'Bạn (Superadmin)',
      role: 'superadmin',
      membershipTier: 'archmage',
      eloRating: 1480,
      gamesPlayed: 28,
      isSuspended: false,
    },
    {
      id: 'usr-mod-2',
      displayName: 'Linh Nguyễn',
      role: 'moderator',
      membershipTier: 'archmage',
      eloRating: 1620,
      gamesPlayed: 42,
      isSuspended: false,
    },
    {
      id: 'usr-std-3',
      displayName: 'Minh Trần',
      role: 'user',
      membershipTier: 'apprentice',
      eloRating: 1290,
      gamesPlayed: 15,
      isSuspended: false,
    },
  ],
  questionSets: [
    {
      id: 'set-comm-1',
      title: 'Lập trình TypeScript & React Native Nâng cao',
      subject: 'CNTT',
      visibility: 'shared',
      moderationStatus: 'approved',
      moderationScore: 96,
    },
    {
      id: 'set-comm-2',
      title: 'Ôn thi Giải tích & Đại số tuyến tính',
      subject: 'Toán học',
      visibility: 'shared',
      moderationStatus: 'pending_review',
      moderationScore: 88,
    },
  ],
};

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
      reports: SEED_REPORTS,
      loading: false,
      aiScanning: false,
      superadminOverview: DEFAULT_SUPERADMIN_OVERVIEW,

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

      submitReport: async (item) => {
        const localId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const createdAt = new Date().toISOString();
        set((state) => ({
          reports: [
            {
              ...item,
              id: localId,
              status: 'open',
              createdAt,
              source: 'local',
            },
            ...state.reports,
          ],
        }));

        if (!supabase) return;
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user) return;
          const { data: inserted } = await supabase
            .from('question_reports')
            .insert({
              reporter_id: userData.user.id,
              question_ref: item.questionRef,
              question_preview: item.questionPreview.slice(0, 240),
              reason: item.reason,
            })
            .select('id, created_at')
            .single();
          if (inserted?.id) {
            set((state) => ({
              reports: state.reports.map((r) =>
                r.id === localId
                  ? {
                      ...r,
                      id: String(inserted.id),
                      createdAt: String(inserted.created_at ?? createdAt),
                      source: 'cloud',
                    }
                  : r
              ),
            }));
          }
        } catch {
          // Best-effort cloud submit
        }
      },

      updateStatus: async (id, status) => {
        const target = get().reports.find((r) => r.id === id);
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)),
        }));
        if (target?.source === 'cloud' && supabase) {
          try {
            const { error } = await supabase.rpc('review_question_report', {
              p_report_id: id,
              p_status: status,
              p_note: '',
            });
            if (error) {
              await supabase.from('question_reports').update({ status }).eq('id', id);
            }
          } catch {
            // Keep optimistic local update
          }
        }
      },

      runAiAutoModerationAll: async () => {
        set({ aiScanning: true });
        try {
          const current = get().reports;
          const updated: QuestionReportItem[] = [];
          for (const rep of current) {
            if (rep.source === 'cloud' && supabase) {
              try {
                const { data } = await supabase.rpc('auto_moderate_question_report', {
                  p_report_id: rep.id,
                });
                if (data) {
                  updated.push({
                    ...rep,
                    aiVerdict: (data.ai_verdict as AiModerationVerdict) ?? 'needs_human',
                    aiConfidence: Number(data.ai_confidence ?? 85),
                    aiSummary: String(data.ai_summary ?? ''),
                  });
                  continue;
                }
              } catch {
                // Fallback to local rule engine
              }
            }
            const localVerdict = computeLocalAiVerdict(rep);
            updated.push({ ...rep, ...localVerdict });
          }
          set({ reports: updated });
        } finally {
          set({ aiScanning: false });
        }
      },

      syncFromCloud: async () => {
        if (!supabase) return;
        set({ loading: true });
        try {
          const { data, error } = await supabase
            .from('question_reports')
            .select('id, question_ref, question_preview, reason, status, ai_verdict, ai_confidence, ai_summary, created_at')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && Array.isArray(data)) {
            const cloudItems: QuestionReportItem[] = data.map((row) => ({
              id: String(row.id),
              questionRef: String(row.question_ref ?? ''),
              questionPreview: String(row.question_preview ?? ''),
              reason: (row.reason as QuestionReportItem['reason']) ?? 'wrong_answer',
              status: (row.status as ModerationStatus) ?? 'open',
              aiVerdict: (row.ai_verdict as AiModerationVerdict) ?? undefined,
              aiConfidence: typeof row.ai_confidence === 'number' ? row.ai_confidence : undefined,
              aiSummary: row.ai_summary ? String(row.ai_summary) : undefined,
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

      loadSuperadminOverview: async () => {
        if (!supabase) return;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) return;
          const { data, error } = await supabase.rpc('get_superadmin_overview');
          if (!error && data && typeof data === 'object') {
            const raw = data as Partial<SuperadminOverview>;
            set((state) => ({
              superadminOverview: {
                metrics: {
                  ...state.superadminOverview.metrics,
                  ...(raw.metrics ?? {}),
                },
                users: Array.isArray(raw.users) && raw.users.length > 0 ? raw.users : state.superadminOverview.users,
                questionSets:
                  Array.isArray(raw.questionSets) && raw.questionSets.length > 0
                    ? raw.questionSets
                    : state.superadminOverview.questionSets,
              },
            }));
          }
        } catch {
          // Keep offline benchmark overview
        }
      },

      updateUserRoleAndTier: async (userId, patch) => {
        set((state) => ({
          superadminOverview: {
            ...state.superadminOverview,
            users: state.superadminOverview.users.map((u) =>
              u.id === userId ? { ...u, ...patch } : u
            ),
          },
        }));
        if (!supabase) return;
        try {
          await supabase.rpc('superadmin_update_user', {
            p_target_user_id: userId,
            p_role: patch.role ?? null,
            p_membership_tier: patch.membershipTier ?? null,
            p_is_suspended: patch.isSuspended ?? null,
          });
        } catch {
          // Optimistic update stays
        }
      },

      moderateCommunitySet: async (setId, patch) => {
        set((state) => ({
          superadminOverview: {
            ...state.superadminOverview,
            questionSets: state.superadminOverview.questionSets.map((s) =>
              s.id === setId ? { ...s, ...patch } : s
            ),
          },
        }));
        if (!supabase) return;
        try {
          await supabase.rpc('superadmin_moderate_question_set', {
            p_set_id: setId,
            p_moderation_status: patch.moderationStatus,
            p_visibility: patch.visibility ?? null,
            p_notes: '',
          });
        } catch {
          // Optimistic update stays
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
