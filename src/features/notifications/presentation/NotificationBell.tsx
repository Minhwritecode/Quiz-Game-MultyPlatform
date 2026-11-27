import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { usePathname, useRouter } from 'expo-router';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import {
  isNotificationReadForViewer,
  useNotificationStore,
  type AdminGiftItem,
} from '../state/useNotificationStore';
import {
  getExternalNotificationPermission,
  requestExternalNotificationPermission,
  type ExternalPermissionState,
} from '@/composition/platform';
import { dependencies } from '@/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { sfx } from '@/core/audio/sfx';

export function NotificationBell() {
  const palette = usePalette();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const isAdminAccount =
    pathname.startsWith('/admin') || user?.role === 'admin' || user?.role === 'superadmin';

  const notifications = useNotificationStore((s) => s.notifications);
  const gifts = useNotificationStore((s) => s.gifts);
  const quietModeEnabled = useNotificationStore((s) => s.quietModeEnabled);
  const groupSimilar = useNotificationStore((s) => s.groupSimilar);
  const toggleQuietMode = useNotificationStore((s) => s.toggleQuietMode);
  const toggleGroupSimilar = useNotificationStore((s) => s.toggleGroupSimilar);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismissNotification = useNotificationStore((s) => s.dismissNotification);
  const claimGift = useNotificationStore((s) => s.claimGift);
  const syncCloudGifts = useNotificationStore((s) => s.syncCloudGifts);

  const [open, setOpen] = useState(false);
  const [permState, setPermState] = useState<ExternalPermissionState>('default');
  const [statusNotice, setStatusNotice] = useState('');

  useEffect(() => {
    void getExternalNotificationPermission().then(setPermState);
  }, []);

  useEffect(() => {
    if (user?.id && !isAdminAccount) {
      void syncCloudGifts(user.id);
    }
  }, [user?.id, isAdminAccount, syncCloudGifts]);

  const userId = user?.id ?? null;

  // Only regular User accounts receive Admin broadcasts & targeted user notifications
  const myNotifications = useMemo(() => {
    if (isAdminAccount) return [];
    const visible = notifications.filter((n) => {
      if ((n.dismissedByUserIds ?? []).includes(viewerId)) return false;
      if (n.fromAdminConsole && !userId) return false;
      return n.recipientId === 'all' || (userId !== null && n.recipientId === userId);
    });
    if (!groupSimilar) return visible;
    const seenGroups = new Map<string, (typeof visible)[number] & { groupedCount?: number }>();
    const out: Array<(typeof visible)[number] & { groupedCount?: number }> = [];
    for (const item of visible) {
      const gKey = item.groupKey || `${item.kind}:${item.actionRoute || item.title}`;
      const existing = seenGroups.get(gKey);
      if (existing && (item.kind === 'reaction' || item.kind === 'comment' || item.kind === 'follow')) {
        existing.groupedCount = (existing.groupedCount ?? 1) + 1;
      } else {
        const cloned = { ...item, groupedCount: 1 };
        seenGroups.set(gKey, cloned);
        out.push(cloned);
      }
    }
    return out;
  }, [groupSimilar, isAdminAccount, notifications, userId, viewerId]);

  const myUnclaimedGifts = useMemo(() => {
    if (isAdminAccount || !userId) return [];
    return gifts.filter(
      (g) =>
        (g.recipientId === 'all' || g.recipientId === userId) &&
        !g.claimedByIds.includes(viewerId)
    );
  }, [gifts, isAdminAccount, userId, viewerId]);

  const unreadCount =
    myNotifications.filter((n) => !isNotificationReadForViewer(n, viewerId)).length +
    myUnclaimedGifts.length;

  const handleEnableExternal = async () => {
    const next = await requestExternalNotificationPermission();
    setPermState(next);
    setStatusNotice(
      next === 'granted'
        ? '✅ Đã bật thông báo đẩy! Bạn sẽ nhận tin quan trọng ngay cả khi rời ứng dụng.'
        : 'Trình duyệt/thiết bị chưa cấp quyền thông báo. Bạn vẫn nhận đủ thông báo trong ứng dụng.'
    );
  };

  const handleClaimGift = async (gift: AdminGiftItem) => {
    const claimed = claimGift(gift.id, viewerId);
    if (!claimed) return;
    if (claimed.giftType === 'question_set' && claimed.questionSet) {
      const giftedSet = {
        ...claimed.questionSet,
        id: `gift-${claimed.id}`,
        title: `🎁 ${claimed.questionSet.title}`,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const,
      };
      await saveQuestionSet(dependencies.questionSets, giftedSet).catch(() => undefined);
      usePapyrusStore.getState().saveQuestionSet(giftedSet);
      setStatusNotice(`🎉 Đã nhận bộ câu hỏi "${claimed.title}" vào Thư viện!`);
    } else if (claimed.giftType === 'study_document' && claimed.documentText) {
      usePapyrusStore.getState().saveSourceDocument({
        id: `gift-doc-${claimed.id}`,
        title: `🎁 ${claimed.title}`,
        text: claimed.documentText,
        createdAt: new Date().toISOString(),
      });
      setStatusNotice(`📄 Đã nhận tài liệu "${claimed.title}"! Sẵn sàng tạo Quiz AI.`);
    } else if (claimed.giftType === 'vip_days') {
      useMembershipStore.getState().upgradeToVip();
      setStatusNotice(`👑 Đã kích hoạt đặc quyền VIP Archmage từ Admin!`);
    } else if (claimed.giftType === 'streak_freeze') {
      useStreakStore.getState().addStreakFreeze(2);
      setStatusNotice(`❄️ Đã cộng +2 Bùa Đóng Băng Chuỗi!`);
    }
    sfx.playLevelUp();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thông báo"
        onPress={() => {
          setStatusNotice('');
          setOpen(true);
        }}
        hitSlop={6}
        style={({ pressed }) => [
          styles.bellBtn,
          {
            backgroundColor: palette.paperRaised,
            borderColor: palette.paperMuted,
            opacity: pressed ? 0.78 : 1,
            transform: pressed ? [{ scale: 0.94 }] : undefined,
          },
        ]}
      >
        <AppIcon
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={19}
          color={unreadCount > 0 ? palette.indigo : palette.inkMuted}
        />
        {unreadCount > 0 ? (
          <View style={styles.badgeDot}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheetWrap} onPress={() => undefined}>
            <Card style={[styles.sheetCard, { backgroundColor: palette.paper }]}>
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <AppIcon name="notifications" size={20} color={palette.indigo} />
                  <Text style={[typography.title, { color: palette.ink }]}>Trung tâm Thông báo</Text>
                </View>
                {unreadCount > 0 ? (
                  <Pressable onPress={() => markAllRead(viewerId)} hitSlop={8}>
                    <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                      Đọc tất cả
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setOpen(false)} hitSlop={8}>
                  <AppIcon name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              {/* Quiet Mode (DND) & Smart Grouping Controls */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
                <Pressable
                  onPress={toggleQuietMode}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: radii.pill,
                    backgroundColor: quietModeEnabled ? palette.indigo : palette.paperRaised,
                  }}
                >
                  <AppIcon
                    name={quietModeEnabled ? 'moon' : 'moon-outline'}
                    size={13}
                    color={quietModeEnabled ? '#FFFFFF' : palette.inkMuted}
                  />
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: quietModeEnabled ? '#FFFFFF' : palette.ink,
                    }}
                  >
                    {quietModeEnabled ? 'Đang bật Không làm phiền' : 'Chế độ Không làm phiền'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={toggleGroupSimilar}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: radii.pill,
                    backgroundColor: groupSimilar ? palette.indigoTint : palette.paperRaised,
                  }}
                >
                  <AppIcon name="layers-outline" size={13} color={palette.indigo} />
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                    {groupSimilar ? 'Gộp thông báo: Bật' : 'Gộp thông báo: Tắt'}
                  </Text>
                </Pressable>
              </View>

              {permState !== 'granted' && permState !== 'unsupported' ? (
                <View style={[styles.pushBanner, { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder }]}>
                  <AppIcon name="radio-outline" size={18} color={palette.indigo} />
                  <Text style={[typography.caption, { color: palette.indigoDeep, flex: 1 }]}>
                    Bật thông báo đẩy để nhận quà Admin, lời mời đấu 1v1 và nhắc giữ chuỗi ngay cả khi ở ngoài app.
                  </Text>
                  <Pressable onPress={() => void handleEnableExternal()} style={[styles.enableBtn, { backgroundColor: palette.indigo }]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Bật ngay</Text>
                  </Pressable>
                </View>
              ) : null}

              {!!statusNotice && (
                <Text style={[typography.caption, { color: palette.mint, fontWeight: '700', marginBottom: spacing.sm }]}>
                  {statusNotice}
                </Text>
              )}

              <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
                {myUnclaimedGifts.length > 0 && (
                  <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                    <Text style={[typography.label, { color: palette.gold }]}>
                      🎁 QUÀ TẶNG CHỜ NHẬN ({myUnclaimedGifts.length})
                    </Text>
                    {myUnclaimedGifts.map((gift) => (
                      <View
                        key={gift.id}
                        style={[styles.giftRow, { backgroundColor: palette.goldTint, borderColor: palette.gold }]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                            {gift.title}
                          </Text>
                          {!!gift.message && (
                            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                              {gift.message}
                            </Text>
                          )}
                        </View>
                        <Button variant="reward" onPress={() => void handleClaimGift(gift)}>
                          Nhận quà
                        </Button>
                      </View>
                    ))}
                  </View>
                )}

                {myNotifications.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                    <AppIcon name="checkmark-done-circle-outline" size={36} color={palette.inkMuted} />
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>
                      {user
                        ? 'Bạn đã xem hết mọi thông báo quan trọng.'
                        : 'Đăng nhập tài khoản học viên để nhận thông báo & quà tặng cá nhân.'}
                    </Text>
                  </View>
                ) : (
                  myNotifications.map((item) => {
                    const isRead = isNotificationReadForViewer(item, viewerId);
                    const iconName =
                      item.kind === 'gift'
                        ? 'gift'
                        : item.kind === 'duel'
                        ? 'flash'
                        : item.kind === 'streak'
                        ? 'flame'
                        : item.kind === 'update'
                        ? 'rocket'
                        : 'sparkles';
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          markRead(item.id, viewerId);
                          if (item.actionRoute) {
                            setOpen(false);
                            router.push(item.actionRoute as '/');
                          }
                        }}
                        style={[
                          styles.notifRow,
                          {
                            backgroundColor: isRead ? palette.paperRaised : palette.indigoTint,
                            borderColor: isRead ? palette.paperMuted : palette.indigoBorder,
                          },
                        ]}
                      >
                        <View style={[styles.notifIcon, { backgroundColor: palette.paper }]}>
                          <AppIcon name={iconName} size={17} color={palette.indigo} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 80 }}>
                          <Text style={[typography.caption, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                            {item.title}
                            {item.groupedCount && item.groupedCount > 1 ? ` (+${item.groupedCount - 1})` : ''}
                          </Text>
                          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]} numberOfLines={3}>
                            {item.body}
                          </Text>
                        </View>

                        {/* Top-Right Read / Unread + Dismiss Controls */}
                        <View style={[styles.topRightStatus, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                          {isRead ? (
                            <View style={[styles.readPill, { backgroundColor: palette.mintTint }]}>
                              <AppIcon name="checkmark-done-circle" size={14} color={palette.mint} />
                              <Text style={{ fontSize: 10, fontWeight: '800', color: palette.mint }}>Đã đọc</Text>
                            </View>
                          ) : (
                            <View style={[styles.unreadPill, { backgroundColor: palette.indigo }]}>
                              <View style={styles.unreadDot} />
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>Mới</Text>
                            </View>
                          )}
                          <Pressable
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Ẩn thông báo"
                            onPress={(e) => {
                              e.stopPropagation();
                              dismissNotification(item.id, viewerId);
                            }}
                          >
                            <AppIcon name="close" size={15} color={palette.inkMuted} />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheetWrap: { width: '100%', maxWidth: 460 },
  sheetCard: { borderRadius: 22, padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  enableBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  notifRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  notifIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRightStatus: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  readPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  unreadDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FDE68A',
  },
});
