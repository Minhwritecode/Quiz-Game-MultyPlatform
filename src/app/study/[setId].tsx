import { randomUUID } from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ProgressBar, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import type { AttemptAnswer, StudyProgress } from '@/core/domain/models';
import { completeAttempt } from '@/features/study/domain/completeAttempt';
import { dependencies } from '@/composition/dependencies';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';
import { GameEnvironment } from '@/shared/GameEnvironment';
import { MagicParticles } from '@/shared/MagicParticles';
import { RpgCombatArena3D } from '@/shared/visuals/RpgCombatArena3D';
import { PapyrusPageSkeleton } from '@/shared/PapyrusLoader';
import { sfx } from '@/core/audio/sfx';
import { InteractiveQuestionView } from '@/features/study/components/InteractiveQuestionView';
import {
  buildStudyQueue,
  sanitizeStudyProgress,
  type StudyMode,
} from '@/features/study/domain/setAnalytics';

const TIMED_SECONDS = 20;

export default function StudyScreen() {
  const { setId, mode: initialModeParam } = useLocalSearchParams<{ setId: string; mode?: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { t } = useI18n();
  const questionSet = usePapyrusStore((state) => state.questionSets.find((item) => item.id === setId));
  const initialMode: StudyMode =
    initialModeParam === 'shuffled' ||
    initialModeParam === 'timed' ||
    initialModeParam === 'wrong_only'
      ? initialModeParam
      : 'sequential';
  const [studyMode, setStudyMode] = useState<StudyMode>(initialMode);
  const [activeQuestions, setActiveQuestions] = useState(questionSet?.questions ?? []);
  const [missedCount, setMissedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMED_SECONDS);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<AttemptAnswer[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [attemptId,setAttemptId]=useState(randomUUID);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [exp, setExp] = useState(0);
  const [level, setLevel] = useState(1);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [levelUpMessage, setLevelUpMessage] = useState(false);
  const effectiveQuestions = activeQuestions.length > 0 ? activeQuestions : questionSet?.questions ?? [];
  const question = useMemo(() => effectiveQuestions[index], [index, effectiveQuestions]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      dependencies.study.getProgress(setId),
      dependencies.study.listAttempts().catch(() => []),
    ])
      .then(async ([rawProgress, pastAttempts]) => {
        if (!active) return;
        if (questionSet) {
          const built = buildStudyQueue(questionSet, studyMode, pastAttempts);
          setActiveQuestions(built.questions);
          setMissedCount(built.missedCount);
        }
        if (rawProgress && questionSet && studyMode === 'sequential') {
          const safe = sanitizeStudyProgress(rawProgress, questionSet);
          setIndex(safe.currentIndex);
          setSelected(safe.selectedIndex);
          setRevealed(safe.revealed);
          setAnswers(safe.answers);
          setSessionStartedAt(safe.startedAt);
          const restoredId = rawProgress.attemptId ?? attemptId;
          if (!rawProgress.attemptId) {
            await dependencies.study.saveProgress({ ...safe, attemptId: restoredId }).catch(() => undefined);
          }
          if (!active) return;
          setAttemptId(restoredId);
        } else {
          const now = new Date().toISOString();
          setIndex(0);
          setSelected(null);
          setRevealed(false);
          setAnswers([]);
          setSessionStartedAt(now);
          setTimeLeft(TIMED_SECONDS);
          if (studyMode === 'sequential') {
            const initial: StudyProgress = { attemptId, questionSetId: setId, currentIndex: 0, selectedIndex: null, revealed: false, answers: [], startedAt: now, updatedAt: now };
            await dependencies.study.saveProgress(initial).catch(() => undefined);
          }
        }
        if (active) setProgressLoaded(true);
      })
      .catch(() => {
        if (active) { setSaveError(t.study.progressUnavailable); setProgressLoaded(true); }
      });
    return () => { active = false; };
  }, [setId, questionSet, studyMode, t.study.progressUnavailable]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer for Timed study mode (auto-reveals on timeout)
  useEffect(() => {
    if (studyMode !== 'timed' || !progressLoaded || revealed || !question) return;
    if (timeLeft <= 0) {
      const tid = setTimeout(() => {
        const timeoutAns: AttemptAnswer = {
          questionId: question.id,
          chosenIndex: null,
          isCorrect: false,
          timeMs: TIMED_SECONDS * 1000,
        };
        setAnswers((prev) => [...prev.filter((a) => a.questionId !== question.id), timeoutAns]);
        setRevealed(true);
        sfx.playWrong();
      }, 0);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [studyMode, progressLoaded, revealed, timeLeft, question]);

  const persistProgress = (progress: Omit<StudyProgress, 'updatedAt'>) => {
    void dependencies.study.saveProgress({ ...progress, attemptId, updatedAt: new Date().toISOString() })
      .then(() => setSaveError(''))
      .catch(() => setSaveError(t.study.progressSaveError));
  };

  if (!progressLoaded) {
    return (
      <Screen>
        <TopBar title={t.study.studyMode} />
        <PapyrusPageSkeleton variant="study" label={t.study.restoringProgress} />
      </Screen>
    );
  }

  if (!questionSet || !question) {
    return (
      <Screen>
        <TopBar title={t.study.studyMode} />
        <Card style={styles.empty}>
          <Ionicons name="book-outline" size={40} color={palette.indigo} />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.study.emptySetTitle}
          </Text>
          <Button onPress={() => router.back()} variant="secondary">
            {t.study.backToLibrary}
          </Button>
        </Card>
      </Screen>
    );
  }

  const recordCurrentAnswer = (): AttemptAnswer | null => {
    if (selected === null) return null;
    const answer: AttemptAnswer = {
      questionId: question.id,
      chosenIndex: selected,
      isCorrect: selected === question.correctIndex,
      timeMs: Math.max(0, Date.now() - questionStartedAt),
    };
    return answer;
  };

  const finish = async (lastAnswer: AttemptAnswer | null) => {
    if (!lastAnswer || saving) return;
    setSaving(true);
    const finalAnswers = [...answers.filter((item) => item.questionId !== lastAnswer.questionId), lastAnswer];
    const attempt = completeAttempt({
      id: attemptId,
      questionSetId: questionSet.id,
      startedAt: sessionStartedAt,
      answers: finalAnswers,
    });
    try {
      setSaveError('');
      await dependencies.study.saveAttempt(attempt);
      await dependencies.study.clearProgress(questionSet.id).catch(() => setSaveError(t.study.progressCleanupError));
      router.replace({ pathname: '/study/result', params: { setId: questionSet.id, attemptId: attempt.id } });
    } catch {
      setSaveError('Không lưu được kết quả. Câu trả lời vẫn được giữ trên màn hình; hãy thử lại.');
    } finally {setSaving(false);}
  };

  const next = async () => {
    if (!revealed) {
      const answer = recordCurrentAnswer();
      if (!answer) return;
      const updatedAnswers = [...answers.filter((item) => item.questionId !== question.id), answer];
      setAnswers(updatedAnswers);
      setRevealed(true);
      if (answer.isCorrect) {
        sfx.playSpellCast();
        sfx.playCorrect();
        setParticleTrigger((c) => c + 1);
        setExp((prev) => {
          const nextExp = prev + 25;
          if (nextExp >= 100) {
            sfx.playLevelUp();
            setLevel((l) => l + 1);
            setLevelUpMessage(true);
            setTimeout(() => setLevelUpMessage(false), 3000);
            return nextExp - 100;
          }
          return nextExp;
        });
      } else {
        sfx.playWrong();
      }
      persistProgress({ questionSetId: questionSet.id, currentIndex: index, selectedIndex: selected, revealed: true, answers: updatedAnswers, startedAt: sessionStartedAt });
      return;
    }
    const lastAnswer = answers.find((item) => item.questionId === question.id);
    if (index >= effectiveQuestions.length - 1) {
      if (!lastAnswer) return;
      await finish(lastAnswer);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
    setTimeLeft(TIMED_SECONDS);
    setQuestionStartedAt(Date.now());
    if (studyMode === 'sequential') {
      persistProgress({ questionSetId: questionSet.id, currentIndex: index + 1, selectedIndex: null, revealed: false, answers, startedAt: sessionStartedAt });
    }
  };

  const progress = (index + 1) / Math.max(1, effectiveQuestions.length);
  const wrongAnswersCount = answers.filter((item) => !item.isCorrect).length;
  const correctAnswersCount = answers.filter((item) => item.isCorrect).length;
  const hpLossPerWrong = Math.max(
    15,
    Math.min(25, Math.round(100 / Math.max(4, Math.min(6, effectiveQuestions.length))))
  );
  const playerHp = Math.max(0, 100 - wrongAnswersCount * hpLossPerWrong);
  const bossMaxHp = Math.max(1, effectiveQuestions.length) * 20;
  const bossHp = Math.max(0, bossMaxHp - correctAnswersCount * 20);
  const currentAnsweredWrong = Boolean(
    revealed && answers.find((item) => item.questionId === question.id)?.isCorrect === false
  );
  const currentAnsweredCorrect = Boolean(
    revealed && answers.find((item) => item.questionId === question.id)?.isCorrect === true
  );
  const studyActionEffect = revealed
    ? currentAnsweredCorrect
      ? 'victory'
      : 'hurt'
    : 'idle';

  const studyCombatState = revealed
    ? currentAnsweredCorrect
      ? 'player_attack'
      : currentAnsweredWrong
      ? 'enemy_attack'
      : 'idle'
    : 'idle';

  return (
    <GameEnvironment gameMode="study" enable3DToggle={false} actionEffect={studyActionEffect} pulseTrigger={particleTrigger}>
      <Screen transparent>
      <TopBar
        title={questionSet.title}
        lightContent
        action={
          index > 0 || answers.length > 0 ? (
            <Badge tone="reward">{t.study.resumedBadge}</Badge>
          ) : undefined
        }
      />
      {saveError ? <Text accessibilityRole="alert" style={{color:palette.danger}}>{saveError}</Text> : null}

      {/* Study Mode Selector (Sequential / Shuffled / Timed 20s / Wrong-Only Review) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
        {([
          { id: 'sequential', label: '📖 Tuần tự' },
          { id: 'shuffled', label: '🎲 Ngẫu nhiên' },
          { id: 'timed', label: `⏱️ ${timeLeft}s` },
          { id: 'wrong_only', label: `🎯 Ôn câu sai${missedCount > 0 ? ` (${missedCount})` : ''}` },
        ] as const).map((m) => {
          const active = studyMode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setStudyMode(m.id)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? palette.indigo : palette.paperMuted,
                backgroundColor: active ? palette.indigo : palette.paperRaised,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : palette.ink }}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Magic Particles */}
      <MagicParticles trigger={particleTrigger} type="sparkles" />

      {/* Immersive 3D RPG Sanctuary Trial Stage + Dynamic Player/Boss HP & EXP */}
      <RpgCombatArena3D
        combatState={studyCombatState}
        combo={level}
        triggerKey={index * 10 + (revealed ? 1 : 0) + particleTrigger + wrongAnswersCount}
        playerHp={playerHp}
        playerMaxHp={100}
        bossHp={bossHp}
        bossMaxHp={bossMaxHp}
        damageAmount={studyCombatState === 'enemy_attack' ? hpLossPerWrong : 20}
        playerLabel={`Đại Pháp Sư · Lv.${level} (${playerHp}/100 HP)`}
        bossLabel="Hộ Pháp Cổ Ngữ"
        arenaTheme="sanctuary"
        height={210}
      />

      {levelUpMessage && (
        <Card style={{ marginBottom: spacing.sm, padding: spacing.sm }}>
          <View style={styles.levelUpBanner}>
            <Text style={styles.levelUpText}>✨ LEVEL UP! Wisdom +1 (Lv. {level}) ✨</Text>
          </View>
        </Card>
      )}

      {/* Progress Section */}
      <View style={styles.progressContainer}>
        <View style={styles.progressMeta}>
          <Text style={[typography.label, { color: palette.inkMuted }]}>
            {t.study.questionLabel} {index + 1} / {effectiveQuestions.length}
          </Text>
          <Text style={[typography.label, { color: palette.indigo }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <ProgressBar progress={progress} tone="primary" />
      </View>

      {/* Question Card */}
      <Card style={styles.questionCard}>
        {question.questionType === 'true_false' ? (
          <View style={{ marginBottom: spacing.xs, alignSelf: 'flex-start' }}>
            <Badge tone="primary">ĐÚNG / SAI</Badge>
          </View>
        ) : null}
        <Text style={[typography.heading, { color: palette.ink, lineHeight: 32 }]}>
          {question.content}
        </Text>
        {question.codeSnippet ? (
          <View style={{ backgroundColor: '#0F172A', borderRadius: 10, padding: spacing.md, marginTop: spacing.md }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#E2E8F0' }}>
              {question.codeSnippet}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Options List OR Pluggable Interactive Renderer (multiSelect, poll, word_cloud, rating, open_text) */}
      {question.multiSelect ||
      question.questionType === 'poll' ||
      question.questionType === 'word_cloud' ||
      question.questionType === 'rating' ||
      question.questionType === 'open_text' ? (
        <InteractiveQuestionView
          key={question.id}
          question={question}
          revealed={revealed}
          onComplete={(isCorrect, chosenIdx) => {
            const answer: AttemptAnswer = {
              questionId: question.id,
              chosenIndex: chosenIdx,
              isCorrect,
              timeMs: Math.max(0, Date.now() - questionStartedAt),
            };
            const updatedAnswers = [...answers.filter((item) => item.questionId !== question.id), answer];
            setSelected(chosenIdx ?? 0);
            setAnswers(updatedAnswers);
            setRevealed(true);
            if (isCorrect) {
              sfx.playCorrect();
              setParticleTrigger((c) => c + 1);
            } else {
              sfx.playWrong();
            }
            persistProgress({
              questionSetId: questionSet.id,
              currentIndex: index,
              selectedIndex: chosenIdx,
              revealed: true,
              answers: updatedAnswers,
              startedAt: sessionStartedAt,
            });
          }}
        />
      ) : (
      <View style={styles.optionsList}>
        {question.options.map((option, optionIndex) => {
          const chosen = selected === optionIndex;
          const correct = revealed && optionIndex === question.correctIndex;
          const wrong = revealed && chosen && !correct;

          let bg = palette.paperRaised;
          let borderColor = palette.paperMuted;
          let letterBg = palette.paperMuted;
          let letterFg = palette.inkMuted;

          if (correct) {
            bg = palette.mintTint;
            borderColor = palette.mint;
            letterBg = palette.mint;
            letterFg = palette.white;
          } else if (wrong) {
            bg = palette.dangerTint;
            borderColor = palette.danger;
            letterBg = palette.danger;
            letterFg = palette.white;
          } else if (chosen) {
            bg = palette.indigoTint;
            borderColor = palette.indigo;
            letterBg = palette.indigo;
            letterFg = palette.white;
          }

          return (
            <Pressable
              key={option}
              disabled={revealed}
              onPress={() => {
                setSelected(optionIndex);
                persistProgress({ questionSetId: questionSet.id, currentIndex: index, selectedIndex: optionIndex, revealed, answers, startedAt: sessionStartedAt });
              }}
              testID={`study-option-${optionIndex}`}
              style={[
                styles.option,
                {
                  backgroundColor: bg,
                  borderColor: borderColor,
                  borderBottomWidth: 3,
                },
              ]}
            >
              <View style={[styles.letter, { backgroundColor: letterBg }]}>
                <Text style={{ color: letterFg, fontWeight: '800', fontSize: 14 }}>
                  {String.fromCharCode(65 + optionIndex)}
                </Text>
              </View>
              <Text style={[typography.body, { color: palette.ink, flex: 1, fontWeight: chosen ? '700' : '500' }]}>
                {option}
              </Text>
              {revealed && (correct || wrong) && (
                <Ionicons
                  name={correct ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={correct ? palette.mint : palette.danger}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      )}

      {/* Explanation Box */}
      {revealed && (
        <Card
          color={selected === question.correctIndex ? palette.mintTint : palette.dangerTint}
          style={styles.explanation}
        >
          <Ionicons
            name={selected === question.correctIndex ? 'checkmark-circle' : 'information-circle'}
            size={24}
            color={selected === question.correctIndex ? palette.mint : palette.danger}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={[
                typography.title,
                { color: selected === question.correctIndex ? palette.mint : palette.danger, fontSize: 16 },
              ]}
            >
              {selected === question.correctIndex ? t.study.correctToast : t.study.incorrectToast}
            </Text>
            <Text
              style={[
                typography.body,
                { color: selected === question.correctIndex ? palette.mint : palette.danger },
              ]}
            >
              {question.explanation || t.study.noExplanation}
            </Text>
          </View>
        </Card>
      )}

      {/* Action Button */}
      <View style={{ marginTop: spacing.md, marginBottom: spacing.xxl }}>
        <Button
          testID="study-next"
          disabled={selected === null || saving}
          onPress={() => void next()}
          variant={revealed ? (selected === question.correctIndex ? 'success' : 'primary') : 'primary'}
          icon={
            revealed
              ? index === questionSet.questions.length - 1
                ? 'trophy'
                : 'arrow-forward'
              : 'checkmark'
          }
        >
          {saving
            ? t.study.savingAttempt
            : !revealed
            ? t.study.checkAnswer
            : index === questionSet.questions.length - 1
            ? t.study.finishStudy
            : t.study.nextQuestion}
        </Button>
      </View>
      </Screen>
    </GameEnvironment>
  );
}

const styles = StyleSheet.create({
  scholarHeaderCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  scholarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
    marginTop: 2,
  },
  expBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  levelUpBanner: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  levelUpText: {
    color: '#D97706',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  progressContainer: { marginTop: spacing.sm, marginBottom: spacing.md, gap: spacing.xs },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionCard: { padding: spacing.xl, minHeight: 120, justifyContent: 'center', marginBottom: spacing.md },
  optionsList: { gap: spacing.sm },
  option: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanation: {
    marginTop: spacing.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderRadius: radii.md,
  },
});
