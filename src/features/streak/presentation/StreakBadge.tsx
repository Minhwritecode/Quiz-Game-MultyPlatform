import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useStreakStore } from '../state/useStreakStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { Button, Card, usePalette } from '@/shared/ui';
import { sfx } from '@/core/audio/sfx';

export function StreakBadge() {
  const router = useRouter();
  const palette = usePalette();
  const [modalVisible, setModalVisible] = useState(false);

  const currentStreak = useStreakStore((state) => state.currentStreak);
  const longestStreak = useStreakStore((state) => state.longestStreak);
  const todayCompleted = useStreakStore((state) => state.todayCompleted);
  const status = useStreakStore((state) => state.status);
  const streakFreezeCount = useStreakStore((state) => state.streakFreezeCount);
  const brokenStreakDays = useStreakStore((state) => state.brokenStreakDays);
  const recoveryQuestAvailable = useStreakStore((state) => state.recoveryQuestAvailable);
  const recoverStreakWithQuest = useStreakStore((state) => state.recoverStreakWithQuest);

  const getPillData = () => {
    if (status === 'broken' && recoveryQuestAvailable) {
      return { label: '🪶 Cứu Chuỗi', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
    }
    if (status === 'frozen') {
      return { label: `❄️ ${currentStreak}`, color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)' };
    }
    if (todayCompleted) {
      return { label: `🔥 ${currentStreak}`, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { label: `⚡ ${currentStreak}`, color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)' };
  };

  const pill = getPillData();

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
        style={[styles.pill, { backgroundColor: pill.bg, borderColor: pill.color }]}
      >
        <Text style={[typography.caption, { color: pill.color, fontWeight: '800' }]}>{pill.label}</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={[styles.modalContent, { backgroundColor: palette.paper }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 44 }}>
                {status === 'broken' ? '💔' : todayCompleted ? '🔥' : '⚡'}
              </Text>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                {status === 'broken'
                  ? 'Chuỗi Bị Đứt!'
                  : todayCompleted
                  ? `${currentStreak} Ngày Học Liên Tiếp!`
                  : `Giữ Chuỗi ${currentStreak} Ngày`}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                {todayCompleted
                  ? 'Bạn đã hoàn thành nhiệm vụ tri thức hôm nay. Ngọn lửa đang bùng cháy!'
                  : 'Hãy hoàn thành 1 bài trắc nghiệm hoặc quét tài liệu để giữ lửa!'}
              </Text>
            </View>

            {/* Stats Overview */}
            <View style={[styles.statsRow, { backgroundColor: palette.paperRaised }]}>
              <View style={styles.statCol}>
                <Text style={[typography.title, { color: '#F59E0B' }]}>{currentStreak}</Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>Chuỗi hiện tại</Text>
              </View>
              <View style={[styles.statCol, { borderLeftWidth: 1, borderLeftColor: palette.paperMuted }]}>
                <Text style={[typography.title, { color: palette.indigo }]}>{longestStreak}</Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>Kỷ lục cao nhất</Text>
              </View>
              <View style={[styles.statCol, { borderLeftWidth: 1, borderLeftColor: palette.paperMuted }]}>
                <Text style={[typography.title, { color: '#06B6D4' }]}>{streakFreezeCount} ❄️</Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>Bùa đóng băng</Text>
              </View>
            </View>

            {/* Recovery Quest Banner */}
            {status === 'broken' && recoveryQuestAvailable && (
              <View style={[styles.questBox, { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
                <Text style={[typography.body, { fontWeight: '700', color: '#EF4444' }]}>
                  🪶 Thử Thách Cứu Chuỗi ({brokenStreakDays} ngày)
                </Text>
                <Text style={[typography.caption, { color: palette.ink, marginTop: 4 }]}>
                  Quét 1 tài liệu hoặc tài liệu OCR để hồi phục toàn bộ chuỗi ngày đã mất!
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Button
                    onPress={() => {
                      setModalVisible(false);
                      router.push('/create/scan');
                    }}
                  >
                    📸 Quét OCR ngay
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={handleClaimRecovery}
                  >
                    Phục hồi
                  </Button>
                </View>
              </View>
            )}

            {/* Action Checklist */}
            <View style={styles.checklist}>
              <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', marginBottom: 8 }]}>
                NHIỆM VỤ GIỮ CHUỖI HÔM NAY:
              </Text>
              <View style={styles.checkItem}>
                <Text>{todayCompleted ? '✅' : '⚪'}</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Quét 1 tài liệu tài liệu (OCR) (+100 EXP)
                </Text>
              </View>
              <View style={styles.checkItem}>
                <Text>{todayCompleted ? '✅' : '⚪'}</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Làm 1 bài trắc nghiệm / Chơi 1 trận game (+50 EXP)
                </Text>
              </View>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Button variant="secondary" onPress={() => setModalVisible(false)}>
                Đóng
              </Button>
            </View>
          </Card>
        </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginVertical: spacing.sm,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  questBox: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  checklist: {
    marginVertical: spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
