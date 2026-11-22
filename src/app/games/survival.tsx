import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';

// ─── Color palette ────────────────────────────────────────────────────────
const INDIGO = '#4F46E5';
const VIOLET = '#7C3AED';
const GOLD = '#FBBF24';
const CYAN = '#06B6D4';
const DARK = '#0F172A';

interface Competitor {
  id: string;
  name: string;
  avatar: string;
  lives: number;
  score: number;
  isBot: boolean;
  status: 'alive' | 'knocked_out';
}

// ─── Boss character ────────────────────────────────────────────────────────
const BossCharacter = memo(function BossCharacter({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const hpRatio = Math.max(0, hp / maxHp);
  const size = 56 + hpRatio * 24; // boss shrinks as hp drops

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#7F1D1D',
          borderWidth: 2,
          borderColor: '#EF4444',
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ scale: pulseAnim }, { translateX: shakeAnim }],
          shadowColor: '#EF4444',
          shadowRadius: 15,
          shadowOpacity: 0.8,
          elevation: 15,
        }}
      >
        <Text style={{ fontSize: 22 }}>👹</Text>
      </Animated.View>
      <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '800', marginTop: 4 }}>BOSS</Text>
      {/* Boss HP bar */}
      <View style={{ width: 60, height: 5, backgroundColor: '#450A0A', borderRadius: 3, marginTop: 3 }}>
        <View
          style={{
            width: `${hpRatio * 100}%`,
            height: '100%',
            backgroundColor: '#EF4444',
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
});

// ─── Knowledge Beam ────────────────────────────────────────────────────────
const KnowledgeBeam = memo(function KnowledgeBeam({ visible }: { visible: boolean }) {
  const scaleXAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scaleXAnim.setValue(0.01);
    opacityAnim.setValue(1);
    const anim = Animated.parallel([
      Animated.timing(scaleXAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [visible, scaleXAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        height: 4,
        width: '100%',
        backgroundColor: CYAN,
        borderRadius: 2,
        opacity: opacityAnim,
        transformOrigin: 'left',
        transform: [{ scaleX: scaleXAnim }],
        shadowColor: CYAN,
        shadowRadius: 8,
        shadowOpacity: 1,
        elevation: 20,
        marginVertical: 4,
      }}
    />
  );
});

// ─── Crystal Heart ─────────────────────────────────────────────────────────
const CrystalHeart = memo(function CrystalHeart({ alive, breaking }: { alive: boolean; breaking: boolean }) {
  const breakAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!breaking) return;
    const anim = Animated.sequence([
      Animated.timing(breakAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(breakAnim, { toValue: 0.6, duration: 200, useNativeDriver: true }),
      Animated.timing(breakAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [breaking, breakAnim]);

  return (
    <Animated.Text
      style={{
        fontSize: 20,
        transform: [{ scale: breakAnim }],
        opacity: alive ? 1 : 0.3,
      }}
    >
      {alive ? '❤️‍🔥' : '🩶'}
    </Animated.Text>
  );
});

// ─── Timer Orb ─────────────────────────────────────────────────────────────
const TimerOrb = memo(function TimerOrb({ seconds, maxSeconds = 12 }: { seconds: number; maxSeconds?: number }) {
  const ratio = seconds / maxSeconds;
  const orbColor =
    ratio > 0.5 ? GOLD :
    ratio > 0.25 ? '#F59E0B' :
    '#EF4444';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isUrgent = seconds <= 3;

  useEffect(() => {
    if (!isUrgent) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 300, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulseAnim.setValue(1);
    };
  }, [isUrgent, pulseAnim]);

  const orbSize = 20 + ratio * 20;

  return (
    <Animated.View
      style={{
        width: orbSize,
        height: orbSize,
        borderRadius: orbSize / 2,
        backgroundColor: orbColor,
        shadowColor: orbColor,
        shadowRadius: 10,
        shadowOpacity: 0.9,
        elevation: 15,
        transform: [{ scale: pulseAnim }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{seconds}</Text>
    </Animated.View>
  );
});

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function SurvivalGameScreen() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  const palette = usePalette();
  const isVip = useMembershipStore((state) => state.tier === 'archmage');
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
  const [characterAction, setCharacterAction] = useState<CharacterAction>('idle');

  // Visual state
  const [beamVisible, setBeamVisible] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [breakingHeart, setBreakingHeart] = useState<number | null>(null);
  const [bossHp, setBossHp] = useState(10);

  // Score display animation
  const scoreDisplayAnim = useRef(new Animated.Value(1)).current;

  // Competitors Roster: User + 3 AI Challengers
  const [competitors, setCompetitors] = useState<Competitor[]>([
    { id: 'user', name: 'Bạn (Player)', avatar: 'person', lives: 3, score: 0, isBot: false, status: 'alive' },
    { id: 'bot-1', name: 'Bot Cao Thủ', avatar: 'shield', lives: 3, score: 0, isBot: true, status: 'alive' },
    { id: 'bot-2', name: 'Bot Phản Xạ', avatar: 'flash', lives: 3, score: 0, isBot: true, status: 'alive' },
    { id: 'bot-3', name: 'Bot Tân Binh', avatar: 'fitness', lives: 3, score: 0, isBot: true, status: 'alive' },
  ]);

  const timerAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearScheduledTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((item) => item !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearScheduledTimeouts(), [clearScheduledTimeouts]);

  const currentQuestion = questions[questionIndex];
  const userPlayer = competitors.find((c) => c.id === 'user');

  // Start / Restart Game
  const startNewGame = () => {
    clearScheduledTimeouts();
    setQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerLocked(false);
    setCharacterAction('idle');
    setSecondsLeft(12);
    setIsGameOver(false);
    setIsUserKnockedOut(false);
    setIsVictory(false);
    setRoundsSurvived(0);
    setCorrectAnswersCount(0);
    setBeamVisible(false);
    setBossHp(10);
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

    const barAnim = Animated.timing(timerAnim, {
      toValue: 0,
      duration: 12000,
      useNativeDriver: true,
    });
    barAnim.start();

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
      barAnim.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [questionIndex, isGameOver, currentQuestion]);

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
      sfx.playSpellCast();
      sfx.playCorrect();
      setCorrectAnswersCount((c) => c + 1);
      setCharacterAction('attack');
      // Trigger beam and particles
      setBeamVisible(false);
      scheduleTimeout(() => setBeamVisible(true), 50);
      scheduleTimeout(() => setBeamVisible(false), 700);
      setParticleTrigger((t) => t + 1);
      // Boss takes damage
      setBossHp((hp) => Math.max(0, hp - 1));
      // Animate score
      Animated.sequence([
        Animated.timing(scoreDisplayAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(scoreDisplayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      sfx.playWrong();
      sfx.playCrystalBreak();
      setCharacterAction('hurt');
      // Break a heart
      const curLives = userPlayer?.lives ?? 3;
      setBreakingHeart(curLives - 1);
      scheduleTimeout(() => setBreakingHeart(null), 500);
    }

    // Resolve AI Bots responses
    const nextCompetitors = competitors.map((c) => {
      if (c.id === 'user') {
        if (c.lives <= 0) return c;
        const newLives = isUserCorrect ? c.lives : Math.max(0, c.lives - 1);
        const basePoints = 1000 + secondsLeft * 50;
        const newScore = isUserCorrect ? c.score + Math.round(basePoints * (isVip ? 2 : 1)) : c.score;
        return {
          ...c,
          lives: newLives,
          score: newScore,
          status: (newLives <= 0 ? 'knocked_out' : 'alive') as 'alive' | 'knocked_out',
        };
      }

      if (c.status === 'knocked_out') return c;
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

    scheduleTimeout(() => {
      if (updatedUser.lives <= 0) {
        setIsUserKnockedOut(true);
        setIsGameOver(true);
        setCharacterAction('hurt');
      } else if (aliveCount === 1 && updatedUser.status === 'alive') {
        sfx.playLevelUp();
        useStreakStore.getState().recordActivity('study_quiz');
        setIsVictory(true);
        setIsGameOver(true);
        setCharacterAction('victory');
      } else if (isLastRound) {
        sfx.playLevelUp();
        useStreakStore.getState().recordActivity('study_quiz');
        setIsVictory(true);
        setIsGameOver(true);
        setCharacterAction('victory');
      } else {
        setQuestionIndex((i) => i + 1);
        setSelectedOption(null);
        setIsAnswerLocked(false);
        setCharacterAction('idle');
      }
    }, 1800);
  };

  const renderHearts = (lives: number) => {
    return (
      <View style={styles.heartsRow}>
        {[0, 1, 2].map((i) => (
          <CrystalHeart
            key={i}
            alive={lives > i}
            breaking={breakingHeart === i}
          />
        ))}
      </View>
    );
  };

  const timerColor = secondsLeft <= 3 ? '#EF4444' : secondsLeft <= 6 ? '#F59E0B' : CYAN;

  return (
    <GameEnvironment gameMode="survival">
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
              <Ionicons name="folder-outline" size={15} color={CYAN} />
              <Text style={[styles.pickerPillText, { color: CYAN }]} numberOfLines={1}>
                {currentSet?.title || t.survival.selectSet}
              </Text>
              <Ionicons name="chevron-down" size={14} color={CYAN} />
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
            <View style={{ flex: 1 }} />
            <RenderModeToggle compact />
            <SoundToggle />
          </View>

          {/* Timer Row with Orb */}
          <View style={[styles.timerContainer, { backgroundColor: 'rgba(15,23,42,0.85)', borderColor: CYAN }]}>
            <View style={styles.timerMetaRow}>
              <View style={styles.timerMetaLeft}>
                <TimerOrb seconds={secondsLeft} />
                <Text style={[typography.title, { color: timerColor, fontSize: 16 }]}>
                  {secondsLeft} {t.survival.secondsLeft}
                </Text>
              </View>
              <View style={styles.userHearts}>
                <Text style={[typography.caption, { color: 'rgba(255,255,255,0.6)', marginRight: 6 }]}>
                  {t.survival.livesLabel}:
                </Text>
                {renderHearts(userPlayer?.lives ?? 0)}
              </View>
            </View>

            {/* Animated Countdown Bar (GPU native-driver scaleX) */}
            <View style={styles.progressBarTrack}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: timerColor,
                    width: '100%',
                    transformOrigin: 'left',
                    transform: [{ scaleX: timerAnim }],
                    shadowColor: timerColor,
                    shadowRadius: 6,
                    shadowOpacity: 0.8,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Arena Roster Bar */}
        <Text style={[typography.label, { color: CYAN, marginTop: spacing.xs, marginBottom: spacing.xs }]}>
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
                    backgroundColor: isMe ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.05)',
                    borderColor: isAlive ? (isMe ? INDIGO : 'rgba(255,255,255,0.15)') : '#450A0A',
                    opacity: isAlive ? 1 : 0.45,
                  },
                ]}
              >
                <View style={[styles.rosterAvatar, { backgroundColor: isMe ? 'rgba(79,70,229,0.3)' : 'rgba(255,255,255,0.08)' }]}>
                  <Ionicons
                    name={isAlive ? (c.avatar as any) : 'skull'}
                    size={16}
                    color={isAlive ? (isMe ? INDIGO : '#E0E7FF') : '#EF4444'}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.caption, { fontWeight: '700', color: '#E0E7FF' }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    {isAlive ? (
                      renderHearts(c.lives)
                    ) : (
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>
                        {t.survival.eliminated}
                      </Text>
                    )}
                  </View>
                </View>
                {/* Score */}
                <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>{c.score}</Text>
              </View>
            );
          })}
        </View>

        {/* Character Battle Stage */}
        <View style={styles.battleStage}>
          {/* Player mage */}
          <View style={{ alignItems: 'center', flex: 1 }}>
            <CharacterHero
              action={characterAction}
              hp={userPlayer?.lives ?? 3}
              maxHp={3}
              size="md"
              name={userPlayer?.name ?? 'Papyrus Scholar'}
              showHealthBar
            />
          </View>

          {/* Knowledge Beam in center */}
          <View style={{ flex: 2, justifyContent: 'center' }}>
            <KnowledgeBeam visible={beamVisible} />
            {/* Particle burst overlay */}
            <View style={{ position: 'relative', height: 60, alignItems: 'center' }}>
              <MagicParticles
                color={CYAN}
                count={8}
                type="sparkles"
                trigger={particleTrigger}
                style={{ position: 'absolute', top: -60, left: '50%' }}
              />
            </View>
          </View>

          {/* Boss */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <BossCharacter hp={bossHp} maxHp={10} />
          </View>
        </View>

        {/* Score display */}
        <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
          <Animated.Text
            style={[
              typography.display,
              {
                color: GOLD,
                fontSize: 20,
                transform: [{ scale: scoreDisplayAnim }],
                textShadowColor: GOLD,
                textShadowRadius: 8,
              },
            ]}
          >
            ⭐ {userPlayer?.score ?? 0} pts {isVip ? '👑 ×2' : ''}
          </Animated.Text>
        </View>

        {/* Question Card — glass-morphism */}
        {currentQuestion ? (
          <View style={[styles.glassCard, { borderColor: CYAN }]}>
            <Text style={[typography.heading, { color: '#E0F7FF', fontSize: 17, lineHeight: 26 }]}>
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
              <View style={[styles.explanationBox, { backgroundColor: 'rgba(6,182,212,0.1)', borderColor: CYAN }]}>
                <Ionicons name="information-circle" size={18} color={CYAN} />
                <Text style={[typography.caption, { color: '#BAE6FD', flex: 1, lineHeight: 18 }]}>
                  {currentQuestion.explanation}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.glassCard, { alignItems: 'center', paddingVertical: spacing.xl }]}>
            <Ionicons name="alert-circle" size={44} color={GOLD} />
            <Text style={[typography.title, { color: '#E0E7FF', marginTop: spacing.md }]}>
              Chưa có câu hỏi nào trong bộ này
            </Text>
          </View>
        )}

        {/* Set Picker Modal */}
        <Modal visible={showSetPicker} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: DARK, borderColor: CYAN, borderWidth: 1 }]}>
              <View style={styles.modalHeader}>
                <Text style={[typography.title, { color: '#E0F7FF' }]}>{t.survival.selectSet}</Text>
                <Pressable onPress={() => setShowSetPicker(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#E0F7FF" />
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
                        backgroundColor: s.id === currentSet?.id ? 'rgba(79,70,229,0.3)' : 'transparent',
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="book" size={20} color={CYAN} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.title, { fontSize: 15, color: '#E0F7FF' }]}>
                        {s.title}
                      </Text>
                      <Text style={[typography.caption, { color: 'rgba(255,255,255,0.5)' }]}>
                        {s.questions.length} câu hỏi · {s.subject || 'Chưa phân loại'}
                      </Text>
                    </View>
                    {s.id === currentSet?.id && (
                      <Ionicons name="checkmark-circle" size={22} color={CYAN} />
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
            <View style={[styles.victoryModal, { backgroundColor: DARK, borderColor: isVictory ? GOLD : '#EF4444', borderWidth: 2 }]}>
              <View style={{ alignItems: 'center', marginBottom: spacing.xs }}>
                <CharacterHero
                  action={isVictory ? 'victory' : 'hurt'}
                  size="md"
                />
              </View>

              {isVictory && (
                <Text style={{ fontSize: 32, textAlign: 'center' }}>🏆</Text>
              )}

              <Text
                style={[
                  typography.display,
                  {
                    color: isVictory ? GOLD : '#EF4444',
                    textAlign: 'center',
                    fontSize: 24,
                    textShadowColor: isVictory ? GOLD : '#EF4444',
                    textShadowRadius: 10,
                  },
                ]}
              >
                {isVictory ? t.survival.survivalChampion : t.survival.knockoutTitle}
              </Text>
              <Text style={[typography.body, { color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 6 }]}>
                {isVictory ? t.survival.championSub : t.survival.knockoutSub}
              </Text>

              {/* Scoreboard Card */}
              <View style={[styles.victoryCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={styles.statRowItem}>
                  <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)' }]}>{t.survival.survivedRounds}</Text>
                  <Text style={[typography.title, { color: '#E0E7FF' }]}>
                    {roundsSurvived} / {questions.length}
                  </Text>
                </View>
                <View style={styles.statRowItem}>
                  <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)' }]}>Số câu chính xác</Text>
                  <Text style={[typography.title, { color: '#4ADE80' }]}>
                    {correctAnswersCount}
                  </Text>
                </View>
                <View style={styles.statRowItem}>
                  <Text style={[typography.body, { color: 'rgba(255,255,255,0.6)' }]}>{t.survival.livesLabel} còn lại</Text>
                  <View>{renderHearts(userPlayer?.lives ?? 0)}</View>
                </View>
                <View style={[styles.statRowItem, { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingTop: 10 }]}>
                  <Text style={[typography.title, { color: INDIGO }]}>
                    {isVip ? 'Điểm sinh tồn (XP 👑 ×2 VIP)' : 'Điểm sinh tồn (XP)'}
                  </Text>
                  <Text style={[typography.display, { color: GOLD, fontSize: 24 }]}>
                    +{(roundsSurvived * 40 + (isVictory ? 200 : 0)) * (isVip ? 2 : 1)} XP
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
    </GameEnvironment>
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
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
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
    borderWidth: 1.5,
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
    gap: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  battleStage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.sm,
    minHeight: 90,
  },
  glassCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: radii.lg,
    borderWidth: 1.5,
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
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
