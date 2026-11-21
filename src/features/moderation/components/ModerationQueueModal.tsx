import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import {
  useModerationStore,
  type ModerationStatus,
  type QuestionReportItem,
} from '../state/useModerationStore';

const REASON_LABELS: Record<QuestionReportItem['reason'], string> = {
  wrong_answer: 'Đáp án sai',
  typo_format: 'Lỗi chính tả / hiển thị',
  inappropriate: 'Nội dung không phù hợp',
  duplicate: 'Trùng lặp / mơ hồ',
};

const TABS: Array<{ key: ModerationStatus; label: string }> = [
  { key: 'open', label: 'Chờ duyệt' },
  { key: 'reviewed', label: 'Đã xử lý' },
  { key: 'dismissed', label: 'Bỏ qua' },
];

export function ModerationQueueModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const palette = usePalette();
  const reports = useModerationStore((s) => s.reports);
  const loading = useModerationStore((s) => s.loading);
  const updateStatus = useModerationStore((s) => s.updateStatus);
  const syncFromCloud = useModerationStore((s) => s.syncFromCloud);
  const [tab, setTab] = useState<ModerationStatus>('open');

  useEffect(() => {
    if (visible) {
      void syncFromCloud();
    }
  }, [visible, syncFromCloud]);

  const filtered = reports.filter((r) => r.status === tab);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.label, { color: palette.indigo }]}>QUẢN TRỊ NỘI DUNG</Text>
              <Text style={[typography.title, { color: palette.ink, fontSize: 19 }]}>
                🛡️ Hàng đợi Kiểm duyệt
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Đóng">
              <Ionicons name="close" size={22} color={palette.ink} />
            </Pressable>
          </View>

          {/* Status Filter Tabs */}
          <View style={styles.tabsRow}>
            {TABS.map((item) => {
              const count = reports.filter((r) => r.status === item.key).length;
              const active = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? palette.indigo : palette.paperRaised,
                      borderColor: active ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: active ? '#FFFFFF' : palette.inkMuted, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={palette.indigo} />
            </View>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="shield-checkmark-outline" size={38} color={palette.mint} />
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>
                    Không có báo cáo nào trong mục này.
                  </Text>
                </View>
              ) : (
                filtered.map((item) => (
                  <Card key={item.id} style={styles.itemCard}>
                    <View style={styles.itemTop}>
                      <Badge tone={item.reason === 'inappropriate' ? 'danger' : 'reward'}>
                        {REASON_LABELS[item.reason] ?? item.reason}
                      </Badge>
                      <Text style={[typography.caption, { color: palette.inkMuted }]}>
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </Text>
                    </View>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '700', marginTop: spacing.xs }]}>
                      “{item.questionPreview || item.questionRef}”
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      Mã câu: {item.questionRef} · {item.source === 'cloud' ? 'Cloud' : 'Thiết bị'}
                    </Text>

                    <View style={styles.itemActions}>
                      {item.status !== 'reviewed' && (
                        <Pressable
                          onPress={() => void updateStatus(item.id, 'reviewed')}
                          style={[styles.actionChip, { backgroundColor: palette.mintTint, borderColor: palette.mint }]}
                        >
                          <Ionicons name="checkmark-circle-outline" size={16} color={palette.mint} />
                          <Text style={[typography.caption, { color: palette.mint, fontWeight: '700' }]}>
                            Đánh dấu đã sửa
                          </Text>
                        </Pressable>
                      )}
                      {item.status !== 'dismissed' && (
                        <Pressable
                          onPress={() => void updateStatus(item.id, 'dismissed')}
                          style={[styles.actionChip, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                        >
                          <Ionicons name="close-circle-outline" size={16} color={palette.inkMuted} />
                          <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
                            Bỏ qua
                          </Text>
                        </Pressable>
                      )}
                      {item.status !== 'open' && (
                        <Pressable
                          onPress={() => void updateStatus(item.id, 'open')}
                          style={[styles.actionChip, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
                        >
                          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                            Mở lại
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>
                ))
              )}
            </ScrollView>
          )}

          <View style={{ marginTop: spacing.sm }}>
            <Button variant="secondary" onPress={onClose} fullWidth>
              Đóng bảng kiểm duyệt
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tabsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  list: { maxHeight: 380 },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl },
  itemCard: { padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.sm },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
