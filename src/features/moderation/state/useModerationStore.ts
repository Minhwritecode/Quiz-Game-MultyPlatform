import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import { moderationRepository } from '@/composition/platform';
import type {
  AiModerationVerdict,
  DraftModerationGateResult,
  ModerationStatus,
  QuestionReportItem,
  SuperadminOverview,
  SuperadminSetRow,
  SuperadminUserRow,
} from '../domain/models';

export type {
  AiModerationVerdict,
  DraftModerationGateResult,
  ModerationStatus,
  QuestionReportItem,
  SuperadminOverview,
  SuperadminSetRow,
  SuperadminUserRow,
};

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

        const inserted = await moderationRepository.insertReport(item);
        if (inserted) {
          set((state) => ({
            reports: state.reports.map((r) =>
              r.id === localId
                ? {
                    ...r,
                    id: inserted.id,
                    createdAt: inserted.createdAt,
                    source: 'cloud',
                  }
                : r
            ),
          }));
        }
      },

      updateStatus: async (id, status) => {
        const target = get().reports.find((r) => r.id === id);
        set((state) => ({
          reports: state.reports.map((r) => (r.id === id ? { ...r, status } : r)),
        }));
        if (target?.source === 'cloud') {
          await moderationRepository.updateReportStatus(id, status);
        }
      },

      runAiAutoModerationAll: async () => {
        set({ aiScanning: true });
        try {
          const current = get().reports;
          const updated: QuestionReportItem[] = [];
          for (const rep of current) {
            if (rep.source === 'cloud') {
              const cloudVerdict = await moderationRepository.autoModerateReport(rep.id);
              if (cloudVerdict) {
                updated.push({ ...rep, ...cloudVerdict });
                continue;
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
        set({ loading: true });
        try {
          const cloudItems = await moderationRepository.listCloudReports();
          if (cloudItems) {
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
        const raw = await moderationRepository.fetchSuperadminOverview();
        if (raw) {
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
        await moderationRepository.updateSuperadminUser(userId, patch);
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
        await moderationRepository.moderateCommunitySet(setId, patch);
      },
    }),
    {
      name: 'papyrus.moderation',
      storage: createJSONStorage(() => preferenceStorage),
      partialize: (state) => ({ reports: state.reports }),
    }
  )
);
