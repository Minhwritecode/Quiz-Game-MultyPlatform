import { AppIcon } from '@/shared/AppIcon';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Screen, TopBar } from '@/shared/ui';
import { Model3DView, type Model3DActionEffect } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { SoundToggle } from '@/shared/SoundToggle';
import { sfx } from '@/core/audio/sfx';
import { radii, spacing, typography } from '@/core/theme/tokens';

interface AlchemyOrb {
  id: string;
  statement: string;
  answerHint: string;
  bucketIdx: 0 | 1 | 2;
}

const CAULDRON_STYLES = [
  { idx: 0 as const, color: '#10B981', bg: 'rgba(16, 185, 129, 0.20)', emoji: '🧪🟢', ring: 'Lò Ngọc Lục Bảo' },
  { idx: 1 as const, color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.20)', emoji: '⚗️🔵', ring: 'Lò Lam Tinh' },
  { idx: 2 as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.20)', emoji: '🏺🟡', ring: 'Lò Hoàng Kim' },
];

/**
 * Non-Quiz 3D Action Learning Game #2:
 * Giả Kim Thuật Phân Loại 3D (3D Spatial Alchemy Cauldron Sorter)
 * Players sort knowledge orbs into 3 bubbling 3D Elemental Cauldrons by domain/concept!
 */
export default function AlchemySorterGameScreen() {
  const router = useRouter();
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const recordGameResult = usePapyrusStore((s) => s.recordGameResult);

  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const [packOffset, setPackOffset] = useState(0);

  // Pick 3 distinct Subject Sets for the 3 Bubbling 3D Cauldrons
  const triad = useMemo(() => {
    const picked = [
      allSets[packOffset % allSets.length],
      allSets[(packOffset + 5) % allSets.length],
      allSets[(packOffset + 11) % allSets.length],
    ].filter(Boolean);
    return picked;
  }, [allSets, packOffset]);

  const deck = useMemo<AlchemyOrb[]>(() => {
    const items: AlchemyOrb[] = [];
    triad.forEach((set, idx) => {
      if (!set) return;
      const bucketIdx = (idx % 3) as 0 | 1 | 2;
      set.questions.slice(0, 4).forEach((q, qIdx) => {
        const ans = q.options[q.correctIndex] ?? '';
        items.push({
          id: `${set.id}-${qIdx}`,
          statement: `${q.content}`,
          answerHint: ans ? `Tinh chất: ${ans}` : set.title,
          bucketIdx,
        });
      });
    });
    // Deterministic interleave shuffle
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }, [triad]);

  const [orbIndex, setOrbIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [effect, setEffect] = useState<Model3DActionEffect>('idle');
  const [pulse, setPulse] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [finished, setFinished] = useState(false);

  const currentOrb = deck[orbIndex];

  const throwIntoCauldron = (chosenIdx: 0 | 1 | 2) => {
    if (!currentOrb || finished) return;
    const isRight = chosenIdx === currentOrb.bucketIdx;
    const correctSet = triad[currentOrb.bucketIdx];

    if (isRight) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      const pts = 120 + nextCombo * 30;
      setScore((s) => s + pts);
      setEffect('attack');
      setPulse((p) => p + 1);
      sfx.playCorrect();
      setFeedback({
        ok: true,
        text: `✨ Luyện kim thành công (+${pts} XP)! Thuộc chủ đề "${correctSet?.subject || correctSet?.title}".`,
      });
    } else {
      setCombo(0);
      setEffect('hurt');
      setPulse((p) => p + 1);
      sfx.playWrong();
      setFeedback({
        ok: false,
        text: `💥 Nổ lò giả kim! Viên tinh thể này thuộc lò "${correctSet?.subject || correctSet?.title}".`,
      });
      const nextLives = lives - 1;
      setLives(nextLives);
      if (nextLives <= 0) {
        setFinished(true);
        recordGameResult(score, false);
        return;
      }
    }

    setTimeout(() => {
      setFeedback(null);
      setEffect('idle');
      if (orbIndex + 1 >= deck.length) {
        setFinished(true);
        sfx.playLevelUp();
        recordGameResult(score + 200, true);
        useStreakStore.getState().recordActivity('study_quiz');
      } else {
        setOrbIndex((i) => i + 1);
      }
    }, 850);
  };

  const resetRound = (nextTriad = false) => {
    if (nextTriad) setPackOffset((o) => o + 3);
    setOrbIndex(0);
    setScore(0);
    setCombo(0);
    setLives(3);
    setFeedback(null);
    setFinished(false);
  };

  return (
    <View style={styles.root}>
      <Screen>
        <TopBar
          title="🧪 Giả Kim Phân Loại 3D"
          lightContent
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SoundToggle />
              <Pressable onPress={() => resetRound(true)} style={styles.swapBtn}>
                <AppIcon name="shuffle" size={15} color="#6EE7B7" />
                <Text style={styles.swapText}>Đổi 3 Lò</Text>
              </Pressable>
            </View>
          }
        />

        {/* Top Stats */}
        <View style={styles.statsRow}>
          <Badge tone="reward">⚗️ {score} XP</Badge>
          <Badge tone="primary">
            Tinh thể {Math.min(orbIndex + 1, deck.length)}/{deck.length}
          </Badge>
          {combo >= 2 ? <Badge tone="fire">🔥 x{combo}</Badge> : null}
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <Text key={i} style={{ fontSize: 16, opacity: i < lives ? 1 : 0.25 }}>
                ❤️‍🔥
              </Text>
            ))}
          </View>
        </View>

        {/* Blender 3D Trio of Bubbling Elemental Cauldrons */}
        <View style={styles.stage3dWrap}>
          <Model3DErrorBoundary>
            <Model3DView
              model="alchemyCauldrons"
              height={186}
              autoRotate={false}
              interactive
              actionEffect={effect}
              pulseTrigger={pulse}
              style={{ borderWidth: 0, backgroundColor: 'transparent' }}
            />
          </Model3DErrorBoundary>
          <Text style={styles.stageCaption}>
            Kéo xoay 3 lò giả kim 3D · Ném viên tinh thể vào đúng lò chuyên ngành tương ứng!
          </Text>
        </View>

        {/* Active Floating Knowledge Crystal Orb */}
        {currentOrb ? (
          <Card color="#17153B" style={styles.orbCard}>
            <View style={styles.orbBadgeRow}>
              <Text style={styles.orbBadge}>🔮 VIÊN TINH THỂ TRI THỨC ĐANG LƠ LỬNG</Text>
            </View>
            <Text style={styles.orbStatement}>{currentOrb.statement}</Text>
            <Text style={styles.orbHint}>{currentOrb.answerHint}</Text>
          </Card>
        ) : null}

        {feedback ? (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: feedback.ok ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.22)',
                borderColor: feedback.ok ? '#10B981' : '#EF4444',
              },
            ]}
          >
            <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700' }}>{feedback.text}</Text>
          </View>
        ) : null}

        {/* 3 Interactive Elemental Cauldrons */}
        <Text style={styles.pickTitle}>CHẠM ĐỂ NÉM VÀO LÒ GIẢ KIM PHÙ HỢP:</Text>
        <View style={styles.cauldronsGrid}>
          {CAULDRON_STYLES.map((c) => {
            const targetSet = triad[c.idx];
            return (
              <Pressable
                key={c.idx}
                accessibilityRole="button"
                disabled={Boolean(feedback) || finished}
                onPress={() => throwIntoCauldron(c.idx)}
                style={({ pressed }) => [
                  styles.cauldronBtn,
                  {
                    backgroundColor: c.bg,
                    borderColor: c.color,
                    transform: pressed ? [{ scale: 0.96 }] : undefined,
                  },
                ]}
              >
                <Text style={{ fontSize: 26 }}>{c.emoji}</Text>
                <Text style={[styles.cauldronName, { color: c.color }]}>{c.ring}</Text>
                <Text style={styles.cauldronSubject} numberOfLines={2}>
                  {targetSet?.subject || targetSet?.title || 'Tri thức'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Modal visible={finished} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <Card color="#0F172A" style={styles.modalCard}>
              <Text style={{ fontSize: 42 }}>{lives > 0 ? '🧪✨' : '💥🏺'}</Text>
              <Text style={[typography.heading, { color: lives > 0 ? '#34D399' : '#F87171', textAlign: 'center' }]}>
                {lives > 0 ? 'Bậc Thầy Đại Giả Kim!' : 'Lò Luyện Kim Quá Tải!'}
              </Text>
              <Text style={{ color: '#CBD5E1', textAlign: 'center' }}>
                Điểm tinh luyện đạt được: <Text style={{ color: '#FDE68A', fontWeight: '900' }}>{score} XP</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button variant="reward" icon="refresh" onPress={() => resetRound(true)}>
                  Luyện mẻ mới
                </Button>
                <Button variant="secondary" icon="home-outline" onPress={() => router.replace('/')}>
                  Trang chủ
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#090D26' },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  swapText: { color: '#6EE7B7', fontSize: 11.5, fontWeight: '800' },
  statsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  stage3dWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 66, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    marginBottom: spacing.sm,
    paddingBottom: 6,
  },
  stageCaption: { color: '#A7F3D0', fontSize: 11, textAlign: 'center', fontWeight: '700' },
  orbCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.55)',
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  orbBadgeRow: { marginBottom: 6 },
  orbBadge: { color: '#C4B5FD', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
  orbStatement: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', lineHeight: 24 },
  orbHint: { color: '#FDE68A', fontSize: 12.5, fontWeight: '700', marginTop: 8 },
  feedbackBanner: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  pickTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '900', letterSpacing: 0.6, marginBottom: 8 },
  cauldronsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  cauldronBtn: {
    flex: 1,
    minWidth: 100,
    borderRadius: radii.md,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    gap: 5,
  },
  cauldronName: { fontSize: 11, fontWeight: '900' },
  cauldronSubject: { color: '#F8FAFC', fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', gap: 10 },
});
