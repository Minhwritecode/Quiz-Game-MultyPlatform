import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { calculateTieredSpeedScore, type QuestionSet } from '@/core/domain/models';
import {
  DUEL_CATEGORIES,
  eloSearchBand,
  getEloTier,
  pickTieredBot,
  type DuelCategoryId,
} from '../domain/elo';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import {
  cancelLiveDuelQueue,
  enqueueLiveDuelQueue,
  pollLiveDuelQueue,
  syncDuelResultToCloud,
} from '@/composition/platform';
import { sfx } from '@/core/audio/sfx';
import { ReportQuestionButton } from '@/shared/ReportQuestionButton';
import { LiveReactionsBar } from './LiveReactionsBar';
import { Model3DView, type Model3DActionEffect } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';

interface DuelQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  codeSnippet?: string;
}

const CATEGORY_SET_MATCHERS: Record<DuelCategoryId, string[]> = {
  coding: ['it', 'dsa', 'os', 'network', 'dbms', 'cloud', 'devops', 'software', 'mobile', 'ai', 'lập trình', 'mạng', 'hệ điều hành', 'dữ liệu'],
  science: ['sinh', 'vật lý', 'hóa', 'science', 'bio', 'phys', 'chem'],
  history: ['lịch sử', 'history', 'việt nam', 'thế giới'],
  math: ['toán', 'dsa', 'vật lý', 'giải thuật', 'math'],
  english: ['english', 'văn học', 'thế giới', 'lit'],
  general: [],
};

const FALLBACK_DUEL_QUESTIONS: Record<DuelCategoryId, DuelQuestion[]> = {
  general: [
    { prompt: 'Châu lục nào có diện tích lớn nhất Trái Đất?', options: ['Châu Phi', 'Châu Á', 'Châu Mỹ', 'Châu Âu'], correctIndex: 1 },
    { prompt: 'Nguyên tố hóa học nào có ký hiệu là Au?', options: ['Bạc', 'Đồng', 'Vàng', 'Nhôm'], correctIndex: 2 },
    { prompt: 'Đơn vị đo tần số trong hệ SI là gì?', options: ['Newton', 'Hertz', 'Joule', 'Watt'], correctIndex: 1 },
  ],
  coding: [
    {
      prompt: 'Độ phức tạp thời gian trung bình của Binary Search là gì?',
      codeSnippet: 'while (lo <= hi) { const mid = (lo + hi) >> 1; ... }',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correctIndex: 1,
    },
    {
      prompt: 'Trong HTTP, mã trạng thái 429 mang ý nghĩa gì?',
      options: ['Unauthorized', 'Not Found', 'Too Many Requests', 'Bad Gateway'],
      correctIndex: 2,
    },
    {
      prompt: 'Hook nào trong React giúp ghi nhớ giá trị tính toán đắt tiền?',
      options: ['useRef', 'useMemo', 'useId', 'useReducer'],
      correctIndex: 1,
    },
  ],
  math: [
    { prompt: 'Tổng các góc trong của một ngũ giác lồi bằng bao nhiêu độ?', options: ['360°', '450°', '540°', '720°'], correctIndex: 2 },
    { prompt: 'Giá trị của log₂(64) bằng bao nhiêu?', options: ['5', '6', '7', '8'], correctIndex: 1 },
    { prompt: 'Số nguyên tố chẵn duy nhất là số nào?', options: ['0', '1', '2', '4'], correctIndex: 2 },
  ],
  science: [
    { prompt: 'Bào quan nào chịu trách nhiệm tạo năng lượng ATP cho tế bào?', options: ['Ribosome', 'Ty thể', 'Golgi', 'Không bào'], correctIndex: 1 },
    { prompt: 'Ánh sáng truyền nhanh nhất trong môi trường nào?', options: ['Chân không', 'Nước', 'Thủy tinh', 'Kim cương'], correctIndex: 0 },
    { prompt: 'Công thức hóa học của khí Ozone là gì?', options: ['O₂', 'O₃', 'CO₂', 'H₂O₂'], correctIndex: 1 },
  ],
  history: [
    { prompt: 'Vị vua nào dời đô từ Hoa Lư về Thăng Long năm 1010?', options: ['Đinh Bộ Lĩnh', 'Lê Hoàn', 'Lý Thái Tổ', 'Trần Thái Tông'], correctIndex: 2 },
    { prompt: 'Chiến thắng Bạch Đằng năm 938 gắn liền với danh tướng nào?', options: ['Ngô Quyền', 'Lý Thường Kiệt', 'Trần Hưng Đạo', 'Quang Trung'], correctIndex: 0 },
    { prompt: 'Liên Hợp Quốc chính thức thành lập vào năm nào?', options: ['1918', '1939', '1945', '1954'], correctIndex: 2 },
  ],
  english: [
    { prompt: 'Synonym of "Ubiquitous" is:', options: ['Rare', 'Everywhere', 'Hidden', 'Temporary'], correctIndex: 1 },
    { prompt: 'She ___ in Hanoi for five years before moving.', options: ['lives', 'has lived', 'had lived', 'living'], correctIndex: 2 },
    { prompt: 'Which word is spelled correctly?', options: ['Accomodate', 'Acommodate', 'Accommodate', 'Acomodate'], correctIndex: 2 },
  ],
};

function buildDuelDeck(category: DuelCategoryId, userSets: QuestionSet[]): DuelQuestion[] {
  const keywords = CATEGORY_SET_MATCHERS[category];
  const combinedSets = userSets.length > 0 ? userSets : seedQuestionSets;
  const matchingSets =
    keywords.length === 0
      ? combinedSets
      : combinedSets.filter((s) => {
          const hay = `${s.title} ${s.subject} ${(s.tags ?? []).join(' ')}`.toLowerCase();
          return keywords.some((kw) => hay.includes(kw));
        });

  const pool: DuelQuestion[] = [];
  for (const s of matchingSets) {
    for (const q of s.questions) {
      if (q.options.length >= 2) {
        pool.push({
          prompt: q.content,
          options: q.options,
          correctIndex: q.correctIndex,
          codeSnippet: q.codeSnippet,
        });
      }
    }
  }
  const merged = [...FALLBACK_DUEL_QUESTIONS[category], ...pool];
  // Shuffle deterministically-enough per match start and pick 6 questions
  const shuffled = [...merged].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
}

export function RankedDuelArena({
  playerName,
  onMatchFinished,
}: {
  playerName: string;
  onMatchFinished: (score: number, isWin: boolean) => void;
}) {
  const palette = usePalette();
  const globalElo = usePapyrusStore((s) => s.eloRating);
  const categoryElos = usePapyrusStore((s) => s.categoryElos);
  const recordCategoryElo = usePapyrusStore((s) => s.recordCategoryElo);
  const questionSets = usePapyrusStore((s) => s.questionSets);

  const [category, setCategory] = useState<DuelCategoryId>('coding');
  const [phase, setPhase] = useState<'lobby' | 'searching' | 'playing' | 'summary'>('lobby');
  const [rated, setRated] = useState(true);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [joinInviteInput, setJoinInviteInput] = useState('');
  const [deck, setDeck] = useState<DuelQuestion[]>(() => FALLBACK_DUEL_QUESTIONS.coding);
  const [duelEffect, setDuelEffect] = useState<Model3DActionEffect>('idle');
  const [effectPulse, setEffectPulse] = useState(0);

  const [opponent, setOpponent] = useState<{ name: string; elo: number; accuracy: number; isHuman?: boolean }>({
    name: 'Học giả Nova',
    elo: 1200,
    accuracy: 0.72,
    isHuman: false,
  });
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [lastDelta, setLastDelta] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);

  const currentCatElo = categoryElos[category] ?? globalElo;
  const currentTier = getEloTier(currentCatElo);
  const activeQ = deck[qIndex];
  const finishHandledRef = useRef(false);
  const queueReadyRef = useRef(false);
  const searchRunIdRef = useRef(0);

  // Always clear any leftover stale matchmaking ticket when mounting or leaving the arena
  useEffect(() => {
    void cancelLiveDuelQueue();
    return () => {
      queueReadyRef.current = false;
      void cancelLiveDuelQueue();
    };
  }, []);

  const beginMatch = useCallback(
    (opp: { name: string; elo: number; accuracy: number; isHuman: boolean }) => {
      queueReadyRef.current = false;
      // Consume/delete queue ticket IMMEDIATELY so this opponent is NEVER replayed in a future match
      void cancelLiveDuelQueue();
      setDeck(buildDuelDeck(category, questionSets));
      setOpponent(opp);
      setQIndex(0);
      setMyScore(0);
      setOppScore(0);
      setPicked(null);
      setTimeLeft(12);
      setDuelEffect('idle');
      finishHandledRef.current = false;
      setPhase('playing');
    },
    [category, questionSets]
  );

  const launchAiPractice = useCallback(() => {
    const bot = pickTieredBot(currentCatElo);
    beginMatch({ ...bot, isHuman: false });
  }, [beginMatch, currentCatElo]);

  const handleAnswer = useCallback(
    (choiceIdx: number) => {
      if (!activeQ || picked !== null) return;
      setPicked(choiceIdx);
      const isCorrect = choiceIdx === activeQ.correctIndex;
      const myGain = calculateTieredSpeedScore(isCorrect, timeLeft * 1000, 12_000);
      const botCorrect = Math.random() < opponent.accuracy;
      const oppGain = botCorrect ? calculateTieredSpeedScore(true, 6_500 + Math.random() * 2500, 12_000) : 0;

      if (isCorrect) {
        sfx.playCorrect();
        setDuelEffect('attack');
      } else {
        sfx.playWrong();
        setDuelEffect('hurt');
      }
      setEffectPulse((n) => n + 1);

      const nextMy = myScore + myGain;
      const nextOpp = oppScore + oppGain;
      setMyScore(nextMy);
      setOppScore(nextOpp);

      setTimeout(() => {
        if (qIndex + 1 >= deck.length) {
          if (!finishHandledRef.current) {
            finishHandledRef.current = true;
            void cancelLiveDuelQueue();
            const outcome = nextMy > nextOpp ? 1 : nextMy === nextOpp ? 0.5 : 0;
            const delta = recordCategoryElo(category, outcome, opponent.elo, rated);
            const updatedElo = usePapyrusStore.getState().categoryElos[category] ?? usePapyrusStore.getState().eloRating;
            void syncDuelResultToCloud({
              categoryId: category,
              rated,
              opponentName: opponent.name,
              opponentElo: opponent.elo,
              challengerScore: nextMy,
              opponentScore: nextOpp,
              outcome,
              eloDelta: delta,
              nextElo: updatedElo,
              inviteCode,
            });
            setLastDelta(delta);
            setDuelEffect(outcome === 1 ? 'victory' : outcome === 0 ? 'hurt' : 'idle');
            onMatchFinished(nextMy, outcome === 1);
          }
          setPhase('summary');
        } else {
          setQIndex((i) => i + 1);
          setPicked(null);
          setTimeLeft(12);
          setDuelEffect('idle');
        }
      }, 950);
    },
    [activeQ, picked, timeLeft, qIndex, opponent, myScore, oppScore, deck.length, recordCategoryElo, category, rated, inviteCode, onMatchFinished]
  );

  // Poll ONLY AFTER enqueueLiveDuelQueue succeeded on a fresh ticket (prevents matching stale offline players!)
  useEffect(() => {
    if (phase !== 'searching') return;
    let active = true;

    const timer = setInterval(() => {
      setWaitSeconds((w) => w + 1);
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'searching' || !queueReadyRef.current || waitSeconds === 0) return;
    let active = true;

    // Auto-offer AI scholar after 8 seconds if no real online opponent joined queue
    if (waitSeconds >= 8) {
      const tid = setTimeout(() => {
        if (active) launchAiPractice();
      }, 200);
      return () => {
        active = false;
        clearTimeout(tid);
      };
    }

    const band = eloSearchBand(waitSeconds * 2);
    void pollLiveDuelQueue(category, band).then((res) => {
      if (!active || !res || !queueReadyRef.current) return;
      if (res.status === 'matched' && res.opponentName) {
        beginMatch({
          name: res.opponentName,
          elo: res.opponentElo ?? currentCatElo,
          accuracy: 0.78,
          isHuman: true,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [phase, waitSeconds, category, currentCatElo, beginMatch, launchAiPractice]);

  useEffect(() => {
    if (phase !== 'playing' || picked !== null) return;
    if (timeLeft <= 0) {
      const tid = setTimeout(() => handleAnswer(-1), 0);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, picked, handleAnswer]);

  const startSearch = async (isRated: boolean, customInvite?: string | null) => {
    const activeInvite = customInvite !== undefined ? customInvite : isRated ? null : inviteCode;
    const runId = ++searchRunIdRef.current;
    queueReadyRef.current = false;
    setRated(isRated);
    if (isRated) setInviteCode(null);
    setWaitSeconds(0);
    setPhase('searching');

    // CRITICAL: Always cancel any stale matched ticket FIRST before enqueuing a fresh search!
    await cancelLiveDuelQueue();
    if (searchRunIdRef.current !== runId) return;

    const res = await enqueueLiveDuelQueue({
      categoryId: category,
      rated: isRated,
      eloRating: currentCatElo,
      displayName: playerName || 'Học giả',
      inviteCode: activeInvite,
      eloBand: 150,
    });
    if (searchRunIdRef.current !== runId) return;

    if (res?.status === 'matched' && res.opponentName) {
      beginMatch({
        name: res.opponentName,
        elo: res.opponentElo ?? currentCatElo,
        accuracy: 0.78,
        isHuman: true,
      });
      return;
    }

    // Queue ticket is now guaranteed fresh and 'searching' -> enable polling
    queueReadyRef.current = true;
  };

  const createFriendInvite = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setInviteCode(code);
    setRated(false);
    await Share.share({
      message: `⚔️ Thách đấu 1v1 giao hữu trên Papyrus!\nChủ đề: ${DUEL_CATEGORIES.find((c) => c.id === category)?.label}\nMã lời mời: ${code}\nLink: papyrus://battle?invite=${code}`,
    }).catch(() => undefined);
  };

  const selectedCatLabel = useMemo(
    () => DUEL_CATEGORIES.find((c) => c.id === category)?.label ?? 'Tổng hợp',
    [category]
  );

  // ── 1. LOBBY ──
  if (phase === 'lobby') {
    return (
      <View style={styles.wrap}>
        <Card style={styles.heroCard}>
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.label, { color: palette.indigo }]}>1V1 RANKED MATCHMAKING</Text>
              <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: 2 }]}>
                Đấu trường ELO theo chuyên môn
              </Text>
            </View>
            <View style={[styles.tierPill, { backgroundColor: palette.paper, borderColor: currentTier.color }]}>
              <Text style={{ fontSize: 15 }}>{currentTier.badge}</Text>
              <Text style={[typography.caption, { color: currentTier.color, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
                {currentCatElo} ELO
              </Text>
            </View>
          </View>

          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>
            Ghép đối thủ đang trực tuyến trong 25 giây gần nhất (không bao giờ ghép người chơi cũ đã thoát). Mỗi trận gồm 6 câu hỏi chuyên sâu.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {DUEL_CATEGORIES.map((cat) => {
              const active = category === cat.id;
              const catElo = categoryElos[cat.id] ?? globalElo;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? palette.indigo : palette.paper,
                      borderColor: active ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: active ? '#FFFFFF' : palette.ink, fontWeight: '800' }]}>
                    {cat.icon} {cat.label}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#E0E7FF' : palette.inkMuted, fontVariant: ['tabular-nums'] }}>
                    {catElo} ELO
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.ctaStack}>
            <Button variant="reward" icon="flash" onPress={() => void startSearch(true)} fullWidth>
              ⚔️ Tìm trận Ranked 1v1 ({selectedCatLabel})
            </Button>
            <Button variant="secondary" icon="hardware-chip-outline" onPress={launchAiPractice} fullWidth>
              🤖 Luyện đấu ngay với Bot học giả
            </Button>
            <Button variant="ghost" icon="people-outline" onPress={() => void createFriendInvite()} fullWidth>
              🤝 Tạo mã mời bạn đấu Giao hữu
            </Button>
          </View>

          {inviteCode ? (
            <View style={[styles.inviteBox, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                  MÃ THÁCH ĐẤU GIAO HỮU (KHÔNG TÍNH ELO)
                </Text>
                <Text selectable style={[typography.title, { color: palette.ink, letterSpacing: 3 }]}>
                  {inviteCode}
                </Text>
              </View>
              <Button variant="primary" onPress={() => void startSearch(false, inviteCode)}>
                Vào sân ngay
              </Button>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md, alignItems: 'center' }}>
            <TextInput
              value={joinInviteInput}
              onChangeText={(t) => setJoinInviteInput(t.toUpperCase())}
              placeholder="Nhập mã lời mời bạn bè (6 ký tự)..."
              placeholderTextColor={palette.inkMuted}
              maxLength={8}
              style={{
                flex: 1,
                minHeight: 44,
                borderWidth: 1,
                borderColor: palette.paperMuted,
                backgroundColor: palette.paper,
                borderRadius: radii.sm,
                paddingHorizontal: 12,
                color: palette.ink,
                fontWeight: '700',
              }}
            />
            <Button
              variant="secondary"
              disabled={joinInviteInput.trim().length < 4}
              onPress={() => {
                const code = joinInviteInput.trim().toUpperCase();
                setInviteCode(code);
                void startSearch(false, code);
              }}
            >
              Vào mã
            </Button>
          </View>
        </Card>
      </View>
    );
  }

  // ── 2. SEARCHING RADAR ──
  if (phase === 'searching') {
    const band = eloSearchBand(waitSeconds * 2);
    return (
      <Card style={styles.searchCard}>
        <View style={{ width: 130, height: 110 }}>
          <Model3DErrorBoundary>
            <Model3DView model="questEmblem" height={110} autoRotate interactive={false} />
          </Model3DErrorBoundary>
        </View>
        <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xs, textAlign: 'center' }]}>
          Đang quét người chơi đang online...
        </Text>
        <Badge tone="primary">
          Dải ELO: {Math.max(100, currentCatElo - band)} – {currentCatElo + band} · {waitSeconds}s / 8s
        </Badge>
        <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.xs }]}>
          Chỉ ghép với người chơi thật đang hoạt động trong 25 giây qua. Tự động chuyển sang Bot học giả sau 8 giây nếu hàng chờ trống.
        </Text>
        <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.xs }}>
          <Button variant="reward" icon="flash" onPress={launchAiPractice} fullWidth>
            Đấu ngay với Bot học giả
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              searchRunIdRef.current++;
              queueReadyRef.current = false;
              void cancelLiveDuelQueue();
              setPhase('lobby');
            }}
            fullWidth
          >
            Hủy tìm trận
          </Button>
        </View>
      </Card>
    );
  }

  // ── 3. PLAYING 1v1 DUEL ──
  if (phase === 'playing' && activeQ) {
    return (
      <View style={styles.wrap}>
        {/* Interactive 3D Duel Emblem reacting live to every answer */}
        <View style={styles.duel3dStage}>
          <Model3DErrorBoundary>
            <Model3DView
              model="questEmblem"
              height={118}
              autoRotate
              interactive
              actionEffect={duelEffect}
              pulseTrigger={effectPulse}
            />
          </Model3DErrorBoundary>
        </View>

        <Card style={styles.vsBar}>
          <View style={styles.vsSide}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]} numberOfLines={1}>
              {playerName}
            </Text>
            <Text style={[typography.title, { color: palette.ink, fontSize: 20, fontVariant: ['tabular-nums'] }]}>
              {myScore}
            </Text>
          </View>
          <View style={styles.vsCenter}>
            <Badge tone={timeLeft <= 4 ? 'danger' : 'reward'}>{timeLeft}s</Badge>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2, fontVariant: ['tabular-nums'] }]}>
              Câu {qIndex + 1}/{deck.length}
            </Text>
          </View>
          <View style={[styles.vsSide, { alignItems: 'flex-end' }]}>
            <Text style={[typography.caption, { color: palette.gold, fontWeight: '800' }]} numberOfLines={1}>
              {opponent.isHuman ? '👤 ' : '🤖 '}{opponent.name} ({opponent.elo})
            </Text>
            <Text style={[typography.title, { color: palette.ink, fontSize: 20, fontVariant: ['tabular-nums'] }]}>
              {oppScore}
            </Text>
          </View>
        </Card>

        <Card style={styles.qCard}>
          <View style={styles.qHeader}>
            <Badge tone={rated ? 'primary' : 'neutral'}>
              {rated ? 'RANKED ELO' : 'UNRATED'} · {opponent.isHuman ? 'ONLINE' : 'BOT'}
            </Badge>
            <ReportQuestionButton questionKey={`duel-${category}-${qIndex}`} questionContent={activeQ.prompt} />
          </View>
          <Text style={[typography.heading, { color: palette.ink, fontSize: 18, lineHeight: 26, marginVertical: spacing.md }]}>
            {activeQ.prompt}
          </Text>
          {activeQ.codeSnippet ? (
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>{activeQ.codeSnippet}</Text>
            </View>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            {activeQ.options.map((opt, idx) => {
              let variant: 'secondary' | 'success' | 'danger' = 'secondary';
              if (picked !== null) {
                if (idx === activeQ.correctIndex) variant = 'success';
                else if (idx === picked) variant = 'danger';
              }
              return (
                <Button key={idx} variant={variant} disabled={picked !== null} onPress={() => handleAnswer(idx)} fullWidth>
                  {String.fromCharCode(65 + idx)}. {opt}
                </Button>
              );
            })}
          </View>
        </Card>
      </View>
    );
  }

  // ── 4. SUMMARY ──
  const won = myScore > oppScore;
  const draw = myScore === oppScore;
  return (
    <View style={styles.wrap}>
      <Card style={styles.summaryCard}>
        <Text style={{ fontSize: 42 }}>{won ? '🏆' : draw ? '🤝' : '⚔️'}</Text>
        <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
          {won ? 'Chiến thắng 1v1!' : draw ? 'Hòa nhau kịch tính!' : 'Thất bại sát nút!'}
        </Text>
        <Text style={[typography.title, { color: palette.indigo, marginTop: 4, fontVariant: ['tabular-nums'] }]}>
          {myScore.toLocaleString('vi-VN')} — {oppScore.toLocaleString('vi-VN')}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
          Đối thủ: {opponent.isHuman ? 'Người chơi thật' : 'Bot học giả'} {opponent.name} ({opponent.elo} ELO)
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <Badge tone={!rated ? 'neutral' : lastDelta >= 0 ? 'success' : 'danger'}>
            {!rated
              ? 'Trận giao hữu · ELO không đổi'
              : `${lastDelta >= 0 ? '+' : ''}${lastDelta} ELO (${selectedCatLabel})`}
          </Badge>
        </View>
        <View style={[styles.ctaStack, { width: '100%', marginTop: spacing.lg }]}>
          <Button variant="reward" icon="refresh" onPress={() => void startSearch(rated)} fullWidth>
            Đấu tiếp trận mới
          </Button>
          <Button variant="ghost" onPress={() => setPhase('lobby')} fullWidth>
            Đổi chuyên môn / Về sảnh 1v1
          </Button>
        </View>
      </Card>
      <LiveReactionsBar label="Gửi cảm xúc sau trận 🔥" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.xl },
  heroCard: { padding: spacing.lg, borderRadius: radii.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1.5 },
  catScroll: { gap: spacing.xs, paddingVertical: spacing.md },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1.5, gap: 2 },
  ctaStack: { gap: spacing.sm },
  inviteBox: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1.5, marginTop: spacing.md },
  searchCard: { padding: spacing.xl, borderRadius: radii.lg, alignItems: 'center', gap: spacing.sm },
  duel3dStage: { width: '100%', borderRadius: radii.md, overflow: 'hidden' },
  vsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radii.md },
  vsSide: { flex: 1, minWidth: 0 },
  vsCenter: { alignItems: 'center', paddingHorizontal: spacing.sm },
  qCard: { padding: spacing.lg, borderRadius: radii.md },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeBlock: { backgroundColor: '#0F172A', borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#E2E8F0' },
  summaryCard: { padding: spacing.xl, borderRadius: radii.lg, alignItems: 'center' },
});
