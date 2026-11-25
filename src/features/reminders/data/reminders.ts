import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { dispatchExternalNotification, requestExternalNotificationPermission } from '@/features/notifications/data/pushNotifier';

const REMINDER_ENABLED_KEY = 'papyrus.reminders.enabled.v2';
const LAST_ACTIVE_AT_KEY = 'papyrus.reminders.last_active_ms.v2';
const UNFINISHED_TITLE_KEY = 'papyrus.reminders.unfinished_title.v2';
const LAST_NUDGED_AT_KEY = 'papyrus.reminders.last_nudged_ms.v2';
const TWENTY_HOURS_SECONDS = 20 * 3600;
const TWENTY_HOURS_MS = TWENTY_HOURS_SECONDS * 1000;

function notifyServiceWorkerHeartbeat(enabled: boolean, timestamp: number, unfinishedTitle: string) {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      reg.active?.postMessage({
        type: 'PAPYRUS_HEARTBEAT',
        enabled,
        timestamp,
        unfinishedTitle,
      });
      const periodicReg = reg as unknown as {
        periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
      };
      if (enabled && periodicReg.periodicSync) {
        periodicReg.periodicSync
          .register('papyrus-20h-reminder', { minInterval: 12 * 3600 * 1000 })
          .catch(() => undefined);
      }
    })
    .catch(() => undefined);
}

async function scheduleNativeSmartNotifications(unfinishedTitle?: string) {
  if (Platform.OS === 'web') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 1. Duolingo-style 20-hour inactivity reminder (always rescheduled forward when user is active!)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔥 Đừng để vụt mất chuỗi học tập Papyrus!',
        body: unfinishedTitle
          ? `📜 Bộ đề "${unfinishedTitle}" vẫn đang dang dở! Vào hoàn thành nốt 3 phút nhé!`
          : '🦉 Đã 20 giờ bạn chưa ghé Đấu trường Papyrus! Vào ôn nhanh 3 phút để giữ vững chuỗi Streak hôm nay nhé!',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: TWENTY_HOURS_SECONDS,
        repeats: false,
      },
    });

    // 2. If user has an unfinished lesson, also schedule a gentle 2-hour follow-up nudge
    if (unfinishedTitle) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📜 Bài học của bạn vẫn đang chờ hoàn tất!',
          body: `Quay lại hoàn thành nốt bộ đề "${unfinishedTitle}" để nhận trọn vẹn XP nào!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2 * 3600,
          repeats: false,
        },
      });
    }
  } catch {
    // Non-fatal on simulators without notification entitlement
  }
}

export const reminders = {
  listen(onOpen: () => void) {
    if (Platform.OS === 'web') return () => undefined;
    try {
      const sub = Notifications.addNotificationResponseReceivedListener(() => {
        onOpen();
      });
      return () => sub.remove();
    } catch {
      return () => undefined;
    }
  },

  async enabled(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
      if (stored === null) return true; // Smart reminders enabled by default (Duolingo standard)
      return stored === 'true';
    } catch {
      return false;
    }
  },

  async setEnabled(nextEnabled: boolean, _hour = 20, _minute = 0): Promise<void> {
    if (nextEnabled) {
      const perm = await requestExternalNotificationPermission();
      if (perm === 'denied') {
        throw new Error('Quyền thông báo đang bị tắt trên trình duyệt/thiết bị. Hãy bật quyền Thông báo trong Cài đặt hệ thống.');
      }
    }
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, nextEnabled ? 'true' : 'false');
    const unfinished = (await AsyncStorage.getItem(UNFINISHED_TITLE_KEY).catch(() => '')) || '';
    const now = Date.now();
    await AsyncStorage.setItem(LAST_ACTIVE_AT_KEY, String(now));
    notifyServiceWorkerHeartbeat(nextEnabled, now, unfinished);

    if (nextEnabled) {
      await scheduleNativeSmartNotifications(unfinished || undefined);
      await dispatchExternalNotification(
        '🦉 Đã bật Nhắc học thông minh Papyrus (20h)',
        'Papybot sẽ tự động nhắc khi bạn vắng mặt quá 20 giờ hoặc còn bài học dang dở!'
      );
    } else if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
    }
  },

  /**
   * Checks whether >= 20h elapsed since previous activity (or unfinished study exists),
   * dispatches a Duolingo-style nudge if overdue, and resets the rolling 20h countdown.
   */
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
          const title = '🔥 Đừng để mất chuỗi Streak Papyrus!';
          const body = savedUnfinished
            ? `📜 Đã hơn 20 giờ bạn chưa quay lại — bộ đề "${savedUnfinished}" vẫn còn dang dở kìa!`
            : '🦉 Đã hơn 20 giờ bạn chưa ghé Papyrus! Dành 3 phút ôn nhanh hoặc bắn Cung Thủ 3D ngay nhé!';
          await AsyncStorage.setItem(LAST_NUDGED_AT_KEY, String(now));
          onInAppNudge?.(title, body);
          void dispatchExternalNotification(title, body);
        }
      }

      await AsyncStorage.setItem(LAST_ACTIVE_AT_KEY, String(now));
      notifyServiceWorkerHeartbeat(isEnabled, now, savedUnfinished);
      if (isEnabled) {
        await scheduleNativeSmartNotifications(savedUnfinished || undefined);
      }
    } catch {
      // Non-fatal
    }
  },
};
