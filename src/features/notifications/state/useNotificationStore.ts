import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferenceStorage } from '@/composition/preferences';
import type { QuestionSet } from '@/core/domain/models';
import {
  broadcastAdminNotificationToCloud,
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
  readByUserIds?: string[];
  fromAdminConsole?: boolean;
  createdAt: string;
}

export function isNotificationReadForViewer(item: AppNotificationItem, viewerId: string): boolean {
  if (Array.isArray(item.readByUserIds)) {
    return item.readByUserIds.includes(viewerId);
  }
  return Boolean(item.read);
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
  markRead: (id: string, viewerId?: string) => void;
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
    fromAdminConsole?: boolean;
  }) => Promise<AdminGiftItem>;
  claimGift: (giftId: string, userId: string) => AdminGiftItem | null;
  syncCloudGifts: (userId?: string | null) => Promise<void>;
}

const INITIAL_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: 'welcome-papyrus-v25',
    recipientId: 'all',
    kind: 'system',
    title: 'Chào mừng đến với Papyrus 2.5!',
    body: 'Khám phá Cộng đồng Học thuật (Threads + Messenger/Zalo + Tra cứu tin mới mỗi ngày) và Đấu trường Nhập vai 3D!',
    actionRoute: '/community',
    read: false,
    readByUserIds: [],
    createdAt: '2026-11-25T00:00:00.000Z',
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
          readByUserIds: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          notifications: [entry, ...state.notifications].slice(0, 80),
        }));

        // If sent from Admin Console: broadcast to connected User devices ONLY — NEVER pop toast on the Admin session itself!
        if (item.fromAdminConsole) {
          void broadcastAdminNotificationToCloud({
            recipientId: item.recipientId,
            kind: item.kind,
            title: item.title,
            body: item.body,
            actionRoute: item.actionRoute,
          });
          return;
        }

        if (alsoSendExternal) {
          void dispatchExternalNotification(entry.title, entry.body);
        }
      },

      markRead: (id, viewerId = 'guest') => {
        set((state) => ({
          notifications: state.notifications.map((n) => {
            if (n.id !== id) return n;
            const prevIds = n.readByUserIds ?? [];
            const nextIds = prevIds.includes(viewerId) ? prevIds : [...prevIds, viewerId];
            return { ...n, read: true, readByUserIds: nextIds };
          }),
        }));
      },

      markAllRead: (userId) => {
        const viewer = userId || 'guest';
        set((state) => ({
          notifications: state.notifications.map((n) => {
            if (n.recipientId === 'all' || !userId || n.recipientId === userId) {
              const prevIds = n.readByUserIds ?? [];
              const nextIds = prevIds.includes(viewer) ? prevIds : [...prevIds, viewer];
              return { ...n, read: true, readByUserIds: nextIds };
            }
            return n;
          }),
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
            fromAdminConsole: input.fromAdminConsole ?? true,
          },
          false
        );

        void sendAdminGiftToCloud({
          recipientId: input.recipientId,
          recipientName: input.recipientName,
          giftType: input.giftType,
          title: input.title,
          message: input.message,
          questionSet: input.questionSet,
          documentText: input.documentText,
        });

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
      name: 'papyrus.notifications.v2',
      storage: createJSONStorage(() => preferenceStorage),
    }
  )
);
