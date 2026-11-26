import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dispatchExternalNotification,
  requestExternalNotificationPermission,
} from '@/features/notifications/data/pushNotifier';

const REMINDER_ENABLED_KEY = 'papyrus.reminders.enabled.v2';
const LAST_ACTIVE_AT_KEY = 'papyrus.reminders.last_active_ms.v2';
const UNFINISHED_TITLE_KEY = 'papyrus.reminders.unfinished_title.v2';
const LAST_NUDGED_AT_KEY = 'papyrus.reminders.last_nudged_ms.v2';
const TWENTY_HOURS_MS = 20 * 3600 * 1000;

function notifyServiceWorkerHeartbeat(enabled: boolean, timestamp: number, unfinishedTitle: string) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({
        type: 'PAPYRUS_HEARTBEAT',
        enabled,
        timestamp,
        unfinishedTitle,
      });
    })
    .catch(() => undefined);
}

export const reminders = {
  listen(_onOpen: () => void) {
    return () => undefined;
  },

  async enabled(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
      if (stored === null) return true;
      return stored === 'true';
    } catch {
      return false;
    }
  },

  async setEnabled(nextEnabled: boolean, _hour = 20, _minute = 0): Promise<void> {
    if (nextEnabled) {
      const perm = await requestExternalNotificationPermission();
      if (perm === 'denied') {
        throw new Error(
          'Quyền thông báo đang bị tắt trên trình duyệt. Hãy bật quyền Thông báo trong cài đặt trang web.'
        );
      }
    }
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, nextEnabled ? 'true' : 'false');
    const unfinished = (await AsyncStorage.getItem(UNFINISHED_TITLE_KEY).catch(() => '')) || '';
    const now = Date.now();
    await AsyncStorage.setItem(LAST_ACTIVE_AT_KEY, String(now));
    notifyServiceWorkerHeartbeat(nextEnabled, now, unfinished);

    if (nextEnabled) {
      await dispatchExternalNotification(
        'Đã bật nhắc ôn tập Papyrus',
        'Hệ thống sẽ nhắc nhẹ khi bạn chưa quay lại sau 20 giờ hoặc còn bộ đề làm dở.'
      );
    }
  },

  async checkAndTouchActivity(
    unfinishedTitle?: string,
    onInAppNudge?: (title: string, body: string) => void
  ): Promise<void> {
    try {
      const isEnabled = await this.enabled();
      const now = Date.now();
      const prevRaw = await AsyncStorage.getItem(LAST_ACTIVE_AT_KEY);
      const lastNudgedRaw = await AsyncStorage.getItem(LAST_NUDGED_AT_KEY);
      const savedUnfinished = unfinishedTitle ?? (await AsyncStorage.getItem(UNFINISHED_TITLE_KEY)) ?? '';

      if (unfinishedTitle !== undefined) {
        await AsyncStorage.setItem(UNFINISHED_TITLE_KEY, unfinishedTitle);
      }

      if (isEnabled && prevRaw) {
        const prevMs = Number(prevRaw);
        const lastNudgedMs = lastNudgedRaw ? Number(lastNudgedRaw) : 0;
        if (
          Number.isFinite(prevMs) &&
          now - prevMs >= TWENTY_HOURS_MS &&
          now - lastNudgedMs >= 12 * 3600 * 1000
        ) {
          const title = 'Nhắc ôn tập Papyrus';
          const body = savedUnfinished
            ? `Bộ đề "${savedUnfinished}" vẫn đang dang dở — dành vài phút hoàn thành nốt nhé.`
            : 'Đã hơn 20 giờ bạn chưa ôn bài. Mở Papyrus luyện nhanh vài câu để giữ nhịp học nhé.';
          await AsyncStorage.setItem(LAST_NUDGED_AT_KEY, String(now));
          onInAppNudge?.(title, body);
          void dispatchExternalNotification(title, body);
        }
      }

      await AsyncStorage.setItem(LAST_ACTIVE_AT_KEY, String(now));
      notifyServiceWorkerHeartbeat(isEnabled, now, savedUnfinished);
    } catch {
      // Non-fatal on restricted web storage
    }
  },
};
