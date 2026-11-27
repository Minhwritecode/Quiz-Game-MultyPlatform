import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
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

const REPORT_TABS: Array<{ key: ModerationStatus; label: string }> = [
  { key: 'open', label: 'Chờ duyệt' },
  { key: 'reviewed', label: 'Đã xử lý' },
  { key: 'dismissed', label: 'Bỏ qua' },
];

type ConsoleSection = 'moderation' | 'superadmin_users' | 'community_sets';

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
  const aiScanning = useModerationStore((s) => s.aiScanning);
  const superadminOverview = useModerationStore((s) => s.superadminOverview);
  const updateStatus = useModerationStore((s) => s.updateStatus);
  const runAiAutoModerationAll = useModerationStore((s) => s.runAiAutoModerationAll);
  const syncFromCloud = useModerationStore((s) => s.syncFromCloud);
  const loadSuperadminOverview = useModerationStore((s) => s.loadSuperadminOverview);
  const updateUserRoleAndTier = useModerationStore((s) => s.updateUserRoleAndTier);
  const moderateCommunitySet = useModerationStore((s) => s.moderateCommunitySet);

  const [section, setSection] = useState<ConsoleSection>('moderation');
  const [tab, setTab] = useState<ModerationStatus>('open');

  useEffect(() => {
    if (visible) {
      void syncFromCloud();
      void loadSuperadminOverview();
    }
  }, [visible, syncFromCloud, loadSuperadminOverview]);

  const filtered = reports.filter((r) => r.status === tab);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.label, { color: palette.indigo }]}>ADMIN & SUPERADMIN CONSOLE</Text>
              <Text style={[typography.title, { color: palette.ink, fontSize: 19 }]}>
                🛡️ Kiểm duyệt AI & Quản trị Hệ thống
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Đóng">
              <AppIcon name="close" size={22} color={palette.ink} />
            </Pressable>
          </View>

          {/* Top Console Section Switcher */}
          <View style={[styles.sectionSwitch, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
            {([
              { id: 'moderation', label: '🛡️ AI Kiểm duyệt' },
              { id: 'superadmin_users', label: '👥 Users & Role' },
              { id: 'community_sets', label: '🌐 Kho đề chung' },
            ] as const).map((sec) => {
              const active = section === sec.id;
              return (
                <Pressable
                  key={sec.id}
                  onPress={() => setSection(sec.id)}
                  style={[
                    styles.sectionBtn,
                    active && { backgroundColor: palette.indigo },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: active ? '#FFFFFF' : palette.inkMuted,
                    }}
                    numberOfLines={1}
                  >
                    {sec.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {section === 'moderation' ? (
            <>
              {/* AI Auto-Moderation Gate Banner */}
              <View style={[styles.aiBanner, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                    🤖 AI AUTO-MODERATION GATE (ADR-007)
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11 }]}>
                    Tự động chấm độ tin cậy, phát hiện từ khóa nhạy cảm, lỗi đáp án và trùng lặp.
                  </Text>
                </View>
                <Pressable
                  disabled={aiScanning}
                  onPress={() => void runAiAutoModerationAll()}
                  style={[styles.aiScanBtn, { backgroundColor: palette.indigo }]}
                >
                  <AppIcon name="sparkles" size={14} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                    {aiScanning ? 'Đang quét...' : 'AI Quét ngay'}
                  </Text>
                </Pressable>
              </View>

              {/* Status Filter Tabs */}
              <View style={styles.tabsRow}>
                {REPORT_TABS.map((item) => {
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
                      <AppIcon name="shield-checkmark-outline" size={38} color={palette.mint} />
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
                          {item.aiVerdict && item.aiVerdict !== 'pending' && (
                            <Badge
                              tone={
                                item.aiVerdict === 'valid_report'
                                  ? 'danger'
                                  : item.aiVerdict === 'false_alarm'
                                  ? 'success'
                                  : 'primary'
                              }
                            >
                              🤖 AI {item.aiConfidence ?? 85}%:{' '}
                              {item.aiVerdict === 'valid_report'
                                ? 'Cần sửa/ẩn'
                                : item.aiVerdict === 'false_alarm'
                                ? 'Hợp lệ'
                                : 'Cần duyệt tay'}
                            </Badge>
                          )}
                          <Text style={[typography.caption, { color: palette.inkMuted }]}>
                            {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                          </Text>
                        </View>
                        <Text style={[typography.body, { color: palette.ink, fontWeight: '700', marginTop: spacing.xs }]}>
                          “{item.questionPreview || item.questionRef}”
                        </Text>
                        {item.aiSummary ? (
                          <Text style={[typography.caption, { color: palette.indigo, marginTop: 3 }]}>
                            💡 {item.aiSummary}
                          </Text>
                        ) : null}
                        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                          Mã câu: {item.questionRef} · {item.source === 'cloud' ? 'Supabase Cloud' : 'Thiết bị'}
                        </Text>

                        <View style={styles.itemActions}>
                          {item.status !== 'reviewed' && (
                            <Pressable
                              onPress={() => void updateStatus(item.id, 'reviewed')}
                              style={[styles.actionChip, { backgroundColor: palette.mintTint, borderColor: palette.mint }]}
                            >
                              <AppIcon name="checkmark-circle-outline" size={16} color={palette.mint} />
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
                              <AppIcon name="close-circle-outline" size={16} color={palette.inkMuted} />
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
            </>
          ) : section === 'superadmin_users' ? (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {/* Platform KPIs Grid */}
              <View style={styles.kpiGrid}>
                <View style={[styles.kpiBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: palette.indigo }]}>{superadminOverview.metrics.totalUsers}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Tổng Users</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: palette.gold }]}>{superadminOverview.metrics.vipUsers}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Archmage VIP</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: palette.mint }]}>{superadminOverview.metrics.totalMatches}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Trận 1v1</Text>
                </View>
                <View style={[styles.kpiBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                  <Text style={[typography.title, { color: palette.indigo }]}>{superadminOverview.metrics.totalKnowledgeChunks}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>RAG Chunks</Text>
                </View>
              </View>

              {superadminOverview.users.map((u) => (
                <Card key={u.id} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                        {u.displayName} {u.isSuspended ? '🚫 (Đã khóa)' : ''}
                      </Text>
                      <Text style={[typography.caption, { color: palette.inkMuted }]}>
                        {u.eloRating} ELO · {u.gamesPlayed} trận
                      </Text>
                    </View>
                    <Badge tone={u.role === 'superadmin' ? 'danger' : u.role === 'moderator' ? 'primary' : 'neutral'}>
                      {u.role.toUpperCase()}
                    </Badge>
                    <Badge tone={u.membershipTier === 'archmage' ? 'reward' : 'neutral'}>
                      {u.membershipTier === 'archmage' ? '👑 VIP' : 'Free'}
                    </Badge>
                  </View>

                  <View style={styles.itemActions}>
                    <Pressable
                      onPress={() =>
                        void updateUserRoleAndTier(u.id, {
                          role: u.role === 'user' ? 'moderator' : u.role === 'moderator' ? 'superadmin' : 'user',
                        })
                      }
                      style={[styles.actionChip, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
                    >
                      <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                        Đổi Role ({u.role})
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void updateUserRoleAndTier(u.id, {
                          membershipTier: u.membershipTier === 'archmage' ? 'apprentice' : 'archmage',
                        })
                      }
                      style={[styles.actionChip, { backgroundColor: palette.paperRaised, borderColor: palette.gold }]}
                    >
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
                        {u.membershipTier === 'archmage' ? 'Hạ xuống Free' : '👑 Cấp VIP'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void updateUserRoleAndTier(u.id, { isSuspended: !u.isSuspended })
                      }
                      style={[styles.actionChip, { backgroundColor: palette.dangerTint, borderColor: palette.danger }]}
                    >
                      <Text style={[typography.caption, { color: palette.danger, fontWeight: '700' }]}>
                        {u.isSuspended ? 'Mở khóa' : 'Khóa TK'}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </ScrollView>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {superadminOverview.questionSets.map((qs) => (
                <Card key={qs.id} style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <Badge
                      tone={
                        qs.moderationStatus === 'approved'
                          ? 'success'
                          : qs.moderationStatus === 'rejected'
                          ? 'danger'
                          : 'reward'
                      }
                    >
                      {qs.moderationStatus.toUpperCase()} · AI {qs.moderationScore}/100
                    </Badge>
                    <Badge tone={qs.visibility === 'shared' ? 'primary' : 'neutral'}>
                      {qs.visibility === 'shared' ? '🌐 Công khai' : '🔒 Riêng tư'}
                    </Badge>
                  </View>
                  <Text style={[typography.body, { color: palette.ink, fontWeight: '700', marginTop: spacing.xs }]}>
                    {qs.title}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Môn học: {qs.subject || 'Tổng hợp'}
                  </Text>

                  <View style={styles.itemActions}>
                    <Pressable
                      onPress={() =>
                        void moderateCommunitySet(qs.id, {
                          moderationStatus: 'approved',
                          visibility: 'shared',
                        })
                      }
                      style={[styles.actionChip, { backgroundColor: palette.mintTint, borderColor: palette.mint }]}
                    >
                      <Text style={[typography.caption, { color: palette.mint, fontWeight: '700' }]}>
                        ✓ Duyệt công khai
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void moderateCommunitySet(qs.id, {
                          moderationStatus: 'flagged',
                          visibility: 'private',
                        })
                      }
                      style={[styles.actionChip, { backgroundColor: palette.dangerTint, borderColor: palette.danger }]}
                    >
                      <Text style={[typography.caption, { color: palette.danger, fontWeight: '700' }]}>
                        ⚠️ Gắn cờ & Ẩn
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </ScrollView>
          )}

          <View style={{ marginTop: spacing.sm }}>
            <Button variant="secondary" onPress={onClose} fullWidth>
              Đóng bảng quản trị
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
    maxWidth: 600,
    maxHeight: '90%',
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sectionSwitch: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    borderWidth: 1,
    padding: 3,
    marginBottom: spacing.sm,
  },
  sectionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
  },
  aiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  aiScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  tabsRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  kpiBox: {
    flex: 1,
    minWidth: 110,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
});
