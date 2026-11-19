import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useQuizStore } from '@/features/quiz-library/state/useQuizStore';
import { QuizCard } from '@/features/quiz-library/components/QuizCard';
import type { QuizItem } from '@/features/quiz-library/domain/models';

export default function QuizLibraryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { quizzes, isLoading, loadQuizzes, deleteQuiz } = useQuizStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  const filteredQuizzes = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()) ||
    q.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartLive = (quiz: QuizItem) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push({
      pathname: '/multiplayer/host/[roomCode]',
      params: { roomCode, quizId: quiz.id },
    });
  };

  return (
    <Screen>
      <TopBar title="Thư viện Quiz của tôi" />

      {/* Action Header */}
      <View style={styles.topActions}>
        <Button
          icon="sparkles"
          variant="reward"
          onPress={() => router.push('/ai-quiz')}
        >
          Tạo bằng AI
        </Button>
        <Button
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push('/quiz-editor/create')}
        >
          Tạo thủ công
        </Button>
      </View>

      {/* Search Input */}
      <View style={[styles.searchBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
        <Ionicons name="search-outline" size={20} color={palette.inkMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm kiếm quiz theo tiêu đề hoặc mô tả..."
          placeholderTextColor={palette.inkMuted}
          style={[styles.searchInput, { color: palette.ink }]}
        />
        {search ? (
          <Ionicons
            name="close-circle"
            size={18}
            color={palette.inkMuted}
            onPress={() => setSearch('')}
          />
        ) : null}
      </View>

      <FlatList
        data={filteredQuizzes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void loadQuizzes()}
            tintColor={palette.indigo}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <QuizCard
            quiz={item}
            onDelete={deleteQuiz}
            onStartLive={handleStartLive}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyCard}>
              <EmptyState
                icon="library-outline"
                title="Chưa có quiz nào"
                message="Bạn có thể tự tay soạn câu hỏi hoặc để AI tạo tự động chỉ trong vài giây."
              />
            </View>
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 60,
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    marginTop: spacing.md,
  },
});
