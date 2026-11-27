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
import { gameApi } from '@/composition/platform';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';
import { OPTION_SHAPES, calculateSpeedPoints } from '@/features/multiplayer/domain/shapes';
import { PlayerRevealModal } from '@/features/multiplayer/components/PlayerRevealModal';
import { ReportQuestionButton } from '@/shared/ReportQuestionButton';
import type { CurrentQuestionData, LeaderboardPlayer } from '@/features/multiplayer/domain/models';

export default function MultiplayerQuestionScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const setLeaderboard = useMultiplayerStore((state) => state.setLeaderboard);
  const setFinalResults = useMultiplayerStore((state) => state.setFinalResults);

  const [questionData, setQuestionData] = useState<CurrentQuestionData & { explanation?: string } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState(20);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [answeredCount, setAnsweredCount] = useState(1);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const fetchQuestion = useCallback(async () => {
    if (!roomCode) return;
    setIsLoading(true);
    setSelectedAnswer(null);
    setCorrectAnswer(null);
    setShowRevealModal(false);
    try {
      const data = await gameApi.getCurrentQuestion(roomCode);
      setQuestionData(data);
      setRemainingTime(data.remainingTime || 20);
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
          setRemainingTime(data.remainingTime || 20);
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

    const onQuestionEnded = (payload: { correctAnswer: number; explanation?: string }) => {
      setCorrectAnswer(payload.correctAnswer);
      const isCorrect = selectedAnswer === payload.correctAnswer;
      const pts = calculateSpeedPoints(isCorrect, 20 - remainingTime, 20);
      setEarnedPoints(pts);
      setTotalScore((prev) => prev + pts);
      setShowRevealModal(true);
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

    const onRoomSynced = () => {
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
    socket.on(SOCKET_EVENTS.ROOM_SYNC_STATE, onRoomSynced);
    socket.on(SOCKET_EVENTS.QUIZ_PAUSED, onPause);
    socket.on(SOCKET_EVENTS.QUIZ_RESUMED, onResume);
    socket.on(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);

    return () => {
      socket.off(SOCKET_EVENTS.QUESTION_ENDED, onQuestionEnded);
      socket.off(SOCKET_EVENTS.LEADERBOARD_UPDATED, onLeaderboardUpdated);
      socket.off(SOCKET_EVENTS.SHOW_LEADERBOARD, onShowLeaderboard);
      socket.off(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
      socket.off(SOCKET_EVENTS.ROOM_SYNC_STATE, onRoomSynced);
      socket.off(SOCKET_EVENTS.QUIZ_PAUSED, onPause);
      socket.off(SOCKET_EVENTS.QUIZ_RESUMED, onResume);
      socket.off(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);
    };
  }, [roomCode, fetchQuestion, router, selectedAnswer, remainingTime, setLeaderboard, setFinalResults]);

  const handleSelectAnswer = (index: number) => {
    if (selectedAnswer !== null || correctAnswer !== null) return;
    setSelectedAnswer(index);
    setAnsweredCount((prev) => prev + 1);
    if (roomCode) {
      gameApi.submitAnswer(roomCode, index);
    }
  };

  if (isLoading || !questionData) {
    return (
      <Screen scroll={false}>
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
    <Screen scroll={false}>
      <TopBar title={`Phòng: ${roomCode}`} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* TOP STATUS BAR: Progress & Timer */}
        <View style={styles.topStatus}>
          <View>
            <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
              Câu {questionData.index + 1} / {questionData.totalQuestions}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              ⚡ Điểm tối đa: 1,000 đ
            </Text>
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
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.xs }}>
            <ReportQuestionButton
              questionKey={`live-${roomCode}-${questionData.index}`}
              questionContent={questionData.question}
            />
          </View>
          <Text style={[styles.promptText, { color: palette.ink }]}>
            {questionData.question}
          </Text>
          {questionData.codeSnippet ? (
            <View style={{ backgroundColor: '#0F172A', borderRadius: 10, padding: spacing.md, marginTop: spacing.md }}>
              <Text style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#E2E8F0' }}>
                {questionData.codeSnippet}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* 4 CHOICES WITH STUDYWARS GEOMETRIC SHAPES */}
        <View style={styles.optionsWrap}>
          {questionData.options.map((option, idx) => {
            const shape = OPTION_SHAPES[idx % 4] ?? {
              symbol: '▲',
              name: 'Option',
              color: '#6366F1',
              tint: 'rgba(99, 102, 241, 0.15)',
              border: '#4F46E5',
            };
            const isSelected = selectedAnswer === idx;
            const isCorrect = correctAnswer !== null && idx === correctAnswer;
            const isWrong = correctAnswer !== null && isSelected && selectedAnswer !== correctAnswer;

            let bgColor = palette.paperRaised;
            let borderColor = shape.border;

            if (isSelected && correctAnswer === null) {
              bgColor = shape.tint;
              borderColor = shape.color;
            } else if (isCorrect) {
              bgColor = '#10B981';
              borderColor = '#059669';
            } else if (isWrong) {
              bgColor = '#EF4444';
              borderColor = '#DC2626';
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
                {/* GEOMETRIC SHAPE TILE */}
                <View style={[styles.shapeBadge, { backgroundColor: shape.color }]}>
                  <Text style={styles.shapeSymbol}>{shape.symbol}</Text>
                </View>

                <View style={styles.optContent}>
                  <Text style={[styles.letterLabel, { color: palette.inkMuted }]}>
                    {String.fromCharCode(65 + idx)}
                  </Text>
                  <Text
                    style={[
                      styles.optText,
                      { color: isCorrect || isWrong ? '#FFFFFF' : palette.ink },
                    ]}
                  >
                    {option}
                  </Text>
                </View>

                {isCorrect && (
                  <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
                )}
                {isWrong && (
                  <Ionicons name="close-circle" size={26} color="#FFFFFF" />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* LIVE RESPONSE INDICATOR */}
        <View style={styles.feedbackRow}>
          <Ionicons name="radio-outline" size={16} color={palette.indigo} />
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            Đã có {answeredCount} câu trả lời được ghi nhận
          </Text>
        </View>
      </ScrollView>

      {/* STUDYWARS PLAYER REVEAL MODAL */}
      <PlayerRevealModal
        visible={showRevealModal}
        wasCorrect={selectedAnswer === correctAnswer}
        didNotAnswer={selectedAnswer === null}
        pointsEarned={earnedPoints}
        totalScore={totalScore}
        explanation={
          questionData.explanation ||
          'Kiến thức quan trọng: Hãy ghi nhớ đáp án chính xác để bứt phá ở các vòng sau!'
        }
        onDismiss={() => {
          setShowRevealModal(false);
          router.push({
            pathname: '/multiplayer/leaderboard/[roomCode]',
            params: { roomCode },
          });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 60 },
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
  shapeBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeSymbol: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  optContent: {
    flex: 1,
    minWidth: 0,
  },
  letterLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  optText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 2,
    flexShrink: 1,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
