import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { QuizItem } from '../domain/models';

interface QuizCardProps {
  quiz: QuizItem;
  onDelete: (id: string) => void;
  onStartLive: (quiz: QuizItem) => void;
}

export function QuizCard({ quiz, onDelete, onStartLive }: QuizCardProps) {
  const palette = usePalette();
  const router = useRouter();

  const confirmDelete = () => {
    Alert.alert('Xác nhận xóa', `Bạn có chắc muốn xóa quiz "${quiz.title}"?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => onDelete(quiz.id) },
    ]);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          {quiz.source === 'ai' ? (
            <Badge tone="reward">🤖 AI Generated</Badge>
          ) : (
            <Badge tone="success">📝 Thủ công</Badge>
          )}
          <Badge tone="primary">{quiz.questions.length} câu hỏi</Badge>
          <Badge tone="reward">{quiz.difficulty.toUpperCase()}</Badge>
        </View>

        <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xs, fontSize: 18 }]}>
          {quiz.title}
        </Text>
        <Text
          numberOfLines={2}
          style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 18 }]}
        >
          {quiz.description || 'Chưa có mô tả chi tiết cho quiz này.'}
        </Text>
      </View>

      <View style={[styles.actions, { borderTopColor: palette.paperMuted }]}>
        <Button
          variant="reward"
          icon="play"
          onPress={() => onStartLive(quiz)}
        >
          Bắt đầu Live
        </Button>

        <Button
          variant="ghost"
          icon="trash-outline"
          onPress={confirmDelete}
        >
          Xóa
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  header: {
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
});
