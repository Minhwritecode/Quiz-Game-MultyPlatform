import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { QuizItem } from '../domain/models';

interface QuestionReviewModalProps {
  visible: boolean;
  quiz: QuizItem | null;
  onClose: () => void;
  onGoLive: (quiz: QuizItem) => void;
}

export function QuestionReviewModal({
  visible,
  quiz,
  onClose,
  onGoLive,
}: QuestionReviewModalProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  if (!quiz) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: palette.paper }]}>
        <View style={styles.modalContent}>
          {/* STEP STRIP */}
          <View style={styles.header}>
            <View style={styles.stepStrip}>
              <Text style={[styles.stepItem, { color: '#10B981' }]}>01 · Tạo câu hỏi</Text>
              <View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} />
              <Text style={[styles.stepItem, { color: palette.indigo, fontWeight: '800' }]}>
                02 · Xem lại
              </Text>
              <View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} />
              <Text style={[styles.stepItem, { color: palette.inkMuted }]}>03 · Mở phòng Live</Text>
            </View>

            <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.md }]}>
              {quiz.title}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {quiz.questions.length} câu hỏi sẵn sàng cho phòng đấu. Kiểm tra kỹ trước khi mở phòng.
            </Text>
          </View>

          {/* QUESTIONS LIST */}
          <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
            {quiz.questions.map((q, idx) => (
              <Card key={idx} style={styles.questionCard}>
                <View style={styles.qTopRow}>
                  <Badge tone="primary">Câu {String(idx + 1).padStart(2, '0')}</Badge>
                </View>

                <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xs, fontSize: 16 }]}>
                  {q.question}
                </Text>

                <View style={styles.optionsList}>
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === q.correctAnswer;
                    return (
                      <View
                        key={optIdx}
                        style={[
                          styles.optionRow,
                          {
                            borderColor: isCorrect ? '#10B981' : palette.paperMuted,
                            backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.1)' : palette.paperRaised,
                          },
                        ]}
                      >
                        <Text style={[styles.optLetter, { color: isCorrect ? '#10B981' : palette.inkMuted }]}>
                          {String.fromCharCode(65 + optIdx)}
                        </Text>
                        <Text
                          style={[
                            styles.optText,
                            {
                              color: isCorrect ? '#10B981' : palette.ink,
                              fontWeight: isCorrect ? '700' : '500',
                            },
                          ]}
                        >
                          {opt} {isCorrect ? '✓' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            ))}
          </ScrollView>

          {/* FOOTER ACTIONS */}
          <View
            style={[
              styles.footer,
              {
                borderTopColor: palette.paperMuted,
                backgroundColor: palette.paper,
                paddingBottom: Math.max(spacing.md, insets.bottom + 8),
              },
            ]}
          >
            <View style={styles.footerFlex}>
              <Button variant="ghost" onPress={onClose}>
                Đóng
              </Button>
            </View>
            <View style={styles.footerFlex}>
              <Button variant="reward" icon="rocket-outline" onPress={() => onGoLive(quiz)}>
                Mở phòng Live ngay →
              </Button>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  modalContent: { flex: 1, width: '100%', maxWidth: 720 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  stepStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stepItem: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepLine: {
    flex: 1,
    minWidth: 16,
    height: 1,
  },
  scrollList: { padding: spacing.lg, paddingBottom: 110 },
  questionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  qTopRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  optionsList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },
  optLetter: {
    fontWeight: '800',
    fontSize: 13,
    minWidth: 18,
  },
  optText: {
    flex: 1,
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  footerFlex: {
    flex: 1,
  },
});
