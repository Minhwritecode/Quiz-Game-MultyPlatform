import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppIcon } from '@/shared/AppIcon';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import type { LeaderboardPlayer } from '@/features/multiplayer/domain/models';

export default function MultiplayerLeaderboardScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const leaderboard = useMultiplayerStore((state) => state.leaderboard);
  const setFinalResults = useMultiplayerStore((state) => state.setFinalResults);
  const autoAdvance = useMultiplayerStore((state) => state.autoAdvance);
  const autoAdvanceDelaySec = useMultiplayerStore((state) => state.autoAdvanceDelaySec);
  const setAutoAdvance = useMultiplayerStore((state) => state.setAutoAdvance);
  const [countdown, setCountdown] = useState<number>(autoAdvanceDelaySec);

  const handleNextQuestion = useCallback(() => {
    if (roomCode) {
      socket.emit(SOCKET_EVENTS.NEXT_QUESTION, roomCode);
    }
    router.replace({
      pathname: '/multiplayer/question/[roomCode]',
      params: { roomCode },
    });
  }, [roomCode, router]);

  useEffect(() => {
    if (!autoAdvance) return;
    if (countdown <= 0) {
      const tid = setTimeout(() => handleNextQuestion(), 0);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [autoAdvance, countdown, handleNextQuestion]);

  // Fallback demo players if none provided yet
  const displayList: LeaderboardPlayer[] =
    leaderboard.length > 0
      ? leaderboard
      : [
          { playerId: 'p1', nickname: 'Anh Minh', score: 240 },
          { playerId: 'p2', nickname: 'Lan Chi', score: 180 },
          { playerId: 'p3', nickname: 'Tuấn Khang', score: 120 },
        ];

  useEffect(() => {
    if (!roomCode) return;

    const onNextQuestion = () => {
      router.replace({
        pathname: '/multiplayer/question/[roomCode]',
        params: { roomCode },
      });
    };

    const onQuizFinished = (payload: { leaderboard: LeaderboardPlayer[] }) => {
      if (payload?.leaderboard) setFinalResults(payload.leaderboard);
      router.replace({
        pathname: '/multiplayer/results/[roomCode]',
        params: { roomCode },
      });
    };

    socket.on(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
    socket.on(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);

    return () => {
      socket.off(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
      socket.off(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);
    };
  }, [roomCode, router, setFinalResults]);

  return (
    <Screen scroll={false}>
      <TopBar title="Bảng xếp hạng trực tiếp" />

      <View style={styles.container}>
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={{ paddingBottom: 60 }}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={{ fontSize: 44 }}>🏆</Text>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                Bảng Điểm Vòng Này
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>
                Cập nhật tức thì sau mỗi câu hỏi
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isTop1 = index === 0;
            const isTop2 = index === 1;
            const isTop3 = index === 2;

            return (
              <Card
                style={[
                  styles.rankCard,
                  isTop1 && { borderColor: '#F59E0B', borderWidth: 2 },
                ]}
              >
                <View style={styles.rankLeft}>
                  <Text style={styles.medalText}>
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${index + 1}`}
                  </Text>
                  <Text style={[typography.title, { color: palette.ink, fontSize: 16, flex: 1 }]} numberOfLines={1}>
                    {item.nickname}
                  </Text>
                </View>

                <View style={styles.rankRight}>
                  <Text style={[styles.scoreText, { color: palette.indigo }]}>
                    {item.score}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>điểm</Text>
                </View>
              </Card>
            );
          }}
        />

        <View style={styles.footerActions}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Badge tone={autoAdvance ? 'primary' : 'neutral'}>
              {autoAdvance ? `⏩ Tự động qua câu sau ${countdown}s` : '⏸ Chế độ qua câu thủ công'}
            </Badge>
            <Pressable onPress={() => setAutoAdvance(!autoAdvance)}>
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                {autoAdvance ? 'Tạm dừng đếm ngược' : 'Bật tự động'}
              </Text>
            </Pressable>
          </View>
          <Button
            variant="reward"
            icon="arrow-forward-outline"
            onPress={handleNextQuestion}
          >
            {autoAdvance ? `Tiếp tục câu kế tiếp (${countdown}s) →` : 'Tiếp tục câu kế tiếp →'}
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.md },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  medalText: {
    fontSize: 24,
    fontWeight: '800',
    minWidth: 32,
    textAlign: 'center',
  },
  rankRight: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '900',
  },
  footerActions: {
    paddingVertical: spacing.md,
  },
});
