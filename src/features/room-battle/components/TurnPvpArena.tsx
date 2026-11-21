import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { calculateTieredSpeedScore } from '@/core/domain/models';
import { sfx } from '@/core/audio/sfx';

export type TurnTopicId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'math'
  | 'physics'
  | 'history'
  | 'english'
  | 'science';

export type TurnDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

interface TurnQuestion {
  topic: TurnTopicId;
  difficulty: TurnDifficulty;
  prompt: string;
  codeSnippet?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface TurnPlayer {
  id: string;
  name: string;
  score: number;
  isMe: boolean;
}

interface TurnWinner {
  name: string;
  points: number;
  isMe: boolean;
}

const TOPICS: Array<{ id: TurnTopicId; label: string; icon: string }> = [
  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'python', label: 'Python', icon: '🐍' },
  { id: 'math', label: 'Toán học', icon: '📐' },
  { id: 'physics', label: 'Vật lý', icon: '⚡' },
  { id: 'history', label: 'Lịch sử', icon: '📜' },
  { id: 'english', label: 'Tiếng Anh', icon: '🇬🇧' },
  { id: 'science', label: 'Khoa học', icon: '🔬' },
];

const DIFFICULTIES: Array<{ id: TurnDifficulty; label: string; multiplier: number }> = [
  { id: 'easy', label: 'Dễ', multiplier: 1 },
  { id: 'medium', label: 'Vừa', multiplier: 1.15 },
  { id: 'hard', label: 'Khó', multiplier: 1.3 },
  { id: 'expert', label: 'Chuyên gia', multiplier: 1.5 },
];

const QUESTION_BANK: Record<TurnTopicId, Omit<TurnQuestion, 'topic' | 'difficulty'>[]> = {
  javascript: [
    {
      prompt: 'Kết quả in ra console của đoạn code JavaScript sau là gì?',
      codeSnippet: 'const arr = [1, 2, 3];\nconst res = arr.map(x => x * 2).filter(x => x > 3);\nconsole.log(res.length);',
      options: ['1', '2', '3', 'undefined'],
      correctIndex: 1,
      explanation: 'arr.map tạo [2, 4, 6], lọc x > 3 còn [4, 6] nên length = 2.',
    },
    {
      prompt: 'Giá trị của typeof null trong JavaScript là gì?',
      codeSnippet: 'console.log(typeof null);',
      options: ['"null"', '"undefined"', '"object"', '"boolean"'],
      correctIndex: 2,
      explanation: 'Đây là hành vi lịch sử nổi tiếng của JavaScript: typeof null trả về "object".',
    },
  ],
  typescript: [
    {
      prompt: 'Utility type nào giúp biến toàn bộ thuộc tính của interface thành optional?',
      codeSnippet: 'interface User { id: string; name: string; }\ntype DraftUser = ???<User>;',
      options: ['Required<User>', 'Partial<User>', 'Readonly<User>', 'Pick<User>'],
      correctIndex: 1,
      explanation: 'Partial<T> đánh dấu toàn bộ thuộc tính của T thành tùy chọn (?).',
    },
    {
      prompt: 'Kiểu dữ liệu nào an toàn hơn `any` khi cần kiểm tra kiểu trước lúc dùng?',
      codeSnippet: 'function parse(input: ???) {\n  if (typeof input === "string") return input.trim();\n}',
      options: ['never', 'void', 'unknown', 'object'],
      correctIndex: 2,
      explanation: '`unknown` bắt buộc bạn phải thu hẹp kiểu (type narrowing) trước khi thao tác.',
    },
  ],
  python: [
    {
      prompt: 'Đoạn code Python dưới đây in ra kết quả nào?',
      codeSnippet: 'nums = [10, 20, 30, 40]\nprint(nums[-2:][0])',
      options: ['10', '20', '30', '40'],
      correctIndex: 2,
      explanation: 'nums[-2:] lấy 2 phần tử cuối [30, 40], phần tử đầu tiên [0] là 30.',
    },
  ],
  math: [
    {
      prompt: 'Đạo hàm của hàm số f(x) = x³ - 3x² + 5 tại điểm x = 2 bằng bao nhiêu?',
      options: ['0', '3', '6', '-3'],
      correctIndex: 0,
      explanation: "f'(x) = 3x² - 6x. Tại x = 2: f'(2) = 3(4) - 12 = 0.",
    },
  ],
  physics: [
    {
      prompt: 'Định luật II Newton biểu diễn mối liên hệ giữa lực, khối lượng và gia tốc là:',
      options: ['F = m / a', 'F = m · a', 'F = m · v²', 'F = ½ m · a²'],
      correctIndex: 1,
      explanation: 'Hợp lực tác dụng lên vật bằng tích khối lượng và gia tốc: F = m · a.',
    },
  ],
  history: [
    {
      prompt: 'Chiến thắng Điện Biên Phủ lừng lẫy năm châu diễn ra vào ngày tháng năm nào?',
      options: ['19/08/1945', '02/09/1945', '07/05/1954', '30/04/1975'],
      correctIndex: 2,
      explanation: 'Quân đội ta giải phóng hoàn toàn tập đoàn cứ điểm Điện Biên Phủ vào 07/05/1954.',
    },
  ],
  english: [
    {
      prompt: 'Choose the correct sentence using the third conditional:',
      options: [
        'If I studied, I would have passed.',
        'If I had studied harder, I would have passed the exam.',
        'If I have studied, I will passed.',
        'If I study harder, I would pass.',
      ],
      correctIndex: 1,
      explanation: 'Câu điều kiện loại 3 có cấu trúc: If + S + had + V3/ed, S + would have + V3/ed.',
    },
  ],
  science: [
    {
      prompt: 'Khí nào chiếm tỉ lệ thể tích lớn nhất trong khí quyển Trái Đất (~78%)?',
      options: ['Oxy (O₂)', 'Nitơ (N₂)', 'Cacbonic (CO₂)', 'Argon (Ar)'],
      correctIndex: 1,
      explanation: 'Khí quyển Trái Đất gồm khoảng 78% Nitơ, 21% Oxy và 1% các khí khác.',
    },
  ],
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function pickQuestion(topic: TurnTopicId, difficulty: TurnDifficulty, roundIdx: number): TurnQuestion {
  const pool = QUESTION_BANK[topic] || QUESTION_BANK.javascript;
  const base = pool[roundIdx % pool.length] ?? pool[0]!;
  return { ...base, topic, difficulty };
}

interface TurnPvpArenaProps {
  playerName: string;
  secondsPerQuestion: number;
  totalRounds?: number;
  maxPlayers?: number;
  onFinish: (myScore: number, isWin: boolean) => void;
  onExit: () => void;
}

export function TurnPvpArena({
  playerName,
  secondsPerQuestion,
  totalRounds = 4,
  maxPlayers = 2,
  onFinish,
  onExit,
}: TurnPvpArenaProps) {
  const palette = usePalette();
  const rivalPool = ['Học giả Minerva', 'Kỵ sĩ Alan', 'Pháp sư Ada', 'Thủ lĩnh Euler'];
  const [players, setPlayers] = useState<TurnPlayer[]>(() => {
    const count = Math.min(Math.max(2, maxPlayers), 4);
    const list: TurnPlayer[] = [{ id: 'me', name: playerName || 'Bạn', score: 0, isMe: true }];
    for (let i = 1; i < count; i++) {
      list.push({ id: `rival-${i}`, name: rivalPool[i - 1] ?? `Đối thủ ${i}`, score: 0, isMe: false });
    }
    return list;
  });

  const [round, setRound] = useState(1);
  const [turnPlayerIndex, setTurnPlayerIndex] = useState(0);
  const [phase, setPhase] = useState<'selecting' | 'answering' | 'turn_result' | 'finished'>('selecting');

  const [selectedTopic, setSelectedTopic] = useState<TurnTopicId>('javascript');
  const [selectedDifficulty, setSelectedDifficulty] = useState<TurnDifficulty>('medium');
  const [activeQuestion, setActiveQuestion] = useState<TurnQuestion | null>(null);
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [turnWinner, setTurnWinner] = useState<TurnWinner | null>(null);

  const finishCalledRef = useRef(false);
  const activePlayer = players[turnPlayerIndex] ?? players[0]!;
  const isMyTurn = activePlayer.isMe;
  const nextTurnIndex = (turnPlayerIndex + 1) % players.length;
  const isNextMyTurn = players[nextTurnIndex]?.isMe ?? true;

  const resolveTurn = useCallback(
    (chosenIndex: number | null, remainingSec: number) => {
      if (!activeQuestion) return;
      const diffMeta = DIFFICULTIES.find((d) => d.id === activeQuestion.difficulty) ?? DIFFICULTIES[1]!;
      const isCorrect = chosenIndex === activeQuestion.correctIndex;
      const rawPts = calculateTieredSpeedScore(isCorrect, remainingSec * 1000, secondsPerQuestion * 1000);
      const myPoints = Math.round(rawPts * diffMeta.multiplier);

      if (isCorrect) {
        sfx.playCorrect();
      } else {
        sfx.playWrong();
      }

      let topWinner: TurnWinner | null = isCorrect
        ? { name: players[0]!.name, points: myPoints, isMe: true }
        : null;

      setPlayers((prev) =>
        prev.map((p, idx) => {
          if (p.isMe) return { ...p, score: p.score + myPoints };
          const rivalCorrect = (round + idx) % 3 !== 0;
          const rivalRemaining = Math.max(2, secondsPerQuestion - (3 + idx * 2));
          const rivalPts = rivalCorrect
            ? Math.round(
                calculateTieredSpeedScore(true, rivalRemaining * 1000, secondsPerQuestion * 1000) * diffMeta.multiplier
              )
            : 0;
          if (rivalPts > (topWinner?.points ?? 0)) {
            topWinner = { name: p.name, points: rivalPts, isMe: false };
          }
          return { ...p, score: p.score + rivalPts };
        })
      );

      setTurnWinner(topWinner);
      setPhase('turn_result');
    },
    [activeQuestion, players, round, secondsPerQuestion]
  );

  // Rival auto-selects topic & difficulty on its turn
  useEffect(() => {
    if (phase !== 'selecting' || isMyTurn) return;
    const tid = setTimeout(() => {
      const rivalTopic = TOPICS[(round + turnPlayerIndex) % TOPICS.length]!.id;
      const rivalDiff = DIFFICULTIES[round % DIFFICULTIES.length]!.id;
      setSelectedTopic(rivalTopic);
      setSelectedDifficulty(rivalDiff);
      setActiveQuestion(pickQuestion(rivalTopic, rivalDiff, round));
      setMyChoice(null);
      setTimeLeft(secondsPerQuestion);
      setPhase('answering');
    }, 1100);
    return () => clearTimeout(tid);
  }, [phase, isMyTurn, round, turnPlayerIndex, secondsPerQuestion]);

  // Countdown during answering phase
  useEffect(() => {
    if (phase !== 'answering') return;
    if (timeLeft <= 0) {
      const tid = setTimeout(() => resolveTurn(null, 0), 0);
      return () => clearTimeout(tid);
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft, resolveTurn]);

  const handleLaunchQuestion = () => {
    sfx.playSpellCast();
    setActiveQuestion(pickQuestion(selectedTopic, selectedDifficulty, round));
    setMyChoice(null);
    setTimeLeft(secondsPerQuestion);
    setPhase('answering');
  };

  const handleChooseOption = (idx: number) => {
    if (myChoice !== null || phase !== 'answering') return;
    setMyChoice(idx);
    resolveTurn(idx, timeLeft);
  };

  const handleNextTurn = () => {
    if (round >= totalRounds) {
      setPhase('finished');
      if (!finishCalledRef.current) {
        finishCalledRef.current = true;
        const sorted = [...players].sort((a, b) => b.score - a.score);
        const me = players.find((p) => p.isMe);
        onFinish(me?.score ?? 0, sorted[0]?.isMe ?? false);
      }
      return;
    }
    setRound((r) => r + 1);
    setTurnPlayerIndex(nextTurnIndex);
    setPhase('selecting');
  };

  const sortedStandings = [...players].sort((a, b) => b.score - a.score);

  return (
    <View style={styles.wrap}>
      {/* 1. CURRENT TURN CARD */}
      <Card style={[styles.turnCard, { borderColor: isMyTurn ? palette.indigo : palette.paperMuted }]}>
        <View style={styles.turnHeaderRow}>
          <View style={[styles.avatarCircle, { backgroundColor: isMyTurn ? palette.indigo : palette.gold }]}>
            <Text style={styles.avatarInitials}>{getInitials(activePlayer.name)}</Text>
          </View>
          <View style={styles.turnMeta}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
              LƯỢT HIỆN TẠI · VÒNG {round}/{totalRounds}
            </Text>
            <Text style={[typography.title, { color: palette.ink }]} numberOfLines={1}>
              {activePlayer.name}
            </Text>
          </View>
          <Badge tone={isMyTurn ? 'primary' : 'reward'}>
            {isMyTurn ? 'Lượt của bạn' : 'Lượt đối thủ'}
          </Badge>
        </View>
      </Card>

      {/* 2. QUESTION SELECTION CARD */}
      {phase === 'selecting' && (
        <Card style={styles.mainCard}>
          {isMyTurn ? (
            <>
              <Text style={[typography.title, { color: palette.ink, fontSize: 18 }]}>
                🎯 Đến lượt bạn chọn đề!
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
                Chọn chủ đề và độ khó cho câu hỏi của vòng {round}. Cả phòng sẽ cùng tranh tốc độ!
              </Text>

              <Text style={[typography.label, { color: palette.indigo, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                CHỦ ĐỀ / NGÔN NGỮ
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TOPICS.map((item) => {
                  const active = selectedTopic === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSelectedTopic(item.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? palette.indigo : palette.paper,
                          borderColor: active ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    >
                      <Text style={[typography.caption, { color: active ? '#FFFFFF' : palette.ink, fontWeight: '700' }]}>
                        {item.icon} {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[typography.label, { color: palette.indigo, marginTop: spacing.md, marginBottom: spacing.xs }]}>
                ĐỘ KHÓ (HỆ SỐ ĐIỂM)
              </Text>
              <View style={styles.diffGrid}>
                {DIFFICULTIES.map((d) => {
                  const active = selectedDifficulty === d.id;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => setSelectedDifficulty(d.id)}
                      style={[
                        styles.diffPill,
                        {
                          backgroundColor: active ? palette.indigoTint : palette.paper,
                          borderColor: active ? palette.indigo : palette.paperMuted,
                        },
                      ]}
                    >
                      <Text style={[typography.caption, { color: active ? palette.indigo : palette.ink, fontWeight: '700' }]}>
                        {d.label} (x{d.multiplier})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Button variant="reward" icon="flash" onPress={handleLaunchQuestion} fullWidth>
                  Tạo câu hỏi & Bắt đầu lượt
                </Button>
              </View>
            </>
          ) : (
            <View style={styles.waitingBox}>
              <Ionicons name="hourglass-outline" size={32} color={palette.indigo} />
              <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm, textAlign: 'center' }]}>
                Lượt của {activePlayer.name}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                Đối thủ đang chọn chủ đề và độ khó cho vòng {round}...
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* 3. ACTIVE QUESTION CARD */}
      {phase === 'answering' && activeQuestion && (
        <Card style={styles.mainCard}>
          <View style={styles.qMetaRow}>
            <Badge tone="primary">
              {TOPICS.find((t) => t.id === activeQuestion.topic)?.label} · {activeQuestion.difficulty.toUpperCase()}
            </Badge>
            <Badge tone={timeLeft <= 5 ? 'danger' : 'neutral'}>{timeLeft}s</Badge>
          </View>

          <Text style={[typography.heading, { color: palette.ink, fontSize: 19, marginVertical: spacing.md }]}>
            {activeQuestion.prompt}
          </Text>

          {activeQuestion.codeSnippet ? (
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>{activeQuestion.codeSnippet}</Text>
            </View>
          ) : null}

          <View style={styles.optionsCol}>
            {activeQuestion.options.map((opt, idx) => (
              <Button
                key={idx}
                variant="secondary"
                onPress={() => handleChooseOption(idx)}
                fullWidth
              >
                {String.fromCharCode(65 + idx)}. {opt}
              </Button>
            ))}
          </View>
        </Card>
      )}

      {/* 4. TURN RESULT CARD */}
      {phase === 'turn_result' && activeQuestion && (
        <Card style={[styles.mainCard, { borderColor: turnWinner?.isMe ? palette.mint : palette.gold, borderWidth: 1.5 }]}>
          <View style={styles.resultCenter}>
            <Text style={{ fontSize: 34 }}>{turnWinner?.isMe ? '🏆' : turnWinner ? '⚡' : '⏱️'}</Text>
            <Text
              style={[
                typography.title,
                { color: turnWinner?.isMe ? palette.mint : palette.ink, marginTop: spacing.xs, textAlign: 'center' },
              ]}
            >
              {turnWinner
                ? `${turnWinner.name} dẫn đầu lượt này! (+${turnWinner.points} điểm)`
                : 'Hết giờ! Không ai trả lời đúng lượt này.'}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 6 }]}>
              Đáp án đúng: {String.fromCharCode(65 + activeQuestion.correctIndex)}. {activeQuestion.options[activeQuestion.correctIndex]}
            </Text>
            <Text style={[typography.caption, { color: palette.ink, textAlign: 'center', marginTop: 4 }]}>
              💡 {activeQuestion.explanation}
            </Text>

            <View style={{ marginTop: spacing.lg, width: '100%' }}>
              <Button variant="primary" icon="arrow-forward" onPress={handleNextTurn} fullWidth>
                {round >= totalRounds
                  ? 'Xem bảng vàng chung cuộc'
                  : isNextMyTurn
                  ? 'Bắt đầu lượt tiếp theo (Lượt của bạn)'
                  : `Chuyển lượt cho ${players[nextTurnIndex]?.name}`}
              </Button>
            </View>
          </View>
        </Card>
      )}

      {/* 5. FINAL STANDINGS */}
      <Card style={styles.standingsCard}>
        <Text style={[typography.title, { color: palette.ink, marginBottom: spacing.sm }]}>
          {phase === 'finished' ? '🏆 BẢNG VÀNG PVP THEO LƯỢT' : '📊 Xếp hạng trực tiếp'}
        </Text>
        <View style={{ gap: spacing.xs }}>
          {sortedStandings.map((p, idx) => (
            <View
              key={p.id}
              style={[
                styles.standingRow,
                {
                  backgroundColor: p.isMe ? palette.indigoTint : palette.paper,
                  borderColor: p.isMe ? palette.indigo : palette.paperMuted,
                },
              ]}
            >
              <Text style={[typography.title, { color: idx === 0 ? palette.gold : palette.ink, width: 32 }]}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </Text>
              <Text style={[typography.body, { color: palette.ink, flex: 1, fontWeight: p.isMe ? '800' : '600' }]} numberOfLines={1}>
                {p.name} {p.isMe ? '(Bạn)' : ''}
              </Text>
              <Text style={[typography.title, { color: palette.indigo, fontSize: 15 }]}>
                {p.score.toLocaleString('vi-VN')} đ
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Button variant="ghost" icon="arrow-back" onPress={onExit} fullWidth>
        Quay lại sảnh đấu trường
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.xxl },
  turnCard: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1.5 },
  turnHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  turnMeta: { flex: 1, minWidth: 0 },
  mainCard: { padding: spacing.lg, borderRadius: radii.md },
  chipRow: { gap: spacing.xs, paddingVertical: 2 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1.5 },
  diffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  diffPill: { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radii.sm, borderWidth: 1.5 },
  waitingBox: { alignItems: 'center', paddingVertical: spacing.xl },
  qMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  codeBlock: { backgroundColor: '#0F172A', borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  codeText: { fontFamily: 'monospace', fontSize: 13, lineHeight: 20, color: '#E2E8F0' },
  optionsCol: { gap: spacing.sm },
  resultCenter: { alignItems: 'center' },
  standingsCard: { padding: spacing.md, borderRadius: radii.md },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
