import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useQuizStore } from '@/features/quiz-library/state/useQuizStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import type { QuizQuestion } from '@/features/quiz-library/domain/models';

export default function CreateQuizScreen() {
  const router = useRouter();
  const palette = usePalette();
  const createQuiz = useQuizStore((state) => state.createQuiz);
  const saveQuestionSet = usePapyrusStore((state) => state.saveQuestionSet);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
    },
  ]);
  const [openCodeMap, setOpenCodeMap] = useState<Record<number, boolean>>({});

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question: '',
        options: ['', '', '', ''],
        correctAnswer: 0,
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      Alert.alert('Lưu ý', 'Bộ quiz phải có ít nhất 1 câu hỏi.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (text: string, qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, question: text } : q))
    );
  };

  const handleCodeSnippetChange = (text: string, qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, codeSnippet: text || undefined } : q))
    );
  };

  const handleOptionChange = (text: string, qIndex: number, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[optIndex] = text;
        return { ...q, options: newOptions };
      })
    );
  };

  const handleSelectCorrect = (qIndex: number, optIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correctAnswer: optIndex } : q))
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề cho bộ Quiz.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q || !q.question.trim()) {
        Alert.alert('Chưa hoàn thành', `Câu hỏi ${i + 1} chưa có nội dung câu hỏi.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j]?.trim()) {
          Alert.alert('Chưa hoàn thành', `Câu hỏi ${i + 1} thiếu đáp án lựa chọn ${String.fromCharCode(65 + j)}.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const newQuiz = await createQuiz({
        title: title.trim(),
        description: description.trim(),
        difficulty,
        createdBy: 'Bạn',
        questions,
      });

      // Synchronize into Papyrus QuestionSet for offline games (survival, match)
      saveQuestionSet({
        id: newQuiz.id,
        title: newQuiz.title,
        subject: newQuiz.title,
        questions: newQuiz.questions.map((q, idx) => ({
          id: `manual-q-${idx}-${Date.now()}`,
          content: q.question,
          options: q.options,
          correctIndex: q.correctAnswer,
          explanation: 'Câu hỏi soạn thủ công bởi người dùng.',
          position: idx,
          ...(q.codeSnippet?.trim() ? { codeSnippet: q.codeSnippet.trim() } : {}),
        })),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      });

      Alert.alert('Thành công', 'Đã lưu và xuất bản bộ Quiz!', [
        { text: 'Xem Thư viện', onPress: () => router.replace('/quiz-library') },
      ]);
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo quiz lúc này. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen scroll={false}>
      <TopBar title="Soạn Quiz thủ công" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Section 1: Quiz Details */}
        <Card style={styles.card}>
          <Text style={[typography.title, { color: palette.ink, fontSize: 18 }]}>
            Thông tin cơ bản
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2, marginBottom: spacing.md }]}>
            Điền tiêu đề, mô tả và chọn cấp độ thử thách cho quiz.
          </Text>

          <View style={styles.inputWrap}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
              Tiêu đề Quiz *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="VD: Kiểm tra Toán giải tích 1, Lịch sử nghệ thuật..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
              Mô tả ngắn
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Mô tả nội dung hoặc lưu ý dành cho người chơi..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', marginBottom: 4 }]}>
              Độ khó
            </Text>
            <View style={styles.diffRow}>
              {(['easy', 'medium', 'hard'] as const).map((d) => {
                const active = difficulty === d;
                const labels = { easy: 'Dễ 🟢', medium: 'Vừa 🟡', hard: 'Khó 🔴' };
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[
                      styles.diffChip,
                      { borderColor: active ? palette.indigo : palette.paperMuted },
                      active && { backgroundColor: palette.indigo },
                    ]}
                  >
                    <Text style={[styles.diffText, { color: active ? palette.white : palette.ink }]}>
                      {labels[d]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        {/* Section 2: Questions Builder */}
        {questions.map((q, qIndex) => (
          <Card key={qIndex} style={styles.questionCard}>
            <View style={styles.qHeader}>
              <Text style={[typography.title, { color: palette.indigo, fontSize: 16 }]}>
                Câu hỏi {qIndex + 1}
              </Text>
              {questions.length > 1 && (
                <Pressable
                  onPress={() => handleRemoveQuestion(qIndex)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>Xóa câu</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              value={q.question}
              onChangeText={(text) => handleQuestionTextChange(text, qIndex)}
              placeholder={`Nhập nội dung câu hỏi ${qIndex + 1}...`}
              placeholderTextColor={palette.inkMuted}
              multiline
              style={[styles.textArea, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />

            <Pressable
              onPress={() => setOpenCodeMap((prev) => ({ ...prev, [qIndex]: !(prev[qIndex] ?? Boolean(q.codeSnippet)) }))}
              style={[styles.codeToggle, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
            >
              <Ionicons name="code-slash-outline" size={16} color={palette.indigo} />
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                {(openCodeMap[qIndex] ?? Boolean(q.codeSnippet))
                  ? 'Ẩn đoạn code minh hoạ'
                  : 'Thêm đoạn code minh hoạ (tuỳ chọn)'}
              </Text>
            </Pressable>

            {(openCodeMap[qIndex] ?? Boolean(q.codeSnippet)) && (
              <TextInput
                value={q.codeSnippet ?? ''}
                onChangeText={(text) => handleCodeSnippetChange(text, qIndex)}
                placeholder="// Ví dụ: function solve(n) { return n * 2; }"
                placeholderTextColor="#64748B"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.codeArea}
              />
            )}

            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', marginTop: spacing.md, marginBottom: 4 }]}>
              Các lựa chọn (chọn nút tròn để đánh dấu đáp án đúng):
            </Text>

            {[0, 1, 2, 3].map((optIndex) => {
              const isCorrect = q.correctAnswer === optIndex;
              return (
                <View key={optIndex} style={styles.optionRow}>
                  <Pressable
                    onPress={() => handleSelectCorrect(qIndex, optIndex)}
                    style={[
                      styles.radioBtn,
                      { borderColor: isCorrect ? '#10B981' : palette.paperMuted },
                      isCorrect && { backgroundColor: '#10B981' },
                    ]}
                  >
                    <Text style={{ color: isCorrect ? '#FFFFFF' : palette.inkMuted, fontWeight: '800', fontSize: 12 }}>
                      {String.fromCharCode(65 + optIndex)}
                    </Text>
                  </Pressable>

                  <TextInput
                    value={q.options[optIndex]}
                    onChangeText={(text) => handleOptionChange(text, qIndex, optIndex)}
                    placeholder={`Đáp án ${String.fromCharCode(65 + optIndex)}`}
                    placeholderTextColor={palette.inkMuted}
                    style={[
                      styles.optionInput,
                      {
                        color: palette.ink,
                        borderColor: isCorrect ? '#10B981' : palette.paperMuted,
                        backgroundColor: palette.paperRaised,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </Card>
        ))}

        {/* Buttons */}
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            icon="add-circle-outline"
            onPress={handleAddQuestion}
          >
            + Thêm câu hỏi
          </Button>

          <Button
            variant="reward"
            icon="checkmark-circle-outline"
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang xuất bản...' : 'Xuất bản Quiz'}
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingBottom: 60,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  questionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  inputWrap: {
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginTop: 4,
    fontSize: 14,
  },
  diffRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  diffChip: {
    flex: 1,
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  diffText: {
    fontWeight: '700',
    fontSize: 13,
  },
  qHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  textArea: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  codeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  codeArea: {
    minHeight: 84,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: '#0F172A',
    color: '#E2E8F0',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  radioBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
