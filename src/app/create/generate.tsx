import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/app/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { isGenerationConfigured, requestGeneratedQuestions } from '@/features/quiz-generation/data/edgeFunctionClient';
import { parseGeneratedQuestions } from '@/features/quiz-generation/domain/parseGeneratedQuestions';
import type { Question } from '@/core/domain/models';
import { spacing, typography } from '@/core/theme/tokens';

const generated: Question[] = [
  { id: 'generated-1', content: 'What is the most important reason to keep OCR on-device?', options: ['Protect source material privacy', 'Remove all question review', 'Force online study', 'Expose provider secrets'], correctIndex: 0, explanation: 'On-device OCR keeps original images local and lets the learner confirm text before generation.', position: 0 },
  { id: 'generated-2', content: 'Which layer should call a Supabase data source?', options: ['Data adapter', 'Visual component', 'Typography token', 'Navigation label'], correctIndex: 0, explanation: 'Infrastructure belongs behind a data adapter so the domain and UI remain testable.', position: 1 },
  { id: 'generated-3', content: 'What makes a realtime battle fair?', options: ['Server-authoritative time and scoring', 'Client-only timers', 'Hidden offline scores', 'Unlimited duplicate answers'], correctIndex: 0, explanation: 'The server owns question windows, duplicate rejection and awarded points.', position: 2 },
];

export default function GenerateScreen() {
  const router = useRouter();
  const palette = usePalette();
  const saveToStore = usePapyrusStore((state) => state.saveQuestionSet);
  const sourceDocument = usePapyrusStore((state) => state.sourceDocument);
  const [questions, setQuestions] = useState<Question[]>(generated);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Balanced' | 'Challenge'>('Balanced');
  const [busy, setBusy] = useState(false);

  const updateQuestion = (questionId: string, update: (question: Question) => Question) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  };

  const removeQuestion = (questionId: string) => {
    setQuestions((current) => current.filter((question) => question.id !== questionId).map((question, position) => ({ ...question, position })));
  };

  const generate = async () => {
    setBusy(true);
    try {
      if (isGenerationConfigured && sourceDocument) {
        const raw = await requestGeneratedQuestions({
          sourceText: sourceDocument.text,
          questionCount: count,
          difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
          languageCode: 'en',
        });
        const parsed = parseGeneratedQuestions(raw);
        if (parsed.length === 0) throw new Error('The AI response did not contain valid questions.');
        setQuestions(parsed);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
        Alert.alert('Preview mode', 'Supabase AI is not configured in this environment, so the deterministic sample remains active.');
      }
    } catch (error) {
      Alert.alert('Could not generate questions', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const questionSet = { id: `generated-${Date.now()}`, title: sourceDocument?.title ?? 'My generated study set', subject: 'From scanned material', updatedAt: new Date().toISOString(), syncStatus: 'pending' as const, questions };
    try {
      await saveQuestionSet(dependencies.questionSets, questionSet);
      saveToStore(questionSet);
      Alert.alert('Saved locally', 'Your question set is ready for offline study.', [{ text: 'Open library', onPress: () => router.replace('/sets') }]);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <Screen>
    <TopBar title="Shape your quiz" />
    <PageHeader eyebrow="STEP 2 OF 3 · SHAPE" title="Make the generation yours" subtitle="Choose the output, review every answer and save only what you trust." />
    <Card style={styles.controls}>
      <Text style={[typography.title, { color: palette.ink }]}>Question count</Text>
      <View style={styles.choiceRow}>{[5, 10, 15].map((value) => <Button key={value} variant={count === value ? 'primary' : 'secondary'} onPress={() => setCount(value)}>{String(value)}</Button>)}</View>
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Difficulty</Text>
      <View style={styles.choiceRow}>{(['Easy', 'Balanced', 'Challenge'] as const).map((value) => <Button key={value} variant={difficulty === value ? 'primary' : 'secondary'} onPress={() => setDifficulty(value)}>{value}</Button>)}</View>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>{count} questions · {difficulty} · English · {questions.length} ready</Text>
    </Card>

    <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>Review before saving</Text>
    {questions.length === 0 && <Card><Text style={[typography.body, { color: palette.inkMuted }]}>No questions remain. Generate a new set or go back to your source.</Text></Card>}
    {questions.map((question, index) => <Card key={question.id} style={styles.question}>
      <View style={styles.questionHeader}><Text style={[typography.label, { color: palette.indigo }]}>QUESTION {index + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} onPress={() => removeQuestion(question.id)}><Ionicons name="trash-outline" size={20} color={palette.danger} /></Pressable></View>
      <TextInput value={question.content} onChangeText={(content) => updateQuestion(question.id, (current) => ({ ...current, content }))} multiline textAlignVertical="top" style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      {question.options.map((option, optionIndex) => <View key={`${question.id}-${optionIndex}`} style={styles.optionRow}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: question.correctIndex === optionIndex }} accessibilityLabel={`Mark option ${optionIndex + 1} as correct`} onPress={() => updateQuestion(question.id, (current) => ({ ...current, correctIndex: optionIndex }))} style={[styles.answerMark, { backgroundColor: question.correctIndex === optionIndex ? palette.mintTint : palette.paperMuted }]}><Ionicons name={question.correctIndex === optionIndex ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={question.correctIndex === optionIndex ? palette.mint : palette.inkMuted} /></Pressable>
        <TextInput value={option} onChangeText={(nextOption) => updateQuestion(question.id, (current) => ({ ...current, options: current.options.map((value, currentIndex) => currentIndex === optionIndex ? nextOption : value) }))} style={[styles.optionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      </View>)}
      <TextInput value={question.explanation} onChangeText={(explanation) => updateQuestion(question.id, (current) => ({ ...current, explanation }))} placeholder="Add an explanation" placeholderTextColor={palette.inkMuted} multiline style={[styles.explanationInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
    </Card>)}

    <View style={styles.actions}><Button variant="secondary" onPress={() => void generate()} disabled={busy}>{busy ? 'Generating…' : isGenerationConfigured ? 'Generate from source' : 'Regenerate preview'}</Button><Button icon="checkmark" onPress={() => void save()} disabled={busy || questions.length === 0}>{busy ? 'Saving…' : 'Save question set'}</Button></View>
  </Screen>;
}

const styles = StyleSheet.create({
  controls: { padding: spacing.xl },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  question: { marginBottom: spacing.md, gap: spacing.sm },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionInput: { minHeight: 62, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 16, lineHeight: 22 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  answerMark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 14 },
  explanationInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 14 },
  actions: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
