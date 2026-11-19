import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { gameApi } from '@/features/multiplayer/services/game.api';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';
import type { CurrentQuestionData, LeaderboardPlayer } from '@/features/multiplayer/domain/models';

export default function MultiplayerQuestionScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const setLeaderboard = useMultiplayerStore((state) => state.setLeaderboard);
  const setFinalResults = useMultiplayerStore((state) => state.setFinalResults);

  const [questionData, setQuestionData] = useState<CurrentQuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(15);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQuestion = useCallback(async () => {
    if (!roomCode) return;
    setIsLoading(true);
    setSelectedAnswer(null);
    setCorrectAnswer(null);
    try {
      const data = await gameApi.getCurrentQuestion(roomCode);
      setQuestionData(data);
      setRemainingTime(data.remainingTime || 15);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  // Initial fetch and timer countdown
  useEffect(() => {
    let mounted = true;
    if (roomCode) {
      void gameApi.getCurrentQuestion(roomCode).then((data) => {
        if (mounted && data) {
          setQuestionData(data);
          setRemainingTime(data.remainingTime || 15);
          setIsLoading(false);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [roomCode]);

  useEffect(() => {
    if (isPaused || remainingTime <= 0) return;
    const interval = setInterval(() => {
      setRemainingTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, remainingTime]);

  // Socket game event listeners
  useEffect(() => {
    if (!roomCode) return;

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomCode);

    const onQuestionEnded = (payload: { correctAnswer: number }) => {
      setCorrectAnswer(payload.correctAnswer);
    };

    const onLeaderboardUpdated = (payload: { leaderboard: LeaderboardPlayer[] }) => {
      if (payload?.leaderboard) setLeaderboard(payload.leaderboard);
    };

    const onShowLeaderboard = () => {
      router.push({
        pathname: '/multiplayer/leaderboard/[roomCode]',
        params: { roomCode },
      });
    };

    const onNextQuestion = () => {
      void fetchQuestion();
    };

    const onPause = () => setIsPaused(true);
    const onResume = (payload: { remainingTime?: number }) => {
      setIsPaused(false);
      if (payload?.remainingTime) setRemainingTime(payload.remainingTime);
    };

    const onQuizFinished = (payload: { leaderboard: LeaderboardPlayer[] }) => {
      if (payload?.leaderboard) setFinalResults(payload.leaderboard);
      router.replace({
        pathname: '/multiplayer/results/[roomCode]',
        params: { roomCode },
      });
    };

    socket.on(SOCKET_EVENTS.QUESTION_ENDED, onQuestionEnded);
    socket.on(SOCKET_EVENTS.LEADERBOARD_UPDATED, onLeaderboardUpdated);
    socket.on(SOCKET_EVENTS.SHOW_LEADERBOARD, onShowLeaderboard);
    socket.on(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
    socket.on(SOCKET_EVENTS.QUIZ_PAUSED, onPause);
    socket.on(SOCKET_EVENTS.QUIZ_RESUMED, onResume);
    socket.on(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);

    return () => {
      socket.off(SOCKET_EVENTS.QUESTION_ENDED, onQuestionEnded);
      socket.off(SOCKET_EVENTS.LEADERBOARD_UPDATED, onLeaderboardUpdated);
      socket.off(SOCKET_EVENTS.SHOW_LEADERBOARD, onShowLeaderboard);
      socket.off(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
      socket.off(SOCKET_EVENTS.QUIZ_PAUSED, onPause);
      socket.off(SOCKET_EVENTS.QUIZ_RESUMED, onResume);
      socket.off(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);
    };
  }, [roomCode, fetchQuestion, router, setLeaderboard, setFinalResults]);

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null || correctAnswer !== null) return;
    setSelectedAnswer(index);
    if (roomCode) {
      gameApi.submitAnswer(roomCode, index);
    }
  };

  if (isLoading || !questionData) {
    return (
      <Screen>
        <TopBar title="Đang tải câu hỏi..." />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={palette.indigo} />
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.md }]}>
            Đang đồng bộ câu hỏi từ phòng thi đấu...
          </Text>
        </View>
      </Screen>
    );
  }

  const progressPercent = Math.min(
    100,
    ((questionData.index + 1) / Math.max(1, questionData.totalQuestions)) * 100
  );
  const isTimeCritical = remainingTime <= 5;

  return (
    <Screen>
      <TopBar title={`Phòng: ${roomCode}`} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* TOP STATUS BAR: Progress & Timer */}
        <View style={styles.topStatus}>
          <View>
            <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
              Câu {questionData.index + 1} / {questionData.totalQuestions}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>Thời gian thực</Text>
          </View>

          {/* TIMER PILL */}
          <View
            style={[
              styles.timerPill,
              {
                backgroundColor: isTimeCritical ? '#EF4444' : palette.indigo,
              },
            ]}
          >
            <Ionicons name={isPaused ? 'pause' : 'time-outline'} size={18} color="#FFFFFF" />
            <Text style={styles.timerText}>{isPaused ? 'Tạm dừng' : `${remainingTime}s`}</Text>
          </View>
        </View>

        {/* PROGRESS TRACK */}
        <View style={[styles.progressTrack, { backgroundColor: palette.paperMuted }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${progressPercent}%`, backgroundColor: palette.indigo },
            ]}
          />
        </View>

        {/* PAUSE BANNER */}
        {isPaused && (
          <View style={styles.pauseBanner}>
            <Ionicons name="pause-circle" size={20} color="#F59E0B" />
            <Text style={styles.pauseText}>Chủ phòng đã tạm dừng câu hỏi</Text>
          </View>
        )}

        {/* QUESTION CARD */}
        <Card style={styles.questionCard}>
          <Text style={[styles.promptText, { color: palette.ink }]}>
            {questionData.question}
          </Text>
        </Card>

        {/* 4 CHOICES */}
        <View style={styles.optionsWrap}>
          {questionData.options.map((option, idx) => {
            let borderColor = palette.paperMuted;
            let bgColor = palette.paperRaised;
            let textColor = palette.ink;

            // When selected before reveal
            if (correctAnswer === null && selectedAnswer === idx) {
              borderColor = palette.indigo;
              bgColor = palette.indigo;
              textColor = '#FFFFFF';
            }

            // When correct answer is revealed
            if (correctAnswer !== null) {
              if (idx === correctAnswer) {
                borderColor = '#10B981';
                bgColor = '#10B981';
                textColor = '#FFFFFF';
              } else if (selectedAnswer === idx && selectedAnswer !== correctAnswer) {
                borderColor = '#EF4444';
                bgColor = '#EF4444';
                textColor = '#FFFFFF';
              }
            }

            return (
              <Pressable
                key={idx}
                onPress={() => handleSelectAnswer(idx)}
                disabled={correctAnswer !== null || selectedAnswer !== null}
                style={[
                  styles.optionButton,
                  { borderColor, backgroundColor: bgColor },
                ]}
              >
                <View style={[styles.optLetter, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                  <Text style={[styles.optLetterText, { color: textColor }]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                </View>

                <Text style={[styles.optText, { color: textColor }]}>
                  {option}
                </Text>

                {correctAnswer !== null && idx === correctAnswer && (
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                )}
                {correctAnswer !== null && selectedAnswer === idx && selectedAnswer !== correctAnswer && (
                  <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* STATUS FOOTER */}
        {selectedAnswer !== null && correctAnswer === null && (
          <View style={styles.feedbackRow}>
            <Ionicons name="checkmark-done" size={20} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
              Đã ghi nhận câu trả lời! Đang đợi hết giờ câu hỏi...
            </Text>
          </View>
        )}

        {correctAnswer !== null && (
          <View style={styles.feedbackRow}>
            <Ionicons name="information-circle" size={20} color="#10B981" />
            <Text style={[typography.caption, { color: '#10B981', fontWeight: '700' }]}>
              Đã hiển thị đáp án chính xác! Đang chuẩn bị chuyển bảng xếp hạng...
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 60 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  timerText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  pauseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  pauseText: {
    color: '#F59E0B',
    fontWeight: '700',
    fontSize: 13,
  },
  questionCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    marginVertical: spacing.sm,
  },
  promptText: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  optionsWrap: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.md,
  },
  optLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterText: {
    fontWeight: '800',
    fontSize: 14,
  },
  optText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
