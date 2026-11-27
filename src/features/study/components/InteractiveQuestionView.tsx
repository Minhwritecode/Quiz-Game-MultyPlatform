import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import type { Question } from '@/core/domain/models';

interface InteractiveQuestionViewProps {
  question: Question;
  revealed: boolean;
  onComplete: (isCorrect: boolean, chosenIndex: number | null) => void;
}

/**
 * Renders ADR-011 pluggable interactive question types:
 * - multiSelect (multiple_choice with multiple correct answers)
 * - poll (unscored live bar breakdown)
 * - word_cloud (unscored keyword tags with scaled bubble preview)
 * - rating (unscored 1-5 stars or 1-10 numeric scale)
 * - open_text (unscored free response with optional anonymous toggle)
 */
export function InteractiveQuestionView({
  question,
  revealed,
  onComplete,
}: InteractiveQuestionViewProps) {
  const palette = usePalette();
  const qType = question.questionType ?? 'multiple_choice';

  // Multi-select state
  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);
  // Poll state
  const [pollChoice, setPollChoice] = useState<number | null>(null);
  // Word cloud state
  const [wordDraft, setWordDraft] = useState('');
  const [words, setWords] = useState<string[]>([]);
  // Rating state
  const [ratingVal, setRatingVal] = useState<number | null>(null);
  // Open text state
  const [openText, setOpenText] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  // 1. MULTI-SELECT MULTIPLE CHOICE
  if (qType === 'multiple_choice' && question.multiSelect) {
    const correctSet = new Set(
      question.correctIndices && question.correctIndices.length > 0
        ? question.correctIndices
        : [question.correctIndex]
    );

    const toggleOption = (idx: number) => {
      if (revealed) return;
      setCheckedIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    };

    const submitMulti = () => {
      const exactMatch =
        checkedIndices.length === correctSet.size &&
        checkedIndices.every((idx) => correctSet.has(idx));
      onComplete(exactMatch, checkedIndices[0] ?? 0);
    };

    return (
      <View style={styles.wrap}>
        <View style={styles.hintRow}>
          <Badge tone="primary">☑ Chọn nhiều đáp án đúng</Badge>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            Đã chọn: {checkedIndices.length}
          </Text>
        </View>
        {question.options.map((opt, idx) => {
          const isPicked = checkedIndices.includes(idx);
          const isRight = revealed && correctSet.has(idx);
          const isWrong = revealed && isPicked && !correctSet.has(idx);
          return (
            <Pressable
              key={idx}
              disabled={revealed}
              onPress={() => toggleOption(idx)}
              style={[
                styles.optBtn,
                {
                  backgroundColor: isRight
                    ? palette.mintTint
                    : isWrong
                    ? palette.dangerTint
                    : isPicked
                    ? palette.indigoTint
                    : palette.paperRaised,
                  borderColor: isRight
                    ? palette.mint
                    : isWrong
                    ? palette.danger
                    : isPicked
                    ? palette.indigo
                    : palette.paperMuted,
                },
              ]}
            >
              <AppIcon
                name={isPicked ? 'checkbox' : 'square-outline'}
                size={22}
                color={isRight ? palette.mint : isWrong ? palette.danger : isPicked ? palette.indigo : palette.inkMuted}
              />
              <Text style={[typography.body, { color: palette.ink, flex: 1, fontWeight: isPicked ? '700' : '500' }]}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
        {!revealed && (
          <Button variant="primary" disabled={checkedIndices.length === 0} onPress={submitMulti} fullWidth>
            Xác nhận ({checkedIndices.length} lựa chọn)
          </Button>
        )}
      </View>
    );
  }

  // 2. POLL (LIVE BAR BREAKDOWN)
  if (qType === 'poll') {
    const sampleVotes = question.options.map((_, idx) => 3 + ((idx * 5) % 9) + (pollChoice === idx ? 1 : 0));
    const totalVotes = sampleVotes.reduce((s, v) => s + v, 0);

    return (
      <View style={styles.wrap}>
        <Badge tone="reward">📊 Bình chọn tương tác (Không chấm điểm)</Badge>
        {question.options.map((opt, idx) => {
          const pct = totalVotes > 0 ? Math.round((sampleVotes[idx]! / totalVotes) * 100) : 0;
          const picked = pollChoice === idx;
          return (
            <Pressable
              key={idx}
              disabled={revealed}
              onPress={() => {
                setPollChoice(idx);
                onComplete(true, idx);
              }}
              style={[
                styles.pollBtn,
                {
                  borderColor: picked ? palette.indigo : palette.paperMuted,
                  backgroundColor: palette.paperRaised,
                },
              ]}
            >
              <View style={styles.pollHeader}>
                <Text style={[typography.body, { color: palette.ink, flex: 1, fontWeight: picked ? '800' : '600' }]}>
                  {opt}
                </Text>
                {revealed ? (
                  <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{pct}%</Text>
                ) : null}
              </View>
              {revealed ? (
                <View style={[styles.pollTrack, { backgroundColor: palette.paperMuted }]}>
                  <View style={[styles.pollFill, { width: `${pct}%`, backgroundColor: picked ? palette.indigo : palette.mint }]} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );
  }

  // 3. WORD CLOUD
  if (qType === 'word_cloud') {
    const seedCloud = [
      { text: 'Sáng tạo', weight: 3 },
      { text: 'Tốc độ', weight: 2 },
      { text: 'Hợp tác', weight: 2 },
      ...words.map((w) => ({ text: w, weight: 4 })),
    ];

    const addWord = () => {
      const cleaned = wordDraft.trim().slice(0, 32);
      if (!cleaned || words.length >= 3) return;
      setWords((prev) => [...prev, cleaned]);
      setWordDraft('');
    };

    return (
      <Card style={styles.interactiveCard}>
        <Badge tone="primary">☁️ Đám mây từ khóa (Tối đa 3 từ)</Badge>
        {!revealed ? (
          <>
            <View style={styles.wordInputRow}>
              <TextInput
                value={wordDraft}
                onChangeText={setWordDraft}
                onSubmitEditing={addWord}
                placeholder="Nhập từ khóa ngắn..."
                placeholderTextColor={palette.inkMuted}
                maxLength={32}
                style={[styles.textField, { flex: 1, color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
              />
              <Button variant="secondary" disabled={!wordDraft.trim() || words.length >= 3} onPress={addWord}>
                Thêm
              </Button>
            </View>
            {words.length > 0 && (
              <View style={styles.cloudWrap}>
                {words.map((w, i) => (
                  <View key={`${w}-${i}`} style={[styles.wordChip, { backgroundColor: palette.indigoTint }]}>
                    <Text style={{ color: palette.indigo, fontWeight: '800', fontSize: 14 }}>{w}</Text>
                  </View>
                ))}
              </View>
            )}
            <Button variant="primary" disabled={words.length === 0} onPress={() => onComplete(true, 0)} fullWidth>
              Gửi lên Word Cloud ({words.length}/3)
            </Button>
          </>
        ) : (
          <View style={styles.cloudWrap}>
            {seedCloud.map((item, idx) => (
              <View
                key={`${item.text}-${idx}`}
                style={[
                  styles.wordChip,
                  { backgroundColor: item.weight >= 4 ? palette.indigo : palette.indigoTint },
                ]}
              >
                <Text
                  style={{
                    color: item.weight >= 4 ? '#FFFFFF' : palette.indigo,
                    fontWeight: '800',
                    fontSize: 12 + item.weight * 2.5,
                  }}
                >
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    );
  }

  // 4. RATING SCALE (1-5 STARS OR 1-10)
  if (qType === 'rating') {
    const scaleMax = question.ratingMax ?? 5;
    const nums = Array.from({ length: scaleMax }, (_, i) => i + 1);
    return (
      <Card style={styles.interactiveCard}>
        <Badge tone="reward">⭐ Đánh giá thang điểm 1–{scaleMax}</Badge>
        <View style={styles.ratingRow}>
          {nums.map((n) => {
            const active = ratingVal !== null && n <= ratingVal;
            return (
              <Pressable
                key={n}
                disabled={revealed}
                onPress={() => setRatingVal(n)}
                style={[
                  styles.ratingPill,
                  {
                    backgroundColor: active ? palette.goldTint : palette.paper,
                    borderColor: active ? palette.gold : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: scaleMax === 5 ? 20 : 14, fontWeight: '800', color: active ? palette.gold : palette.inkMuted }}>
                  {scaleMax === 5 ? (active ? '★' : '☆') : String(n)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.ratingLabels}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {question.ratingLabels?.low || 'Rất thấp'}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {question.ratingLabels?.high || 'Tuyệt vời'}
          </Text>
        </View>
        {!revealed ? (
          <Button variant="primary" disabled={ratingVal === null} onPress={() => onComplete(true, ratingVal)} fullWidth>
            Gửi đánh giá {ratingVal ? `(${ratingVal}/${scaleMax})` : ''}
          </Button>
        ) : (
          <Text style={[typography.title, { color: palette.gold, textAlign: 'center' }]}>
            Đã ghi nhận mức {ratingVal ?? scaleMax}/{scaleMax} ★
          </Text>
        )}
      </Card>
    );
  }

  // 5. OPEN TEXT RESPONSE
  return (
    <Card style={styles.interactiveCard}>
      <Badge tone="primary">✍️ Câu hỏi tự luận mở</Badge>
      {!revealed ? (
        <>
          <TextInput
            value={openText}
            onChangeText={setOpenText}
            multiline
            maxLength={500}
            placeholder="Nhập câu trả lời hoặc quan điểm của bạn..."
            placeholderTextColor={palette.inkMuted}
            style={[styles.openTextInput, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
          />
          <Pressable onPress={() => setAnonymous((v) => !v)} style={styles.anonRow}>
            <AppIcon name={anonymous ? 'checkbox' : 'square-outline'} size={18} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.inkMuted }]}>Gửi ẩn danh</Text>
          </Pressable>
          <Button variant="primary" disabled={!openText.trim()} onPress={() => onComplete(true, 0)} fullWidth>
            Nộp câu trả lời mở
          </Button>
        </>
      ) : (
        <View style={[styles.submittedBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
            {anonymous ? 'Học giả ẩn danh' : 'Câu trả lời của bạn'}:
          </Text>
          <Text style={[typography.body, { color: palette.ink, marginTop: 4 }]}>{openText}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  optBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  pollBtn: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pollTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  pollFill: { height: '100%', borderRadius: 4 },
  interactiveCard: { padding: spacing.lg, borderRadius: radii.md, gap: spacing.md },
  wordInputRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  textField: { minHeight: 44, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, fontSize: 14 },
  cloudWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs },
  wordChip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  ratingPill: { minWidth: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  ratingLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  openTextInput: { minHeight: 96, borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, fontSize: 14, textAlignVertical: 'top' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submittedBox: { padding: spacing.md, borderRadius: radii.sm, borderWidth: 1 },
});
