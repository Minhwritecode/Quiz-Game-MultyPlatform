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
import { CharacterHero, CharacterAction } from '@/shared/CharacterHero';
import { GameEnvironment } from '@/shared/GameEnvironment';
import { MagicParticles } from '@/shared/MagicParticles';
import { sfx } from '@/core/audio/sfx';
import { RenderModeToggle } from '@/shared/RenderModeToggle';
import { SoundToggle } from '@/shared/SoundToggle';
import { useStreakStore } from '@/features/streak/state/useStreakStore';

// ─── 3D Flip Card Component ───────────────────────────────────────────────
const CYAN = '#06B6D4';
const GOLD = '#FBBF24';
const INDIGO = '#4F46E5';
const VIOLET = '#7C3AED';

function FlipCard({
  card,
  width: cardWidth,
  palette,
  onPress,
}: {
  card: MatchCard;
  width: number;
  palette: ReturnType<typeof usePalette>;
  onPress: () => void;
}) {
  const flipAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevState = useRef(card.state);

  useEffect(() => {
    if (prevState.current === card.state) return;
    prevState.current = card.state;

    if (card.state === 'flipped' || card.state === 'matched') {
      Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 100 }).start();
    } else if (card.state === 'hidden') {
      Animated.spring(flipAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 100 }).start();
    } else if (card.state === 'wrong') {
      // Shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }

    if (card.state === 'matched') {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [card.state]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const isFlipped = card.state === 'flipped' || card.state === 'matched';
  const isMatched = card.state === 'matched';
  const isWrong = card.state === 'wrong';

  const cardH = Math.round(cardWidth * 1.3);

  const matchBg = isMatched
    ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981', borderWidth: 2 }
    : {};
  const wrongBorder = isWrong ? { borderColor: '#EF4444', borderWidth: 2 } : {};

  return (
    <Animated.View
      style={{
        transform: [{ translateX: shakeAnim }, { scale: scaleAnim }],
        width: cardWidth,
        height: cardH,
      }}
    >
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        {/* Back face (hidden) */}
        <Animated.View
          style={[
            styles.flipFace,
            { width: cardWidth, height: cardH, backfaceVisibility: 'hidden', transform: [{ rotateY: frontRotate }] },
            { backgroundColor: 'rgba(79, 70, 229, 0.12)', borderColor: INDIGO, borderWidth: 1.5 },
            wrongBorder,
          ]}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, gap: 6 }}>
            {/* Rune symbol on back */}
            <Text style={{ fontSize: 28, opacity: 0.7 }}>
              {isWrong ? '💨' : '✦'}
            </Text>
            <Text style={{ fontSize: 10, color: CYAN, fontWeight: '800', letterSpacing: 2, opacity: 0.8 }}>
              {isWrong ? 'WRONG' : 'RUNE'}
            </Text>
          </View>
        </Animated.View>

        {/* Front face (content) */}
        <Animated.View
          style={[
            styles.flipFace,
            {
              position: 'absolute',
              width: cardWidth,
              height: cardH,
              backfaceVisibility: 'hidden',
              transform: [{ rotateY: backRotate }],
            },
            {
              backgroundColor: card.type === 'question'
                ? 'rgba(79, 70, 229, 0.18)'
                : 'rgba(6, 182, 212, 0.14)',
              borderColor: card.type === 'question' ? VIOLET : CYAN,
              borderWidth: 2,
            },
            matchBg,
          ]}
        >
          <View style={{ flex: 1, padding: 8, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{
                fontSize: 10, fontWeight: '800', letterSpacing: 1,
                color: card.type === 'question' ? VIOLET : CYAN,
              }}>
                {card.type === 'question' ? '📜 Q' : '💡 A'}
              </Text>
              {isMatched && <Text style={{ fontSize: 14 }}>✅</Text>}
            </View>
            <Text style={[styles.cardText, { color: palette.ink }]} numberOfLines={4}>
              {card.text}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Scroll Mascot Companion ───────────────────────────────────────────────
function ScrollMascot({ action }: { action: 'idle' | 'happy' | 'sad' }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (action === 'happy') {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -18, duration: 180, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: -12, duration: 140, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 200, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    } else if (action === 'sad') {
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: 5, duration: 200, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: -5, duration: 1000, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [action]);

  const rotate = rotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-20deg', '0deg', '20deg'] });
  const emoji = action === 'happy' ? '🎉' : action === 'sad' ? '😔' : '📜';

  return (
    <Animated.View style={{ transform: [{ translateY: bounceAnim }, { rotate }], alignItems: 'center' }}>
      <View style={styles.mascotBody}>
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
      </View>
      <Text style={{ fontSize: 10, color: GOLD, fontWeight: '800', marginTop: 2, letterSpacing: 1 }}>
        {action === 'happy' ? 'MATCHED!' : action === 'sad' ? 'TRY AGAIN' : 'SCROLL'}
      </Text>
    </Animated.View>
  );
}

interface MatchCard {
  id: string;
  pairId: string;
  type: 'question' | 'answer';
  text: string;
  state: 'hidden' | 'flipped' | 'matched' | 'wrong';
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = temp;
  }
  return arr;
}

export default function MatchGameScreen() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  const palette = usePalette();
  const { t, language } = useI18n();
  const { width } = useWindowDimensions();

  const questionSets = usePapyrusStore((s) => s.questionSets);
  const [activeSetId, setActiveSetId] = useState<string | null>(setId ?? null);
  const [showSetPicker, setShowSetPicker] = useState(false);

  // Fallback to first available set with at least 3 questions
  const currentSet = useMemo(() => {
    if (activeSetId) {
      const found = questionSets.find((s) => s.id === activeSetId);
      if (found) return found;
    }
    return questionSets.find((s) => s.questions.length >= 3) ?? questionSets[0] ?? null;
  }, [activeSetId, questionSets]);

  // Game Play State
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<MatchCard[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [totalPairs, setTotalPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [characterAction, setCharacterAction] = useState<CharacterAction>('idle');
  const [mascotAction, setMascotAction] = useState<'idle' | 'happy' | 'sad'>('idle');
  const [particleTrigger, setParticleTrigger] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prepare cards when currentSet changes
  const initGame = () => {
    if (!currentSet || currentSet.questions.length < 3) {
      setCards([]);
      setTotalPairs(0);
      return;
    }

    // Pick up to 6 questions for a balanced 12-card puzzle
    const questionsPool = shuffle(currentSet.questions).slice(0, 6);
    const newCards: MatchCard[] = [];

    questionsPool.forEach((q, index) => {
      const pairId = `pair-${q.id || index}`;
      const correctOption = q.options[q.correctIndex] || q.options[0] || 'Correct answer';

      newCards.push({
        id: `${pairId}-q`,
        pairId,
        type: 'question',
        text: q.content,
        state: 'hidden',
      });

      newCards.push({
        id: `${pairId}-a`,
        pairId,
        type: 'answer',
        text: correctOption,
        state: 'hidden',
      });
    });

    setCards(shuffle(newCards));
    setTotalPairs(questionsPool.length);
    setMatchedPairs(0);
    setMoves(0);
    setCombo(0);
    setMaxCombo(0);
    setSeconds(0);
    setSelectedCards([]);
    setIsEvaluating(false);
    setIsGameOver(false);
    setIsTimerRunning(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentSet?.id]);

  // Stopwatch timer
  useEffect(() => {
    if (isTimerRunning && !isGameOver) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isGameOver]);

  const handleCardPress = (card: MatchCard) => {
    if (isEvaluating || card.state === 'matched' || card.state === 'flipped') return;

    sfx.playCardFlip();

    // Start timer on first card tap
    if (!isTimerRunning) {
      setIsTimerRunning(true);
    }

    const nextFlippedCard: MatchCard = { ...card, state: 'flipped' };
    const nextCards = cards.map((c) => (c.id === card.id ? nextFlippedCard : c));
    setCards(nextCards);

    const newSelected = [...selectedCards, nextFlippedCard];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      setIsEvaluating(true);
      setMoves((m) => m + 1);

      const [first, second] = newSelected;
      if (!first || !second) {
        setIsEvaluating(false);
        return;
      }

      if (first.pairId === second.pairId) {
        // MATCH!
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        if (nextCombo > maxCombo) setMaxCombo(nextCombo);
        if (nextCombo >= 2) {
          sfx.playCombo();
        } else {
          sfx.playCorrect();
        }
        setCharacterAction('attack');
        setMascotAction('happy');
        setParticleTrigger((p) => p + 1);

        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === first.id || c.id === second.id ? { ...c, state: 'matched' } : c
            )
          );
          setSelectedCards([]);
          setIsEvaluating(false);

          const nextMatched = matchedPairs + 1;
          setMatchedPairs(nextMatched);

          if (nextMatched === totalPairs) {
            sfx.playLevelUp();
            useStreakStore.getState().recordActivity('study_quiz');
            setIsGameOver(true);
            setIsTimerRunning(false);
            setCharacterAction('victory');
            setMascotAction('happy');
          } else {
            setCharacterAction('idle');
            setTimeout(() => setMascotAction('idle'), 800);
          }
        }, 400);
      } else {
        // MISMATCH!
        sfx.playWrong();
        setCombo(0);
        setCharacterAction('hurt');
        setMascotAction('sad');
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === first.id || c.id === second.id ? { ...c, state: 'wrong' } : c
            )
          );
        }, 200);

        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === first.id || c.id === second.id ? { ...c, state: 'hidden' } : c
            )
          );
          setSelectedCards([]);
          setIsEvaluating(false);
          setCharacterAction('idle');
          setTimeout(() => setMascotAction('idle'), 400);
        }, 900);
      }
    }
  };

  // Calculations for Victory
  const starsEarned = useMemo(() => {
    if (!totalPairs) return 1;
    if (moves <= totalPairs + 2) return 3;
    if (moves <= totalPairs * 2) return 2;
    return 1;
  }, [moves, totalPairs]);

  const xpEarned = useMemo(() => {
    const base = totalPairs * 20;
    const speedBonus = Math.max(0, 50 - Math.floor(seconds / 2));
    const comboBonus = maxCombo * 10;
    return base + speedBonus + comboBonus;
  }, [totalPairs, seconds, maxCombo]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Layout calculations
  const columns = width >= 800 ? 4 : 3;
  const cardWidth = Math.min((width - 48 - (columns - 1) * 12) / columns, 240);

  return (
    <Screen scroll={true}>
      <GameEnvironment gameMode="match">
      <TopBar
        title={t.match.title}
        action={
          <Pressable
            onPress={() => setShowSetPicker(true)}
            style={({ pressed }) => [styles.pickerPill, { opacity: pressed ? 0.75 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Switch question set"
          >
            <Ionicons name="folder-outline" size={16} color={CYAN} />
            <Text style={[styles.pickerPillText, { color: CYAN }]} numberOfLines={1}>
              {currentSet?.title || t.match.selectSet}
            </Text>
            <Ionicons name="chevron-down" size={14} color={CYAN} />
          </Pressable>
        }
      />

      {/* Library Environment Header */}
      <View style={styles.libraryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.heading, { color: '#FEF3C7' }]}>🏛️ {t.match.title}</Text>
          <Text style={[typography.body, { color: 'rgba(254,243,199,0.65)', marginTop: 4 }]}>
            {t.match.subtitle}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <RenderModeToggle compact />
          <SoundToggle />
        </View>
      </View>

      {/* Scroll Mascot Companion + Particle burst on match */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xs, position: 'relative' }}>
        <MagicParticles color={GOLD} count={8} type="butterflies" trigger={particleTrigger}
          style={{ position: 'absolute', top: -20, zIndex: 10 }} />
        <ScrollMascot action={mascotAction} />
        {combo > 1 && (
          <View style={styles.comboBadge}>
            <Text style={styles.comboText}>🔥 COMBO x{combo}!</Text>
          </View>
        )}
      </View>

      {/* Stat Bar */}
      <View style={[styles.statRow, { backgroundColor: 'rgba(0,0,0,0.4)', borderColor: 'rgba(6,182,212,0.3)' }]}>
        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>{t.match.timer}</Text>
          <View style={styles.statValRow}>
            <Ionicons name="timer-outline" size={18} color={palette.indigo} />
            <Text style={[typography.title, { color: palette.ink }]}>{formatTimer(seconds)}</Text>
          </View>
        </View>

        <View style={styles.statItemDivider} />

        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>{t.match.moves}</Text>
          <View style={styles.statValRow}>
            <Ionicons name="swap-horizontal" size={18} color={palette.gold} />
            <Text style={[typography.title, { color: palette.ink }]}>{moves}</Text>
          </View>
        </View>

        <View style={styles.statItemDivider} />

        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>{t.match.combo}</Text>
          <View style={styles.statValRow}>
            <Ionicons name="flame" size={18} color={combo > 1 ? palette.danger : palette.inkMuted} />
            <Text
              style={[
                typography.title,
                { color: combo > 1 ? palette.danger : palette.ink },
              ]}
            >
              x{combo}
            </Text>
          </View>
        </View>

        <View style={styles.statItemDivider} />

        <View style={styles.statItem}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>{t.match.pairsFound}</Text>
          <View style={styles.statValRow}>
            <Ionicons name="checkmark-done" size={18} color={palette.mint} />
            <Text style={[typography.title, { color: palette.mint }]}>
              {matchedPairs}/{totalPairs}
            </Text>
          </View>
        </View>
      </View>

      {/* Card Grid */}
      {(!currentSet || currentSet.questions.length < 3) ? (
        <Card style={styles.emptySetCard}>
          <Ionicons name="alert-circle-outline" size={48} color={GOLD} />
          <Text style={[typography.title, { color: '#FEF3C7', marginTop: spacing.md, textAlign: 'center' }]}>
            {t.match.needMoreQuestions}
          </Text>
          <View style={{ marginTop: spacing.lg, width: '100%', maxWidth: 300 }}>
            <Button variant="primary" fullWidth onPress={() => setShowSetPicker(true)}>
              {t.match.selectSet}
            </Button>
          </View>
        </Card>
      ) : (
        <View style={styles.gridContainer}>
          {cards.map((card) => (
            <FlipCard
              key={card.id}
              card={card}
              width={cardWidth}
              palette={palette}
              onPress={() => handleCardPress(card)}
            />
          ))}
        </View>
      )}

      {/* Set Picker Modal */}
      <Modal visible={showSetPicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.paper }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.title, { color: palette.ink }]}>{t.match.selectSet}</Text>
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
                  <Ionicons
                    name={s.questions.length >= 3 ? 'book' : 'alert-circle'}
                    size={22}
                    color={s.questions.length >= 3 ? palette.indigo : palette.gold}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.title, { fontSize: 16, color: palette.ink }]}>
                      {s.title}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      {s.questions.length} {t.library.questionsCount} · {s.subject || t.library.uncategorized}
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

      {/* Victory Modal */}
      <Modal visible={isGameOver} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.victoryModal, { backgroundColor: palette.paper }]}>
            <View style={{ alignItems: 'center', marginBottom: spacing.xs }}>
              <CharacterHero action="victory" size="md" />
            </View>

            <Text style={[typography.display, { color: palette.ink, textAlign: 'center', fontSize: 26 }]}>
              {t.match.victoryTitle}
            </Text>
            <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 6 }]}>
              {t.match.victorySubtitle}
            </Text>

            {/* Stars row */}
            <View style={styles.starsRow}>
              <Ionicons name={starsEarned >= 1 ? 'star' : 'star-outline'} size={38} color={palette.gold} />
              <Ionicons name={starsEarned >= 2 ? 'star' : 'star-outline'} size={46} color={palette.gold} style={{ marginHorizontal: 8 }} />
              <Ionicons name={starsEarned >= 3 ? 'star' : 'star-outline'} size={38} color={palette.gold} />
            </View>

            {/* Scorecard */}
            <View style={[styles.victoryCard, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
              <View style={styles.victoryRow}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>{t.match.timeTaken}</Text>
                <Text style={[typography.title, { color: palette.ink }]}>{formatTimer(seconds)}</Text>
              </View>
              <View style={styles.victoryRow}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>{t.match.totalMoves}</Text>
                <Text style={[typography.title, { color: palette.ink }]}>{moves}</Text>
              </View>
              <View style={styles.victoryRow}>
                <Text style={[typography.body, { color: palette.inkMuted }]}>{t.match.combo} Max</Text>
                <Text style={[typography.title, { color: palette.danger }]}>x{maxCombo}</Text>
              </View>
              <View style={[styles.victoryRow, { borderTopWidth: 1, borderColor: palette.paperMuted, paddingTop: 10 }]}>
                <Text style={[typography.title, { color: palette.indigo }]}>{t.match.xpEarned}</Text>
                <Text style={[typography.display, { color: palette.gold, fontSize: 24 }]}>+{xpEarned} XP</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.victoryActions}>
              <Button variant="reward" fullWidth icon="refresh" onPress={initGame}>
                {t.match.playAgain}
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
                {t.match.changeSet}
              </Button>
              <View style={{ height: 10 }} />
              <Button
                variant="ghost"
                fullWidth
                icon="home-outline"
                onPress={() => router.replace('/')}
              >
                {t.match.backHome}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
      </GameEnvironment>
    </Screen>
  );
}

const styles = StyleSheet.create({
  libraryHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  comboBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  comboText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  mascotBody: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipFace: {
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statItemDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderBottomWidth: 4,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },
  cardBackContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  cardFrontContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  cardTypeBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cardText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 'auto',
  },
  emptySetCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  victoryCard: {
    width: '100%',
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
    marginVertical: 14,
    gap: 10,
  },
  victoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  victoryActions: {
    width: '100%',
    marginTop: 8,
  },
});
