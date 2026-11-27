import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStreakStore } from '../state/useStreakStore';
import { getLocalDateString, reconcileStreakWithHistory } from '../domain/models';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { Button, Card, usePalette } from '@/shared/ui';
import { sfx } from '@/core/audio/sfx';

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function StreakBadge() {
  const router = useRouter();
  const palette = usePalette();
  const [modalVisible, setModalVisible] = useState(false);

  const rawCurrentStreak = useStreakStore((state) => state.currentStreak);
  const rawLongestStreak = useStreakStore((state) => state.longestStreak);
  const lastActiveDate = useStreakStore((state) => state.lastActiveDate);
  const todayCompleted = useStreakStore((state) => state.todayCompleted);
  const status = useStreakStore((state) => state.status);
  const streakFreezeCount = useStreakStore((state) => state.streakFreezeCount);
  const brokenStreakDays = useStreakStore((state) => state.brokenStreakDays);
  const recoveryQuestAvailable = useStreakStore((state) => state.recoveryQuestAvailable);
  const historyDates = useStreakStore((state) => state.historyDates);
  const checkInToday = useStreakStore((state) => state.checkInToday);
  const recoverStreakWithQuest = useStreakStore((state) => state.recoverStreakWithQuest);

  const reconciled = useMemo(
    () =>
      reconcileStreakWithHistory(historyDates, getLocalDateString(), {
        allowFrozenGap: status === 'frozen',
        fallbackLastActiveDate: lastActiveDate,
        fallbackCurrentStreak: rawCurrentStreak,
      }),
    [historyDates, lastActiveDate, rawCurrentStreak, status]
  );

  const currentStreak =
    status === 'broken'
      ? 0
      : reconciled.normalizedDates.length > 0 && status !== 'frozen'
      ? reconciled.consecutiveDays
      : rawCurrentStreak;
  const longestStreak = Math.max(rawLongestStreak, currentStreak, reconciled.longestInHistory);

  const last7Days = useMemo(() => {
    const set = new Set(reconciled.normalizedDates);
    const out: Array<{ key: string; label: string; done: boolean; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = getLocalDateString(d);
      out.push({
        key,
        label: DAY_LABELS[d.getDay()] ?? 'T',
        done: set.has(key),
        isToday: i === 0,
      });
    }
    return out;
  }, [reconciled.normalizedDates]);

  const getPillData = () => {
    if (status === 'broken' && recoveryQuestAvailable) {
      return { label: '🪶 Cứu chuỗi', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.14)' };
    }
    if (status === 'frozen') {
      return { label: `❄️ ${currentStreak}`, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)' };
    }
    if (todayCompleted) {
      return { label: `🔥 ${currentStreak}`, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)' };
    }
    return {
      label: currentStreak > 0 ? `⚡ ${currentStreak}` : 'Điểm danh',
      color: '#EAB308',
      bg: 'rgba(234, 179, 8, 0.14)',
    };
  };

  const pill = getPillData();

  const handleDailyCheckIn = () => {
    const res = checkInToday();
    if (res.streakUpdated) {
      sfx.playLevelUp();
    }
  };

  const handleClaimRecovery = () => {
    const success = recoverStreakWithQuest();
    if (success) {
      sfx.playLevelUp();
      setModalVisible(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Chuỗi học tập: ${currentStreak} ngày`}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: pill.bg,
            borderColor: pill.color,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[typography.caption, { color: pill.color, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
          {pill.label}
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={{ width: '100%', maxWidth: 420 }} onPress={() => undefined}>
            <Card style={[styles.modalContent, { backgroundColor: palette.paper }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 42 }}>
                  {status === 'broken' ? '💔' : todayCompleted ? '🔥' : '⚡'}
                </Text>
                <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs, textAlign: 'center' }]}>
                  {status === 'broken'
                    ? 'Chuỗi vừa gián đoạn'
                    : todayCompleted
                    ? `Chuỗi ${currentStreak} ngày liên tiếp!`
                    : currentStreak > 0
                    ? `Điểm danh giữ chuỗi ${currentStreak} ngày`
                    : 'Bắt đầu chuỗi học tập hôm nay'}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                  {todayCompleted
                    ? 'Bạn đã điểm danh / hoàn thành hoạt động hôm nay. Quay lại vào ngày mai để nối dài chuỗi!'
                    : 'Điểm danh 1 chạm hoặc chơi 1 ván game / quét OCR để tính chuỗi ngày hôm nay.'}
                </Text>
              </View>

              {/* 7-day visual calendar strip */}
              <View style={[styles.weekStrip, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                {last7Days.map((day) => (
                  <View key={day.key} style={styles.dayCol}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: day.isToday ? palette.indigo : palette.inkMuted }}>
                      {day.label}
                    </Text>
                    <View
                      style={[
                        styles.dayDot,
                        {
                          backgroundColor: day.done ? '#F59E0B' : palette.paperMuted,
                          borderColor: day.isToday ? palette.indigo : 'transparent',
                          borderWidth: day.isToday ? 2 : 0,
                        },
                      ]}
                    >
                      {day.done ? (
                        <Ionicons name="flame" size={14} color="#FFFFFF" />
                      ) : (
                        <View style={styles.emptyDotInner} />
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {/* Stats Overview */}
              <View style={[styles.statsRow, { backgroundColor: palette.paperRaised }]}>
                <View style={styles.statCol}>
                  <Text style={[typography.title, { color: '#F59E0B', fontVariant: ['tabular-nums'] }]}>
                    {currentStreak}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Hiện tại</Text>
                </View>
                <View style={[styles.statCol, { borderLeftWidth: 1, borderLeftColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: palette.indigo, fontVariant: ['tabular-nums'] }]}>
                    {longestStreak}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Kỷ lục</Text>
                </View>
                <View style={[styles.statCol, { borderLeftWidth: 1, borderLeftColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: '#06B6D4', fontVariant: ['tabular-nums'] }]}>
                    {streakFreezeCount} ❄️
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Bùa băng</Text>
                </View>
              </View>

              {/* 1-Tap Daily Check-In Button */}
              {!todayCompleted ? (
                <View style={{ marginVertical: spacing.sm }}>
                  <Button variant="reward" icon="flame" onPress={handleDailyCheckIn} fullWidth>
                    Điểm danh nhận chuỗi hôm nay (+1 🔥)
                  </Button>
                </View>
              ) : (
                <View style={[styles.checkedBox, { backgroundColor: palette.mintTint, borderColor: palette.mint }]}>
                  <Ionicons name="checkmark-circle" size={18} color={palette.mint} />
                  <Text style={[typography.caption, { color: palette.mint, fontWeight: '800' }]}>
                    Đã hoàn thành điểm danh hôm nay!
                  </Text>
                </View>
              )}

              {/* Recovery Quest Banner */}
              {status === 'broken' && recoveryQuestAvailable && (
                <View style={[styles.questBox, { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                  <Text style={[typography.body, { fontWeight: '700', color: '#EF4444' }]}>
                    🪶 Thử thách cứu chuỗi ({brokenStreakDays} ngày)
                  </Text>
                  <Text style={[typography.caption, { color: palette.ink, marginTop: 4 }]}>
                    Quét 1 tài liệu hoặc xác nhận phục hồi để lấy lại chuỗi ngày trước đó.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button
                      onPress={() => {
                        setModalVisible(false);
                        router.push('/create/scan');
                      }}
                    >
                      Quét OCR
                    </Button>
                    <Button variant="secondary" onPress={handleClaimRecovery}>
                      Phục hồi
                    </Button>
                  </View>
                </View>
              )}

              <View style={{ marginTop: spacing.sm }}>
                <Button variant="ghost" onPress={() => setModalVisible(false)} fullWidth>
                  Đóng
                </Button>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  dayCol: { alignItems: 'center', gap: 5 },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148,163,184,0.5)',
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginVertical: spacing.xs,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  checkedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  questBox: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
});
