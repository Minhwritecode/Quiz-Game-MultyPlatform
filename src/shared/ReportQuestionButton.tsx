import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { supabase } from '@/core/network/supabase';
import { useModerationStore } from '@/features/moderation/state/useModerationStore';

const REPORT_REASONS = [
  { id: 'wrong_answer', label: 'Đáp án chưa chính xác' },
  { id: 'typo_format', label: 'Lỗi chính tả / hiển thị' },
  { id: 'inappropriate', label: 'Nội dung không phù hợp' },
  { id: 'duplicate', label: 'Câu hỏi trùng lặp / mơ hồ' },
] as const;

interface ReportQuestionButtonProps {
  questionKey: string;
  questionContent: string;
}

export function ReportQuestionButton({ questionKey, questionContent }: ReportQuestionButtonProps) {
  const palette = usePalette();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('wrong_answer');
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitReport = async () => {
    if (busy || reported) return;
    setBusy(true);
    useModerationStore.getState().addLocalReport({
      questionRef: questionKey,
      questionPreview: questionContent.slice(0, 240),
      reason: selectedReason as 'wrong_answer' | 'typo_format' | 'inappropriate' | 'duplicate',
    });
    try {
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from('question_reports').insert({
            reporter_id: data.user.id,
            question_ref: questionKey,
            question_preview: questionContent.slice(0, 240),
            reason: selectedReason,
          });
        }
      }
    } catch {
      // Best-effort network submit; always acknowledge locally so UX never breaks offline
    } finally {
      setReported(true);
      setBusy(false);
      setModalOpen(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={reported ? 'Đã báo cáo câu hỏi' : 'Báo cáo câu hỏi lỗi'}
        disabled={reported}
        onPress={() => setModalOpen(true)}
        style={[
          styles.triggerBtn,
          {
            backgroundColor: reported ? palette.paperMuted : palette.dangerTint,
            borderColor: reported ? palette.paperMuted : palette.dangerBorder,
          },
        ]}
      >
        <Ionicons
          name={reported ? 'checkmark-circle-outline' : 'flag-outline'}
          size={15}
          color={reported ? palette.inkMuted : palette.danger}
        />
        <Text
          style={[
            typography.caption,
            { color: reported ? palette.inkMuted : palette.danger, fontWeight: '700', fontSize: 11 },
          ]}
        >
          {reported ? 'Đã báo cáo' : 'Báo lỗi'}
        </Text>
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheetWrap} onPress={() => undefined}>
            <Card style={styles.sheet}>
              <Text style={[typography.title, { color: palette.ink }]}>🚩 Báo cáo câu hỏi</Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]} numberOfLines={2}>
                “{questionContent}”
              </Text>

              <View style={styles.reasonsList}>
                {REPORT_REASONS.map((r) => {
                  const active = selectedReason === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelectedReason(r.id)}
                      style={[
                        styles.reasonRow,
                        {
                          borderColor: active ? palette.indigo : palette.paperMuted,
                          backgroundColor: active ? palette.indigoTint : palette.paper,
                        },
                      ]}
                    >
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={active ? palette.indigo : palette.inkMuted}
                      />
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: active ? '700' : '500', flex: 1 }]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" onPress={() => setModalOpen(false)} fullWidth>
                    Hủy
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="danger" disabled={busy} onPress={() => void submitReport()} fullWidth>
                    {busy ? 'Đang gửi...' : 'Gửi báo cáo'}
                  </Button>
                </View>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 420,
  },
  sheet: {
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  reasonsList: {
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
