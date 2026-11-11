import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useI18n } from '@/core/i18n';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { colors, radii, shadows, spacing, typography } from '@/core/theme/tokens';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';

interface Competitor {
  id: string;
  name: string;
  avatar: string;
  lives: number;
  score: number;
  isBot: boolean;
  status: 'alive' | 'knocked_out';
}

export default function SurvivalGameScreen() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  const palette = usePalette();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();

  const questionSets = usePapyrusStore((s) => s.questionSets);
  const [activeSetId, setActiveSetId] = useState<string | null>(setId ?? null);
  const [showSetPicker, setShowSetPicker] = useState(false);

  const currentSet = useMemo(() => {
    if (activeSetId) {
      const found = questionSets.find((s) => s.id === activeSetId);
      if (found) return found;
    }
    return questionSets.find((s) => s.questions.length >= 3) ?? questionSets[0] ?? null;
  }, [activeSetId, questionSets]);

  const questions = currentSet?.questions ?? [];

  // Game Loop State
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerLocked, setIsAnswerLocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isUserKnockedOut, setIsUserKnockedOut] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [roundsSurvived, setRoundsSurvived] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);

  // Competitors Roster: User + 3 AI Challengers
  const [competitors, setCompetitors] = useState<Competitor[]>([
    { id: 'user', name: 'Bạn (Player)', avatar: 'person', lives: 3, score: 0, isBot: false, status: 'alive' },
    { id: 'bot-1', name: 'Bot Cao Thủ', avatar: 'shield', lives: 3, score: 0, isBot: true, status: 'alive' },
    { id: 'bot-2', name: 'Bot Phản Xạ', avatar: 'flash', lives: 3, score: 0, isBot: true, status: 'alive' },
    { id: 'bot-3', name: 'Bot Tân Binh', avatar: 'fitness', lives: 3, score: 0, isBot: true, status: 'alive' },
  ]);

  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuestion = questions[questionIndex];
  const userPlayer = competitors.find((c) => c.id === 'user');

  // Start / Restart Game
  const startNewGame = () => {
    setQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerLocked(false);
    setSecondsLeft(12);
    setIsGameOver(false);
    setIsUserKnockedOut(false);
    setIsVictory(false);
    setRoundsSurvived(0);
    setCorrectAnswersCount(0);
    setCompetitors([
      { id: 'user', name: language === 'vi' ? 'Bạn (You)' : 'You', avatar: 'person', lives: 3, score: 0, isBot: false, status: 'alive' },
      { id: 'bot-1', name: 'Bot Alpha ⚡', avatar: 'shield', lives: 3, score: 0, isBot: true, status: 'alive' },
      { id: 'bot-2', name: 'Bot Reflex 🎯', avatar: 'flash', lives: 3, score: 0, isBot: true, status: 'alive' },
      { id: 'bot-3', name: 'Bot Rookie 🛡️', avatar: 'fitness', lives: 3, score: 0, isBot: true, status: 'alive' },
    ]);
  };

  useEffect(() => {
    startNewGame();
  }, [currentSet?.id]);

  // Round Timer & Countdown
  useEffect(() => {
    if (isGameOver || !currentQuestion) return;

    setSecondsLeft(12);
    timerAnim.setValue(1);

    Animated.timing(timerAnim, {
      toValue: 0,
      duration: 12000,
      useNativeDriver: false,
    }).start();

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [questionIndex, isGameOver, currentQuestion]);

  // Timeout: User loses 1 life if not answered
  const handleTimeOut = () => {
    if (isAnswerLocked) return;
    resolveRound(null);
  };

  const handleOptionPress = (index: number) => {
    if (isAnswerLocked || isGameOver || (userPlayer && userPlayer.lives <= 0)) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerAnim.stopAnimation();
    setSelectedOption(index);
    resolveRound(index);
  };

  const resolveRound = (userChoice: number | null) => {
    setIsAnswerLocked(true);

    const isUserCorrect =
      userChoice !== null &&
      currentQuestion !== undefined &&
      userChoice === currentQuestion.correctIndex;
    if (isUserCorrect) {
      setCorrectAnswersCount((c) => c + 1);
    }

    // Resolve AI Bots responses
    const nextCompetitors = competitors.map((c) => {
      if (c.id === 'user') {
        if (c.lives <= 0) return c;
        const newLives = isUserCorrect ? c.lives : Math.max(0, c.lives - 1);
        const newScore = isUserCorrect ? c.score + 1000 + secondsLeft * 50 : c.score;
        return {
          ...c,
          lives: newLives,
          score: newScore,
          status: (newLives <= 0 ? 'knocked_out' : 'alive') as 'alive' | 'knocked_out',
        };
      }

      // Bot simulation
      if (c.status === 'knocked_out') return c;
      // Probabilities of answering correctly:
      const botAccuracy = c.id === 'bot-1' ? 0.8 : c.id === 'bot-2' ? 0.65 : 0.5;
      const botCorrect = Math.random() < botAccuracy;
      const newLives = botCorrect ? c.lives : Math.max(0, c.lives - 1);
      const newScore = botCorrect ? c.score + 800 + Math.floor(Math.random() * 400) : c.score;

      return {
        ...c,
        lives: newLives,
        score: newScore,
        status: (newLives <= 0 ? 'knocked_out' : 'alive') as 'alive' | 'knocked_out',
      };
    });

    setCompetitors(nextCompetitors);

    const updatedUser = nextCompetitors.find((c) => c.id === 'user')!;
    const aliveCount = nextCompetitors.filter((c) => c.status === 'alive').length;
    const isLastRound = questionIndex >= questions.length - 1;

    setRoundsSurvived((r) => r + 1);

    // Check knockout or victory conditions
    setTimeout(() => {
      if (updatedUser.lives <= 0) {
        setIsUserKnockedOut(true);
        setIsGameOver(true);
      } else if (aliveCount === 1 && updatedUser.status === 'alive') {
        // You are the last survivor!
        setIsVictory(true);
        setIsGameOver(true);
      } else if (isLastRound) {
        // Survived all rounds!
        setIsVictory(true);
        setIsGameOver(true);
      } else {
        // Advance to next round
        setQuestionIndex((i) => i + 1);
        setSelectedOption(null);
        setIsAnswerLocked(false);
      }
    }, 1800);
  };

  const renderHearts = (lives: number) => {
    return (
      <View style={styles.heartsRow}>
        <Ionicons name={lives >= 1 ? 'heart' : 'heart-dislike'} size={20} color={lives >= 1 ? '#EF4444' : '#64748B'} />
        <Ionicons name={lives >= 2 ? 'heart' : 'heart-dislike'} size={20} color={lives >= 2 ? '#EF4444' : '#64748B'} />
        <Ionicons name={lives >= 3 ? 'heart' : 'heart-dislike'} size={20} color={lives >= 3 ? '#EF4444' : '#64748B'} />
      </View>
    );
  };

  const timerColor = secondsLeft <= 3 ? '#EF4444' : secondsLeft <= 6 ? '#F59E0B' : '#10B981';

  return (
    <Screen scroll={true}>
      <TopBar
        title={t.survival.title}
        action={
          <Pressable
            onPress={() => setShowSetPicker(true)}
            style={({ pressed }) => [styles.pickerPill, { opacity: pressed ? 0.75 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Switch question set"
          >
            <Ionicons name="folder-outline" size={15} color={palette.indigo} />
            <Text style={[styles.pickerPillText, { color: palette.indigo }]} numberOfLines={1}>
              {currentSet?.title || t.survival.selectSet}
            </Text>
            <Ionicons name="chevron-down" size={14} color={palette.indigo} />
          </Pressable>
        }
      />

      {/* Hero Stats */}
      <View style={styles.gameHeader}>
        <View style={styles.badgeRow}>
          <Badge tone="danger">{t.survival.tag}</Badge>
          <Badge tone="primary">
            {t.survival.round} {questionIndex + 1}/{questions.length}
          </Badge>
        </View>

        <View style={[styles.timerContainer, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
          <View style={styles.timerMetaRow}>
            <View style={styles.timerMetaLeft}>
              <Ionicons name="hourglass-outline" size={18} color={timerColor} />
              <Text style={[typography.title, { color: timerColor, fontSize: 16 }]}>
                {secondsLeft} {t.survival.secondsLeft}
              </Text>
            </View>
            <View style={styles.userHearts}>
              <Text style={[typography.caption, { color: palette.inkMuted, marginRight: 6 }]}>
                {t.survival.livesLabel}:
              </Text>
              {renderHearts(userPlayer?.lives ?? 0)}
            </View>
          </View>

          {/* Animated Countdown Bar */}
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: timerColor,
                  width: timerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Arena Roster Bar */}
      <Text style={[typography.label, { color: palette.indigo, marginTop: spacing.xs, marginBottom: spacing.xs }]}>
        {t.survival.challengersTitle}
      </Text>
      <View style={styles.rosterContainer}>
        {competitors.map((c) => {
          const isAlive = c.status === 'alive';
          const isMe = c.id === 'user';
          return (
            <View
              key={c.id}
              style={[
                styles.rosterCard,
                {
                  backgroundColor: isMe ? palette.indigoTint : palette.paperRaised,
                  borderColor: isAlive ? (isMe ? palette.indigo : palette.paperMuted) : palette.dangerTint,
                  opacity: isAlive ? 1 : 0.45,
                },
              ]}
            >
              <View style={styles.rosterAvatar}>
                <Ionicons
                  name={isAlive ? (c.avatar as any) : 'skull'}
                  size={16}
                  color={isAlive ? (isMe ? palette.indigo : palette.ink) : palette.danger}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.caption, { fontWeight: '700', color: palette.ink }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  {isAlive ? (
                    renderHearts(c.lives)
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: '800', color: palette.danger }}>
                      {t.survival.eliminated}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Question Card */}
      {currentQuestion ? (
        <Card style={styles.questionCard}>
          <Text style={[typography.heading, { color: palette.ink, fontSize: 18, lineHeight: 26 }]}>
            {currentQuestion.content}
          </Text>

          <View style={styles.optionsList}>
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedOption === index;
              const isCorrect = isAnswerLocked && index === currentQuestion.correctIndex;
              const isWrong = isAnswerLocked && isSelected && index !== currentQuestion.correctIndex;

              let btnVariant: 'primary' | 'secondary' | 'success' | 'danger' = 'secondary';
              if (isCorrect) btnVariant = 'success';
              else if (isWrong) btnVariant = 'danger';
              else if (isSelected) btnVariant = 'primary';

              return (
                <Button
                  key={index}
                  variant={btnVariant}
                  fullWidth
                  disabled={isAnswerLocked || (userPlayer?.lives ?? 0) <= 0}
                  onPress={() => handleOptionPress(index)}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Button>
              );
            })}
          </View>

          {isAnswerLocked && currentQuestion.explanation && (
            <View style={[styles.explanationBox, { backgroundColor: palette.indigoTint }]}>
              <Ionicons name="information-circle" size={18} color={palette.indigo} />
              <Text style={[typography.caption, { color: palette.indigoDeep, flex: 1, lineHeight: 18 }]}>
                {currentQuestion.explanation}
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <Ionicons name="alert-circle" size={44} color={palette.gold} />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            Chưa có câu hỏi nào trong bộ này
          </Text>
        </Card>
      )}

      {/* Set Picker Modal */}
      <Modal visible={showSetPicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.paper }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.title, { color: palette.ink }]}>{t.survival.selectSet}</Text>
              <Pressable onPress={() => setShowSetPicker(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={palette.ink} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {questionSets.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setActiveSetId(s.id);
                    setShowSetPicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.setOptionRow,
                    {
                      backgroundColor: s.id === currentSet?.id ? palette.indigoTint : 'transparent',
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="book" size={20} color={palette.indigo} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.title, { fontSize: 15, color: palette.ink }]}>
                      {s.title}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      {s.questions.length} câu hỏi · {s.subject || 'Chưa phân loại'}
                    </Text>
                  </View>
                  {s.id === currentSet?.id && (
                    <Ionicons name="checkmark-circle" size={22} color={palette.indigo} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Knockout / Victory Dialog */}
      <Modal visible={isGameOver} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.victoryModal, { backgroundColor: palette.paper }]}>
            <View
              style={[
                styles.trophyWrapper,
                {
                  backgroundColor: isVictory ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                },
              ]}
            >
              <Ionicons
                name={isVictory ? 'trophy' : 'skull'}
                size={54}
                color={isVictory ? palette.gold : palette.danger}
              />
            </View>

            <Text
              style={[
                typography.display,
                {
                  color: isVictory ? palette.ink : palette.danger,
                  textAlign: 'center',
                  fontSize: 24,
                },
              ]}
            >
              {isVictory ? t.survival.survivalChampion : t.survival.knockoutTitle}
            </Text>
            <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 6 }]}>
              {isVictory ? t.survival.championSub : t.survival.knockoutSub}
            </Text>

            {/* Scoreboard Card */}
            <View style={[styles.victoryCard, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
              <View style={styles.statRowItem}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>{t.survival.survivedRounds}</Text>
                <Text style={[typography.title, { color: palette.ink }]}>
                  {roundsSurvived} / {questions.length}
                </Text>
              </View>
              <View style={styles.statRowItem}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>Số câu chính xác</Text>
                <Text style={[typography.title, { color: palette.mint }]}>
                  {correctAnswersCount}
                </Text>
              </View>
              <View style={styles.statRowItem}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>{t.survival.livesLabel} còn lại</Text>
                <View>{renderHearts(userPlayer?.lives ?? 0)}</View>
              </View>
              <View style={[styles.statRowItem, { borderTopWidth: 1, borderColor: palette.paperMuted, paddingTop: 10 }]}>
                <Text style={[typography.title, { color: palette.indigo }]}>Điểm sinh tồn (XP)</Text>
                <Text style={[typography.display, { color: palette.gold, fontSize: 24 }]}>
                  +{roundsSurvived * 40 + (isVictory ? 200 : 0)} XP
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={{ width: '100%', marginTop: 8 }}>
              <Button variant="reward" fullWidth icon="refresh" onPress={startNewGame}>
                {t.survival.playAgain}
              </Button>
              <View style={{ height: 10 }} />
              <Button
                variant="secondary"
                fullWidth
                icon="folder-open"
                onPress={() => {
                  setIsGameOver(false);
                  setShowSetPicker(true);
                }}
              >
                {t.survival.selectSet}
              </Button>
              <View style={{ height: 10 }} />
              <Button
                variant="ghost"
                fullWidth
                icon="home-outline"
                onPress={() => router.replace('/')}
              >
                {t.survival.backHome}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    maxWidth: 160,
  },
  pickerPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gameHeader: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timerContainer: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
  },
  timerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userHearts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rosterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  rosterCard: {
    flex: 1,
    minWidth: '46%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  rosterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(150, 150, 150, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionCard: {
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  optionsList: {
    gap: 10,
    marginTop: spacing.lg,
  },
  explanationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radii.lg,
    padding: 20,
    maxHeight: '80%',
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  setOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 6,
  },
  victoryModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  trophyWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  victoryCard: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginVertical: 14,
    gap: 10,
  },
  statRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
