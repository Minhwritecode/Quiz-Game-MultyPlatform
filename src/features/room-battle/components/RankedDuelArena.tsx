import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { calculateTieredSpeedScore } from '@/core/domain/models';
import {
  DUEL_CATEGORIES,
  eloSearchBand,
  getEloTier,
  pickTieredBot,
  type DuelCategoryId,
} from '../domain/elo';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { syncDuelResultToCloud } from '@/features/profile/data/profileCloudSync';
import { sfx } from '@/core/audio/sfx';
import { ReportQuestionButton } from '@/shared/ReportQuestionButton';
import { LiveReactionsBar } from './LiveReactionsBar';

interface DuelQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  codeSnippet?: string;
}

const DUEL_QUESTIONS: Record<DuelCategoryId, DuelQuestion[]> = {
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

  const [category, setCategory] = useState<DuelCategoryId>('coding');
  const [phase, setPhase] = useState<'lobby' | 'searching' | 'playing' | 'summary'>('lobby');
  const [rated, setRated] = useState(true);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const [opponent, setOpponent] = useState<{ name: string; elo: number; accuracy: number }>({
    name: 'Học giả Nova',
    elo: 1200,
    accuracy: 0.72,
  });
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [lastDelta, setLastDelta] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);

  const currentCatElo = categoryElos[category] ?? globalElo;
  const currentTier = getEloTier(currentCatElo);
  const questions = DUEL_QUESTIONS[category];
  const activeQ = questions[qIndex];
  const finishHandledRef = useRef(false);

  const handleAnswer = useCallback(
    (choiceIdx: number) => {
      if (!activeQ || picked !== null) return;
      setPicked(choiceIdx);
      const isCorrect = choiceIdx === activeQ.correctIndex;
      const myGain = calculateTieredSpeedScore(isCorrect, timeLeft * 1000, 12_000);
      const botCorrect = ((qIndex + opponent.elo) % 10) / 10 < opponent.accuracy;
      const oppGain = botCorrect ? calculateTieredSpeedScore(true, 7_500, 12_000) : 0;

      if (isCorrect) sfx.playCorrect();
      else sfx.playWrong();

      const nextMy = myScore + myGain;
      const nextOpp = oppScore + oppGain;
      setMyScore(nextMy);
      setOppScore(nextOpp);

      setTimeout(() => {
        if (qIndex + 1 >= questions.length) {
          if (!finishHandledRef.current) {
            finishHandledRef.current = true;
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
            onMatchFinished(nextMy, outcome === 1);
          }
          setPhase('summary');
        } else {
          setQIndex((i) => i + 1);
          setPicked(null);
          setTimeLeft(12);
        }
      }, 950);
    },
    [activeQ, picked, timeLeft, qIndex, opponent, myScore, oppScore, questions.length, recordCategoryElo, category, rated, onMatchFinished]
  );

  // Widening ELO queue timer -> matches tiered bot after 4s preview (ADR-006 widening band 100 -> 500)
  useEffect(() => {
    if (phase !== 'searching') return;
    if (waitSeconds >= 4) {
      const bot = pickTieredBot(currentCatElo);
      const tid = setTimeout(() => {
        setOpponent(bot);
        setQIndex(0);
        setMyScore(0);
        setOppScore(0);
        setPicked(null);
        setTimeLeft(12);
        finishHandledRef.current = false;
        setPhase('playing');
      }, 250);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => setWaitSeconds((w) => w + 1), 1000);
    return () => clearInterval(timer);
  }, [phase, waitSeconds, currentCatElo]);

  // Countdown during active duel question
  useEffect(() => {
    if (phase !== 'playing' || picked !== null) return;
    if (timeLeft <= 0) {
      const tid = setTimeout(() => handleAnswer(-1), 0);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, picked, handleAnswer]);

  const startSearch = (isRated: boolean) => {
    setRated(isRated);
    setInviteCode(null);
    setWaitSeconds(0);
    setPhase('searching');
  };

  const createFriendInvite = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setInviteCode(code);
    setRated(false);
    await Share.share({
      message: `⚔️ Thách đấu 1v1 giao hữu (Unrated) trên Papyrus!\nChủ đề: ${DUEL_CATEGORIES.find((c) => c.id === category)?.label}\nMã lời mời: ${code}\nLink: papyrus://battle?invite=${code}`,
    }).catch(() => undefined);
  };

  // ── 1. LOBBY: Category ELO Picker + Ranked Queue + Unrated Friend Invite ──
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
              <Text style={[typography.caption, { color: currentTier.color, fontWeight: '800' }]}>
                {currentCatElo} ELO
              </Text>
            </View>
          </View>

          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>
            Mỗi môn học có điểm ELO riêng. Hàng chờ tự mở rộng dải tìm kiếm (±100 → ±500) và ghép đối thủ ngang trình chỉ trong vài giây.
          </Text>

          {/* Category ELO Selector */}
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
                  <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#E0E7FF' : palette.inkMuted }}>
                    {catElo} ELO
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.ctaStack}>
            <Button variant="reward" icon="flash" onPress={() => startSearch(true)} fullWidth>
              ⚔️ Tìm trận Ranked 1v1 (Tính ELO)
            </Button>
            <Button variant="secondary" icon="people-outline" onPress={() => void createFriendInvite()} fullWidth>
              🤝 Mời bạn đấu Giao hữu (Unrated)
            </Button>
          </View>

          {inviteCode ? (
            <View style={[styles.inviteBox, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                  MÃ THÁCH ĐẤU GIAO HỮU (KHÔNG TÍNH ELO)
                </Text>
                <Text style={[typography.title, { color: palette.ink, letterSpacing: 3 }]}>{inviteCode}</Text>
              </View>
              <Button variant="primary" onPress={() => startSearch(false)}>
                Vào sân ngay
              </Button>
            </View>
          ) : null}
        </Card>
      </View>
    );
  }

  // ── 2. SEARCHING RADAR WITH WIDENING ELO BAND ──
  if (phase === 'searching') {
    const band = eloSearchBand(waitSeconds * 2);
    return (
      <Card style={styles.searchCard}>
        <Ionicons name="radio-outline" size={44} color={palette.indigo} />
        <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>
          Đang ghép đối thủ {rated ? 'Ranked' : 'Giao hữu'}...
        </Text>
        <Badge tone="primary">
          Dải ELO hiện tại: {Math.max(100, currentCatElo - band)} – {currentCatElo + band} (±{band})
        </Badge>
        <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.xs }]}>
          Thời gian chờ: {waitSeconds}s · Tự động ghép đối thủ ngang hạng nếu hàng chờ vắng.
        </Text>
        <View style={{ marginTop: spacing.md, width: '100%' }}>
          <Button variant="ghost" onPress={() => setPhase('lobby')} fullWidth>
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
        {/* VS Scoreboard Header */}
        <Card style={styles.vsBar}>
          <View style={styles.vsSide}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]} numberOfLines={1}>
              {playerName}
            </Text>
            <Text style={[typography.title, { color: palette.ink, fontSize: 20 }]}>{myScore}</Text>
          </View>
          <View style={styles.vsCenter}>
            <Badge tone={timeLeft <= 4 ? 'danger' : 'reward'}>{timeLeft}s</Badge>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              Câu {qIndex + 1}/{questions.length}
            </Text>
          </View>
          <View style={[styles.vsSide, { alignItems: 'flex-end' }]}>
            <Text style={[typography.caption, { color: palette.gold, fontWeight: '800' }]} numberOfLines={1}>
              {opponent.name} ({opponent.elo})
            </Text>
            <Text style={[typography.title, { color: palette.ink, fontSize: 20 }]}>{oppScore}</Text>
          </View>
        </Card>

        <Card style={styles.qCard}>
          <View style={styles.qHeader}>
            <Badge tone={rated ? 'primary' : 'neutral'}>{rated ? 'RANKED ELO' : 'UNRATED'}</Badge>
            <ReportQuestionButton questionKey={`duel-${category}-${qIndex}`} questionContent={activeQ.prompt} />
          </View>
          <Text style={[typography.heading, { color: palette.ink, fontSize: 19, marginVertical: spacing.md }]}>
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

  // ── 4. MATCH SUMMARY + ELO DELTA ──
  const won = myScore > oppScore;
  const draw = myScore === oppScore;
  return (
    <View style={styles.wrap}>
      <Card style={styles.summaryCard}>
        <Text style={{ fontSize: 42 }}>{won ? '🏆' : draw ? '🤝' : '⚔️'}</Text>
        <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
          {won ? 'Chiến thắng 1v1!' : draw ? 'Hòa nhau kịch tính!' : 'Thất bại sát nút!'}
        </Text>
        <Text style={[typography.title, { color: palette.indigo, marginTop: 4 }]}>
          {myScore.toLocaleString('vi-VN')} — {oppScore.toLocaleString('vi-VN')}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <Badge tone={!rated ? 'neutral' : lastDelta >= 0 ? 'success' : 'danger'}>
            {!rated
              ? 'Trận giao hữu · ELO không đổi'
              : `${lastDelta >= 0 ? '+' : ''}${lastDelta} ELO (${DUEL_CATEGORIES.find((c) => c.id === category)?.label})`}
          </Badge>
        </View>
        <View style={[styles.ctaStack, { width: '100%', marginTop: spacing.lg }]}>
          <Button variant="reward" icon="refresh" onPress={() => startSearch(rated)} fullWidth>
            Đấu tiếp trận mới
          </Button>
          <Button variant="ghost" onPress={() => setPhase('lobby')} fullWidth>
            Đổi chuyên môn / Về sảnh 1v1
          </Button>
        </View>
      </Card>
      <LiveReactionsBar label="Gửi lời chào đối thủ 🔥" />
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
  vsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radii.md },
  vsSide: { flex: 1, minWidth: 0 },
  vsCenter: { alignItems: 'center', paddingHorizontal: spacing.sm },
  qCard: { padding: spacing.lg, borderRadius: radii.md },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeBlock: { backgroundColor: '#0F172A', borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#E2E8F0' },
  summaryCard: { padding: spacing.xl, borderRadius: radii.lg, alignItems: 'center' },
});
