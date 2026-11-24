import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import type { QuestionSet } from '@/core/domain/models';
import {
  dispatchExternalNotification,
  fetchCloudGiftsForCurrentUser,
  sendAdminGiftToCloud,
} from '@/composition/platform';

export type AppNotificationKind = 'system' | 'gift' | 'friend' | 'duel' | 'streak' | 'update';

export interface AppNotificationItem {
  id: string;
  recipientId: string | 'all';
  kind: AppNotificationKind;
  title: string;
  body: string;
  actionRoute?: string;
  read: boolean;
  createdAt: string;
}

export interface AdminGiftItem {
  id: string;
  recipientId: string; // specific userId or 'all'
  recipientName: string;
  giftType: 'question_set' | 'study_document' | 'vip_days' | 'streak_freeze';
  title: string;
  message: string;
  questionSet?: QuestionSet;
  documentText?: string;
  claimedByIds: string[];
  createdAt: string;
}

interface NotificationState {
  notifications: AppNotificationItem[];
  gifts: AdminGiftItem[];
  pushNotification: (
    item: Omit<AppNotificationItem, 'id' | 'read' | 'createdAt'>,
    alsoSendExternal?: boolean
  ) => void;
  markRead: (id: string) => void;
  markAllRead: (userId?: string | null) => void;
  clearNotifications: () => void;
  sendGift: (input: {
    recipientId: string;
    recipientName: string;
    giftType: AdminGiftItem['giftType'];
    title: string;
    message: string;
    questionSet?: QuestionSet;
    documentText?: string;
  }) => Promise<AdminGiftItem>;
  claimGift: (giftId: string, userId: string) => AdminGiftItem | null;
  syncCloudGifts: (userId?: string | null) => Promise<void>;
}

const INITIAL_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: 'welcome-papyrus-v24',
    recipientId: 'all',
    kind: 'system',
    title: 'Chào mừng đến với Papyrus 2.4!',
    body: '20 bộ câu hỏi Đại học (IT, Lịch sử, Sinh – Lý – Hóa, Văn học) & đấu trường 3D đầy màu sắc đã sẵn sàng trong Thư viện của bạn.',
    actionRoute: '/sets',
    read: false,
    createdAt: '2026-11-24T00:00:00.000Z',
  },
];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,
      gifts: [],

      pushNotification: (item, alsoSendExternal = true) => {
        const entry: AppNotificationItem = {
          ...item,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          notifications: [entry, ...state.notifications].slice(0, 60),
        }));
        if (alsoSendExternal) {
          void dispatchExternalNotification(entry.title, entry.body);
        }
      },

      markRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }));
      },

      markAllRead: (userId) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.recipientId === 'all' || !userId || n.recipientId === userId
              ? { ...n, read: true }
              : n
          ),
        }));
      },

      clearNotifications: () => set({ notifications: [] }),

      sendGift: async (input) => {
        const gift: AdminGiftItem = {
          id: `gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          recipientId: input.recipientId,
          recipientName: input.recipientName,
          giftType: input.giftType,
          title: input.title,
          message: input.message,
          questionSet: input.questionSet,
          documentText: input.documentText,
          claimedByIds: [],
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          gifts: [gift, ...state.gifts].slice(0, 100),
        }));

        get().pushNotification(
          {
            recipientId: input.recipientId,
            kind: 'gift',
            title: `🎁 Quà tặng từ Admin: ${input.title}`,
            body:
              input.message ||
              `Quản trị viên đã gửi tặng bạn "${input.title}". Mở hộp thư hoặc Hồ sơ để nhận ngay!`,
            actionRoute: '/profile',
          },
          true
        );

        if (input.recipientId !== 'all') {
          void sendAdminGiftToCloud({
            recipientId: input.recipientId,
            recipientName: input.recipientName,
            giftType: input.giftType,
            title: input.title,
            message: input.message,
            questionSet: input.questionSet,
            documentText: input.documentText,
          });
        }

        return gift;
      },

      claimGift: (giftId, userId) => {
        const target = get().gifts.find((g) => g.id === giftId);
        if (!target) return null;
        if (target.claimedByIds.includes(userId)) return target;
        set((state) => ({
          gifts: state.gifts.map((g) =>
            g.id === giftId ? { ...g, claimedByIds: [...g.claimedByIds, userId] } : g
          ),
        }));
        return target;
      },

      syncCloudGifts: async (userId) => {
        if (!userId) return;
        const remote = await fetchCloudGiftsForCurrentUser();
        if (remote.length === 0) return;
        set((state) => {
          const existingIds = new Set(state.gifts.map((g) => g.id));
          const merged = [...state.gifts];
          for (const r of remote) {
            if (!existingIds.has(r.id)) {
              merged.unshift({
                id: r.id,
                recipientId: r.recipientId,
                recipientName: r.recipientName,
                giftType: r.giftType,
                title: r.title,
                message: r.message,
                questionSet: r.questionSet,
                documentText: r.documentText,
                claimedByIds: r.claimed ? [userId] : [],
                createdAt: r.createdAt,
              });
            }
          }
          return { gifts: merged.slice(0, 100) };
        });
      },
    }),
    {
      name: 'papyrus.notifications.v1',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
