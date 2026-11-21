import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAiQuizStore } from '@/features/ai-quiz/state/useAiQuizStore';
import type { QuizDifficulty } from '@/features/ai-quiz/domain/models';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useQuizStore } from '@/features/quiz-library/state/useQuizStore';

export default function AiQuizScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { generatedQuiz, isLoading, generateFromTopic, generateFromPdf, clearCurrentQuiz } = useAiQuizStore();
  const saveQuestionSet = usePapyrusStore((state) => state.saveQuestionSet);
  const saveToLibrary = useQuizStore((state) => state.addQuiz);

  const [mode, setMode] = useState<'topic' | 'pdf'>('topic');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('easy');
  const [questionCount, setQuestionCount] = useState(5);
  const [includeCodeSnippet, setIncludeCodeSnippet] = useState(false);
  const [pdfFile, setPdfFile] = useState<{ uri: string; name: string; size?: number } | null>(null);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset) {
          setPdfFile({
            uri: asset.uri,
            name: asset.name,
            size: asset.size,
          });
        }
      }
    } catch {
      Alert.alert('Thông báo', 'Không thể đọc file PDF đã chọn.');
    }
  };

  const handleGenerate = async () => {
    if (mode === 'topic') {
      if (!topic.trim()) {
        Alert.alert('Chưa nhập chủ đề', 'Vui lòng nhập chủ đề bạn muốn AI tạo quiz.');
        return;
      }
      try {
        await generateFromTopic(topic.trim(), difficulty, questionCount, includeCodeSnippet);
      } catch {
        Alert.alert('Lỗi', 'Không thể tạo quiz lúc này. Vui lòng thử lại.');
      }
    } else {
      if (!pdfFile) {
        Alert.alert('Chưa chọn PDF', 'Vui lòng chọn một file PDF tài liệu.');
        return;
      }
      try {
        await generateFromPdf(pdfFile.uri, pdfFile.name, difficulty, questionCount);
      } catch {
        Alert.alert('Lỗi', 'Không thể tạo quiz từ PDF. Vui lòng thử lại.');
      }
    }
  };

  const handleSaveToPapyrus = () => {
    if (!generatedQuiz) return;
    const newSet = {
      id: generatedQuiz.id,
      title: generatedQuiz.title,
      subject: generatedQuiz.title,
      questions: generatedQuiz.questions.map((q, idx) => ({
        id: `q-${idx}-${Date.now()}`,
        content: q.question,
        options: q.options,
        correctIndex: q.correctAnswer,
        explanation: 'Câu hỏi được sinh bởi AI Quiz Generator.',
        position: idx,
        ...(q.codeSnippet ? { codeSnippet: q.codeSnippet } : {}),
      })),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced' as const,
    };
    saveQuestionSet(newSet);
    saveToLibrary({
      id: generatedQuiz.id,
      title: generatedQuiz.title,
      description: generatedQuiz.description,
      difficulty: generatedQuiz.difficulty,
      source: 'ai',
      questions: generatedQuiz.questions,
      createdAt: generatedQuiz.createdAt,
    });
    Alert.alert('Thành công', 'Đã lưu quiz vào bộ câu hỏi Papyrus & Thư viện Quiz!', [
      { text: 'Chơi ngay', onPress: () => router.push('/games/survival') },
      { text: 'Đóng', style: 'cancel' },
    ]);
  };

  const handleStartLive = () => {
    if (!generatedQuiz) return;
    saveToLibrary({
      id: generatedQuiz.id,
      title: generatedQuiz.title,
      description: generatedQuiz.description,
      difficulty: generatedQuiz.difficulty,
      source: 'ai',
      questions: generatedQuiz.questions,
      createdAt: generatedQuiz.createdAt,
    });
    router.push({
      pathname: '/multiplayer/host/[roomCode]',
      params: { roomCode: Math.random().toString(36).substring(2, 8).toUpperCase(), quizId: generatedQuiz.id },
    });
  };

  return (
    <Screen scroll={false}>
      <TopBar title="AI Quiz Generator" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!generatedQuiz ? (
          <>
            <View style={styles.headerBox}>
              <View style={[styles.sparkIconWrap, { backgroundColor: palette.indigo }]}>
                <Ionicons name="sparkles" size={28} color={palette.white} />
              </View>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.sm }]}>
                Tạo Quiz tự động với AI
              </Text>
              <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                Nhập chủ đề bất kỳ hoặc tải lên tài liệu PDF để AI sinh câu hỏi trong vài giây.
              </Text>
            </View>

            {/* Mode Switch Tabs */}
            <View style={[styles.tabsWrap, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
              <Pressable
                onPress={() => setMode('topic')}
                style={[styles.tabBtn, mode === 'topic' && { backgroundColor: palette.indigo }]}
              >
                <Ionicons
                  name="bulb-outline"
                  size={18}
                  color={mode === 'topic' ? palette.white : palette.inkMuted}
                />
                <Text style={[styles.tabText, { color: mode === 'topic' ? palette.white : palette.inkMuted }]}>
                  Theo Chủ đề
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode('pdf')}
                style={[styles.tabBtn, mode === 'pdf' && { backgroundColor: palette.indigo }]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={mode === 'pdf' ? palette.white : palette.inkMuted}
                />
                <Text style={[styles.tabText, { color: mode === 'pdf' ? palette.white : palette.inkMuted }]}>
                  Tài liệu PDF
                </Text>
              </Pressable>
            </View>

            <Card style={styles.formCard}>
              {mode === 'topic' ? (
                <View style={styles.inputGroup}>
                  <Text style={[typography.title, { color: palette.ink }]}>Chủ đề muốn học</Text>
                  <TextInput
                    value={topic}
                    onChangeText={setTopic}
                    placeholder="VD: Lịch sử Việt Nam thế kỷ 20, Trí tuệ nhân tạo..."
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
                  />
                  <Pressable
                    onPress={() => setIncludeCodeSnippet((v) => !v)}
                    style={[
                      styles.codeOptionPill,
                      {
                        borderColor: includeCodeSnippet ? palette.indigo : palette.paperMuted,
                        backgroundColor: includeCodeSnippet ? palette.indigoTint : palette.paperRaised,
                      },
                    ]}
                  >
                    <Ionicons
                      name={includeCodeSnippet ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={includeCodeSnippet ? palette.indigo : palette.inkMuted}
                    />
                    <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                      💻 Kèm đoạn code minh hoạ (phù hợp chủ đề lập trình / CNTT)
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <Text style={[typography.title, { color: palette.ink }]}>Tài liệu PDF (tối đa 20MB)</Text>
                  <Pressable
                    onPress={handlePickDocument}
                    style={[styles.dropZone, { borderColor: palette.indigo, backgroundColor: palette.paperRaised }]}
                  >
                    <Ionicons name="cloud-upload-outline" size={42} color={palette.indigo} />
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={[typography.title, { color: palette.ink, marginTop: spacing.sm, maxWidth: '90%', textAlign: 'center' }]}
                    >
                      {pdfFile ? pdfFile.name : 'Nhấn để chọn file PDF'}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      {pdfFile ? `${((pdfFile.size || 0) / 1024).toFixed(1)} KB` : 'Slide bài giảng, tài liệu ôn tập, đề cương...'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Difficulty selection */}
              <View style={styles.inputGroup}>
                <Text style={[typography.title, { color: palette.ink }]}>Độ khó</Text>
                <View style={styles.choiceRow}>
                  {(['easy', 'medium', 'hard'] as QuizDifficulty[]).map((d) => {
                    const active = difficulty === d;
                    const labels = { easy: 'Dễ 🟢', medium: 'Trung bình 🟡', hard: 'Khó 🔴' };
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setDifficulty(d)}
                        style={[
                          styles.choiceChip,
                          { borderColor: active ? palette.indigo : palette.paperMuted },
                          active && { backgroundColor: palette.indigo },
                        ]}
                      >
                        <Text style={[styles.choiceChipText, { color: active ? palette.white : palette.ink }]}>
                          {labels[d]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Number of questions */}
              <View style={styles.inputGroup}>
                <Text style={[typography.title, { color: palette.ink }]}>Số lượng câu hỏi: {questionCount}</Text>
                <View style={styles.choiceRow}>
                  {[3, 5, 10, 15].map((cnt) => (
                    <Pressable
                      key={cnt}
                      onPress={() => setQuestionCount(cnt)}
                      style={[
                        styles.choiceChip,
                        { borderColor: questionCount === cnt ? palette.indigo : palette.paperMuted },
                        questionCount === cnt && { backgroundColor: palette.indigo },
                      ]}
                    >
                      <Text style={[styles.choiceChipText, { color: questionCount === cnt ? palette.white : palette.ink }]}>
                        {cnt} câu
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.submitBtn}>
                <Button
                  variant="reward"
                  icon="sparkles"
                  onPress={handleGenerate}
                  disabled={isLoading}
                >
                  {isLoading ? 'Đang tạo câu hỏi với AI...' : 'Tạo Quiz ngay'}
                </Button>
              </View>
              {isLoading && (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={palette.indigo} />
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
                    AI đang trích xuất và thiết kế bộ câu hỏi trắc nghiệm...
                  </Text>
                </View>
              )}
            </Card>
          </>
        ) : (
          /* RESULT VIEW */
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={[styles.trophyIcon, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ fontSize: 32 }}>✨</Text>
              </View>
              <Text style={[typography.heading, { color: palette.ink, textAlign: 'center', marginTop: spacing.sm }]}>
                Tạo Quiz thành công!
              </Text>
            </View>

            <View style={[styles.quizOverview, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 20 }]}>
                {generatedQuiz.title}
              </Text>
              <Text style={[typography.body, { color: palette.inkMuted, marginTop: 4 }]}>
                {generatedQuiz.description}
              </Text>
              <View style={styles.badgeRow}>
                <Badge tone="success">{generatedQuiz.questions.length} câu hỏi</Badge>
                <Badge tone="reward">{generatedQuiz.difficulty.toUpperCase()}</Badge>
                <Badge tone="primary">AI Generated</Badge>
              </View>
            </View>

            <Text style={[typography.title, { color: palette.ink, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Xem trước câu hỏi ({generatedQuiz.questions.length})
            </Text>

            {generatedQuiz.questions.map((q, idx) => (
              <View key={idx} style={[styles.previewItem, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
                <Text style={[typography.title, { color: palette.indigo }]}>
                  Câu {idx + 1}: {q.question}
                </Text>
                {q.codeSnippet ? (
                  <View style={styles.previewCodeBlock}>
                    <Text style={styles.previewCodeText}>{q.codeSnippet}</Text>
                  </View>
                ) : null}
                <View style={styles.optionsList}>
                  {q.options.map((opt, oIdx) => (
                    <Text
                      key={oIdx}
                      style={[
                        typography.caption,
                        {
                          color: oIdx === q.correctAnswer ? '#10B981' : palette.inkMuted,
                          fontWeight: oIdx === q.correctAnswer ? '700' : '400',
                          marginTop: 4,
                        },
                      ]}
                    >
                      {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === q.correctAnswer ? '✓ (Đáp án đúng)' : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.resultActions}>
              <Button icon="play" variant="reward" onPress={handleStartLive}>
                🚀 Bắt đầu Live Room
              </Button>
              <Button icon="bookmark-outline" variant="secondary" onPress={handleSaveToPapyrus}>
                💾 Lưu vào Thư viện & Chơi
              </Button>
              <Button icon="refresh-outline" variant="ghost" onPress={clearCurrentQuiz}>
                🔄 Tạo thêm quiz khác
              </Button>
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 60 },
  headerBox: { alignItems: 'center', marginBottom: spacing.lg },
  sparkIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  tabsWrap: { flexDirection: 'row', borderRadius: radii.pill, borderWidth: 1, padding: 4, marginBottom: spacing.lg },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radii.pill },
  tabText: { fontWeight: '700', fontSize: 14 },
  formCard: { padding: spacing.xl, borderRadius: radii.lg },
  inputGroup: { marginBottom: spacing.lg },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, marginTop: spacing.xs, fontSize: 15 },
  dropZone: { borderWidth: 2, borderStyle: 'dashed', borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  choiceChip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, minWidth: 72, alignItems: 'center' },
  choiceChipText: { fontWeight: '700', fontSize: 14 },
  submitBtn: { marginTop: spacing.md },
  loadingBox: { alignItems: 'center', marginTop: spacing.lg },
  resultCard: { padding: spacing.xl, borderRadius: radii.lg },
  resultHeader: { alignItems: 'center', marginBottom: spacing.md },
  trophyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  quizOverview: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginTop: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' },
  previewItem: { padding: spacing.md, borderRadius: radii.md, borderWidth: 1, marginBottom: spacing.sm },
  codeOptionPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, marginTop: spacing.sm },
  previewCodeBlock: { backgroundColor: '#0F172A', borderRadius: 8, padding: spacing.sm, marginTop: spacing.xs },
  previewCodeText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 18, color: '#E2E8F0' },
  optionsList: { marginTop: spacing.xs },
  resultActions: { gap: spacing.sm, marginTop: spacing.xl },
});
