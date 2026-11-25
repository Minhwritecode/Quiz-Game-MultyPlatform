import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Badge, Button, Card, Screen, TopBar } from '@/shared/ui';
import { Model3DView } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { RpgCombatArena3D, type RpgCombatState } from '@/shared/visuals/RpgCombatArena3D';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { SoundToggle } from '@/shared/SoundToggle';
import { sfx } from '@/core/audio/sfx';
import { radii, spacing, typography } from '@/core/theme/tokens';

interface FallingMeteor {
  id: string;
  lane: number;
  label: string;
  isTarget: boolean;
  color: string;
  border: string;
  emoji: string;
  shattered?: boolean;
}

const METEOR_PALETTES = [
  { color: 'rgba(249, 115, 22, 0.28)', border: '#FB923C', emoji: '☄️' },
  { color: 'rgba(6, 182, 212, 0.28)', border: '#22D3EE', emoji: '💎' },
  { color: 'rgba(168, 85, 247, 0.28)', border: '#C084FC', emoji: '🔮' },
  { color: 'rgba(16, 185, 129, 0.28)', border: '#34D399', emoji: '🟢' },
];

/**
 * Non-Quiz 3D Action Learning Game #1:
 * Cung Thủ Diệt Thiên Thạch 3D (Rune Meteor Defense 3D)
 * Active Recall via Direct 3D Meteor Sniping & Spell-Forge Typing (Zero A/B/C/D Buttons!)
 */
export default function RuneArcherGameScreen() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const recordGameResult = usePapyrusStore((s) => s.recordGameResult);

  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const [activeSetId, setActiveSetId] = useState<string>(setId || allSets[0]?.id || '');
  const [showPicker, setShowPicker] = useState(false);

  const currentSet = useMemo(
    () => allSets.find((s) => s.id === activeSetId && s.questions.length >= 2) ?? allSets[0],
    [activeSetId, allSets]
  );

  const [wave, setWave] = useState(0);
  const [shieldHp, setShieldHp] = useState(4);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [freezeCharges, setFreezeCharges] = useState(2);
  const [stormCharges, setStormCharges] = useState(2);
  const [frozenUntil, setFrozenUntil] = useState(0);
  const [spellInput, setSpellInput] = useState('');
  const [combatState, setCombatState] = useState<RpgCombatState>('idle');
  const [triggerKey, setTriggerKey] = useState(0);
  const [meteors, setMeteors] = useState<FallingMeteor[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);

  const fallAnim = useRef(new Animated.Value(0)).current;
  const waveResolvedRef = useRef(false);

  const deck = useMemo(() => currentSet?.questions ?? [], [currentSet]);
  const currentClue = deck[wave % Math.max(1, deck.length)];

  const spawnWave = useCallback(
    (waveIdx: number) => {
      if (deck.length === 0) return;
      waveResolvedRef.current = false;
      setSpellInput('');
      const q = deck[waveIdx % deck.length]!;
      const targetText = (q.options[q.correctIndex] ?? q.options[0] ?? 'Tri thức').trim();
      const decoys = q.options
        .filter((_, idx) => idx !== q.correctIndex)
        .filter((o) => o.trim().length > 0);

      // Pull extra decoys from other questions if true/false only had 1 decoy
      for (const other of deck) {
        if (decoys.length >= 3) break;
        const cand = other.options[other.correctIndex]?.trim();
        if (cand && cand !== targetText && !decoys.includes(cand)) {
          decoys.push(cand);
        }
      }

      const pool = [
        { label: targetText, isTarget: true },
        ...decoys.slice(0, 3).map((d) => ({ label: d, isTarget: false })),
      ];
      // Deterministic shuffle per wave
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i]!;
        pool[i] = pool[j]!;
        pool[j] = tmp;
      }

      const spawned: FallingMeteor[] = pool.map((item, idx) => {
        const pal = METEOR_PALETTES[idx % METEOR_PALETTES.length]!;
        return {
          id: `m-${waveIdx}-${idx}`,
          lane: idx,
          label: item.label,
          isTarget: item.isTarget,
          color: pal.color,
          border: pal.border,
          emoji: pal.emoji,
        };
      });

      setMeteors(spawned);
      fallAnim.setValue(0);
      const durationMs = Math.max(6800, 11500 - waveIdx * 380);
      Animated.timing(fallAnim, {
        toValue: 1,
        duration: durationMs,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !waveResolvedRef.current) {
          // Meteor crashed into the castle wall!
          waveResolvedRef.current = true;
          sfx.playWrong();
          setCombo(0);
          setCombatState('enemy_attack');
          setTriggerKey((k) => k + 1);
          setShieldHp((hp) => {
            const nextHp = hp - 1;
            if (nextHp <= 0) {
              setGameOver(true);
              setVictory(false);
            } else {
              setTimeout(() => setWave((w) => w + 1), 650);
            }
            return Math.max(0, nextHp);
          });
        }
      });
    },
    [deck, fallAnim]
  );

  useEffect(() => {
    if (gameOver || deck.length === 0) return;
    if (wave >= Math.min(12, deck.length)) {
      setGameOver(true);
      setVictory(true);
      sfx.playLevelUp();
      recordGameResult(score, true);
      useStreakStore.getState().recordActivity('study_quiz');
      return;
    }
    spawnWave(wave);
    return () => {
      fallAnim.stopAnimation();
    };
  }, [wave, gameOver, deck.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fireAtMeteor = (meteor: FallingMeteor) => {
    if (waveResolvedRef.current || gameOver || meteor.shattered) return;
    if (meteor.isTarget) {
      waveResolvedRef.current = true;
      fallAnim.stopAnimation();
      sfx.playSpellCast();
      sfx.playCorrect();
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      const gained = 150 + nextCombo * 35;
      setScore((s) => s + gained);
      setCombatState('player_attack');
      setTriggerKey((k) => k + 1);
      setMeteors((prev) => prev.map((m) => (m.id === meteor.id ? { ...m, shattered: true } : m)));
      setTimeout(() => {
        setWave((w) => w + 1);
      }, 520);
    } else {
      // Decoy meteor hit — shakes castle shield!
      sfx.playWrong();
      setCombo(0);
      setCombatState('enemy_attack');
      setTriggerKey((k) => k + 1);
      setMeteors((prev) => prev.map((m) => (m.id === meteor.id ? { ...m, shattered: true } : m)));
      setShieldHp((hp) => {
        const nextHp = hp - 1;
        if (nextHp <= 0) {
          waveResolvedRef.current = true;
          fallAnim.stopAnimation();
          setGameOver(true);
          setVictory(false);
          recordGameResult(score, false);
        }
        return Math.max(0, nextHp);
      });
    }
  };

  // Spell-Forge Typing Active Recall: typing >= 3 matching characters auto-fires homing Fire Arrow!
  const handleSpellType = (txt: string) => {
    setSpellInput(txt);
    const clean = txt.trim().toLowerCase();
    if (clean.length < 2) return;
    const target = meteors.find((m) => m.isTarget && !m.shattered);
    if (
      target &&
      (target.label.toLowerCase().startsWith(clean) ||
        (clean.length >= 4 && target.label.toLowerCase().includes(clean)))
    ) {
      fireAtMeteor(target);
    }
  };

  const activateFreeze = () => {
    if (freezeCharges <= 0 || Date.now() < frozenUntil) return;
    setFreezeCharges((c) => c - 1);
    setFrozenUntil(Date.now() + 4500);
    fallAnim.stopAnimation((cur) => {
      setTimeout(() => {
        if (!waveResolvedRef.current && !gameOver) {
          Animated.timing(fallAnim, {
            toValue: 1,
            duration: Math.max(3000, (1 - cur) * 9000),
            useNativeDriver: true,
          }).start();
        }
      }, 4200);
    });
    sfx.playSpellCast();
  };

  const activateMeteorStorm = () => {
    if (stormCharges <= 0) return;
    setStormCharges((c) => c - 1);
    let cleared = 0;
    setMeteors((prev) =>
      prev.map((m) => {
        if (!m.isTarget && !m.shattered && cleared < 2) {
          cleared++;
          return { ...m, shattered: true };
        }
        return m;
      })
    );
    sfx.playCombo();
  };

  const restartGame = () => {
    setWave(0);
    setShieldHp(4);
    setScore(0);
    setCombo(0);
    setFreezeCharges(2);
    setStormCharges(2);
    setCombatState('idle');
    setGameOver(false);
    setVictory(false);
  };

  const totalWaves = Math.min(12, Math.max(1, deck.length));

  return (
    <View style={styles.root}>
      <Screen>
        <TopBar
          title="🏹 Cung Thủ Thiên Thạch 3D"
          lightContent
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SoundToggle />
              <Pressable onPress={() => setShowPicker(true)} style={styles.setChip}>
                <Ionicons name="book-outline" size={14} color="#FDE68A" />
                <Text style={styles.setChipText} numberOfLines={1}>
                  Đổi bộ đề
                </Text>
              </Pressable>
            </View>
          }
        />

        {/* Top RPG HUD */}
        <View style={styles.hudRow}>
          <Badge tone="reward">⭐ {score} XP</Badge>
          <Badge tone="primary">
            Đợt {Math.min(wave + 1, totalWaves)}/{totalWaves}
          </Badge>
          {combo >= 2 ? <Badge tone="fire">🔥 Combo x{combo}</Badge> : null}
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Text key={i} style={{ fontSize: 16, opacity: i < shieldHp ? 1 : 0.25 }}>
                🛡️
              </Text>
            ))}
          </View>
        </View>

        {/* Live 3D RPG Archer vs Meteor Golem Stage */}
        <RpgCombatArena3D
          combatState={combatState}
          combo={combo}
          triggerKey={triggerKey}
          playerHp={shieldHp}
          playerMaxHp={4}
          bossHp={Math.max(1, totalWaves - wave)}
          bossMaxHp={totalWaves}
          playerLabel="Cung Thủ Cổ Ngữ"
          bossLabel="Chúa Tể Thiên Thạch"
          arenaTheme="colosseum"
          height={188}
        />

        {/* Crossbow Target Clue Banner (Zero A/B/C/D — Pure Active Recall!) */}
        <Card color="#131942" style={styles.clueCard}>
          <View style={styles.clueHeader}>
            <View style={styles.bowMini}>
              <Model3DErrorBoundary>
                <Model3DView
                  model="archerBow"
                  height={56}
                  autoRotate
                  interactive={false}
                  style={{ borderWidth: 0, backgroundColor: 'transparent' }}
                />
              </Model3DErrorBoundary>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.clueEyebrow}>🎯 MỤC TIÊU KHÓA NỎ LỬA (CHẠM BẮN HOẶC GÕ CHỮ ĐẦU)</Text>
              <Text style={styles.cluePrompt}>{currentClue?.content || 'Đang nạp mục tiêu...'}</Text>
            </View>
          </View>
        </Card>

        {/* 3D Sky Meteor Lanes — Tap the Falling Meteor to Fire Blazing Arrow! */}
        <View style={styles.skyBox}>
          <View style={styles.castleWallLine}>
            <Text style={styles.wallWarning}>🔥 TƯỜNG THÀNH HỌC VIỆN — ĐỪNG ĐỂ THIÊN THẠCH RƠI CHẠM ĐÁY!</Text>
          </View>

          <View style={styles.lanesRow}>
            {meteors.map((m) => (
              <View key={m.id} style={styles.laneCol}>
                {!m.shattered ? (
                  <Animated.View
                    style={{
                      width: '100%',
                      transform: [
                        {
                          translateY: fallAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [4, 152],
                          }),
                        },
                      ],
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Bắn thiên thạch ${m.label}`}
                      onPress={() => fireAtMeteor(m)}
                      style={({ pressed }) => [
                        styles.meteorOrb,
                        {
                          backgroundColor: m.color,
                          borderColor: m.border,
                          transform: pressed ? [{ scale: 0.92 }] : undefined,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                      <Text style={styles.meteorText} numberOfLines={3}>
                        {m.label}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ) : (
                  <View style={styles.shatteredBurst}>
                    <Text style={{ fontSize: 26 }}>{m.isTarget ? '💥🔥' : '💨'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Spell-Forge Typing Bar + Tactical Power-Ups */}
        <View style={styles.controlsBar}>
          <TextInput
            value={spellInput}
            onChangeText={handleSpellType}
            placeholder="⌨️ Gõ nhanh chữ đầu của mục tiêu để bắn tên tự tìm đích..."
            placeholderTextColor="#94A3B8"
            style={styles.spellInput}
          />
          <View style={styles.skillsRow}>
            <Pressable
              disabled={freezeCharges <= 0}
              onPress={activateFreeze}
              style={[styles.skillBtn, freezeCharges <= 0 && { opacity: 0.4 }]}
            >
              <Text style={styles.skillBtnText}>❄️ Ngưng Đọng ({freezeCharges})</Text>
            </Pressable>
            <Pressable
              disabled={stormCharges <= 0}
              onPress={activateMeteorStorm}
              style={[styles.skillBtn, { borderColor: '#F59E0B' }, stormCharges <= 0 && { opacity: 0.4 }]}
            >
              <Text style={[styles.skillBtnText, { color: '#FDE68A' }]}>
                💥 Phá Mồi Nhử ({stormCharges})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Question Set Picker Modal */}
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalBackdrop}>
            <Card color="#0F172A" style={styles.modalSheet}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[typography.title, { color: '#F8FAFC' }]}>Chọn bộ tri thức nạp đạn ({allSets.length})</Text>
                <Pressable onPress={() => setShowPicker(false)}>
                  <Ionicons name="close-circle" size={26} color="#94A3B8" />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 360 }}>
                {allSets.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setActiveSetId(s.id);
                      setShowPicker(false);
                      restartGame();
                    }}
                    style={[
                      styles.setRow,
                      s.id === currentSet?.id && { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: '#818CF8' },
                    ]}
                  >
                    <Text style={{ color: '#F8FAFC', fontWeight: '700', flex: 1 }}>{s.title}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12 }}>{s.questions.length} mục tiêu</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          </View>
        </Modal>

        {/* Victory / Defeat Result Modal */}
        <Modal visible={gameOver} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <Card color="#0F172A" style={[styles.modalSheet, { alignItems: 'center', gap: 10 }]}>
              <Text style={{ fontSize: 42 }}>{victory ? '🏆🏹' : '🪨🛡️'}</Text>
              <Text style={[typography.heading, { color: victory ? '#FBBF24' : '#F87171', textAlign: 'center' }]}>
                {victory ? 'Bảo Vệ Thành Công Tòa Tháp!' : 'Tường Thành Đã Thất Thủ!'}
              </Text>
              <Text style={{ color: '#CBD5E1', textAlign: 'center' }}>
                Tổng điểm xạ thủ: <Text style={{ color: '#FDE68A', fontWeight: '900' }}>{score} XP</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button variant="reward" icon="refresh" onPress={restartGame}>
                  Bắn lại
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
  root: { flex: 1, backgroundColor: '#070B24' },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
  },
  setChipText: { color: '#FDE68A', fontSize: 11.5, fontWeight: '800', maxWidth: 110 },
  hudRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  clueCard: { borderColor: 'rgba(34, 211, 238, 0.45)', borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.sm },
  clueHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bowMini: { width: 62, height: 56 },
  clueEyebrow: { color: '#22D3EE', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.5 },
  cluePrompt: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800', marginTop: 3, lineHeight: 22 },
  skyBox: {
    minHeight: 258,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(15, 23, 66, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.32)',
    padding: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  lanesRow: { flexDirection: 'row', gap: 8, flex: 1 },
  laneCol: { flex: 1, alignItems: 'center' },
  meteorOrb: {
    width: '100%',
    minHeight: 86,
    borderRadius: 16,
    borderWidth: 2,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  meteorText: { color: '#F8FAFC', fontSize: 12, fontWeight: '800', textAlign: 'center', lineHeight: 16 },
  shatteredBurst: { height: 86, alignItems: 'center', justifyContent: 'center' },
  castleWallLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderTopWidth: 1.5,
    borderTopColor: '#EF4444',
    alignItems: 'center',
  },
  wallWarning: { color: '#FCA5A5', fontSize: 10, fontWeight: '800' },
  controlsBar: { marginTop: spacing.sm, gap: spacing.xs },
  spellInput: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    paddingHorizontal: spacing.md,
    fontSize: 13.5,
  },
  skillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  skillBtn: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(14, 165, 233, 0.16)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
  },
  skillBtnText: { color: '#BAE6FD', fontSize: 12.5, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSheet: { width: '100%', maxWidth: 480, alignSelf: 'center', borderColor: 'rgba(129, 140, 248, 0.4)' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 8,
    gap: 8,
  },
});
