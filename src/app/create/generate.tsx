import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { useI18n } from '@/core/i18n';
import { parseGeneratedQuestions } from '@/features/quiz-generation/domain/parseGeneratedQuestions';
import type { Question } from '@/core/domain/models';
import { spacing, typography } from '@/core/theme/tokens';

export default function GenerateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const manualMode = params.mode === 'manual';
  const { language, t } = useI18n();
  const [title,setTitle]=useState('');
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const palette = usePalette();
  const saveToStore = usePapyrusStore((state) => state.saveQuestionSet);
  const sourceDocument = usePapyrusStore((state) => state.sourceDocument);
  const [questions, setQuestions] = useState<Question[]>(() => manualMode ? [{ id: `manual-${Date.now()}`, content: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', position: 0 }] : []);
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
    if (manualMode) return;
    if (busy) return;
    setMessage('');
    setBusy(true);
    try {
      if (dependencies.generation.configured && sourceDocument) {
        const raw = await dependencies.generation.generate({
          sourceText: sourceDocument.text,
          questionCount: count,
          difficulty: difficulty === 'Easy' ? 'easy' : difficulty === 'Challenge' ? 'hard' : 'medium',
          languageCode: language,
        });
        const parsed = parseGeneratedQuestions(raw);
        if (parsed.length !== count) throw new Error('The AI response did not contain valid questions.');
        setQuestions(parsed);
      } else {
        throw new Error('Add source text and sign in to use AI. You can also write your own questions below.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate questions. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    if (!title.trim() || !subject.trim() || questions.length === 0 || questions.some((question) => !question.content.trim() || question.options.some((option) => !option.trim()) || new Set(question.options.map((option) => option.trim().toLocaleLowerCase())).size !== 4)) {
      setMessage(manualMode ? t.home.saveError : 'Enter a title, subject, and complete all question options before saving.');
      return;
    }
    setMessage('');
    setBusy(true);
    const questionSet = { id: `${manualMode ? 'manual' : 'generated'}-${Date.now()}`, title: title.trim(), subject: subject.trim(), updatedAt: new Date().toISOString(), syncStatus: 'pending' as const, questions };
    try {
      await saveQuestionSet(dependencies.questionSets, questionSet);
      saveToStore(questionSet);
      router.replace('/sets');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return <Screen>
    <TopBar title={manualMode ? t.home.manualTitle : 'Shape your quiz'} />
    <PageHeader eyebrow={manualMode ? t.home.manualEyebrow : 'STEP 2 OF 3 · SHAPE'} title={manualMode ? t.home.manualTitle : 'Make the generation yours'} subtitle={manualMode ? t.home.manualSubtitle : 'Choose the output, review every answer and save only what you trust.'} />
    <Card style={styles.controls}>
      {!manualMode && <Text style={[typography.body,{color:palette.ink}]}>AI sends the text you reviewed to our generation provider. Images stay on this device. Check the answers before saving.</Text>}
      <TextInput testID="set-title" accessibilityLabel="Question set title" placeholder={language === 'vi' ? 'Tên bộ câu hỏi' : 'Question set title'} value={title} onChangeText={setTitle} maxLength={160} style={[styles.questionInput,{color:palette.ink,borderColor:palette.paperMuted}]} />
      <TextInput testID="set-subject" accessibilityLabel={t.home.subjectLabel} placeholder={t.home.subjectPlaceholder} value={subject} onChangeText={setSubject} maxLength={100} style={[styles.questionInput,{color:palette.ink,borderColor:palette.paperMuted}]} />
      {message ? <Text accessibilityRole="alert" style={{color:palette.danger}}>{message}</Text> : null}
      {!manualMode && <><Text style={[typography.title, { color: palette.ink }]}>Question count</Text>
      <View style={styles.choiceRow}>{[5, 10, 15].map((value) => <Button key={value} variant={count === value ? 'primary' : 'secondary'} onPress={() => setCount(value)}>{String(value)}</Button>)}</View>
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Difficulty</Text>
      <View style={styles.choiceRow}>{(['Easy', 'Balanced', 'Challenge'] as const).map((value) => <Button key={value} variant={difficulty === value ? 'primary' : 'secondary'} onPress={() => setDifficulty(value)}>{value}</Button>)}</View>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>{count} questions · {difficulty} · {language === 'vi' ? 'Tiếng Việt' : 'English'} · {questions.length} ready</Text></>}
    </Card>

    <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>{manualMode ? t.home.correctAnswerHint : 'Review before saving'}</Text>
    {questions.length === 0 && <Card><Text style={[typography.body, { color: palette.inkMuted }]}>No questions remain. Generate a new set or go back to your source.</Text></Card>}
    <Button variant="secondary" disabled={busy || questions.length >= 30} onPress={()=>setQuestions(current=>[...current,{id:`manual-${Date.now()}`,content:'',options:['','','',''],correctIndex:0,explanation:'',position:current.length}])}>{t.home.addQuestion}</Button>
    {questions.map((question, index) => <Card key={question.id} style={styles.question}>
      <View style={styles.questionHeader}><Text style={[typography.label, { color: palette.indigo }]}>{t.home.questionLabel.toLocaleUpperCase()} {index + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${t.home.removeQuestion} ${index + 1}`} onPress={() => removeQuestion(question.id)} style={styles.removeButton}><Ionicons name="trash-outline" size={20} color={palette.danger} /></Pressable></View>
      <TextInput testID={`question-${index}-content`} accessibilityLabel={`${t.home.questionLabel} ${index+1}`} placeholder={t.home.questionLabel} value={question.content} onChangeText={(content) => updateQuestion(question.id, (current) => ({ ...current, content }))} multiline textAlignVertical="top" style={[styles.questionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      {question.options.map((option, optionIndex) => <View key={`${question.id}-${optionIndex}`} style={styles.optionRow}>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: question.correctIndex === optionIndex }} accessibilityLabel={`Mark option ${optionIndex + 1} as correct`} onPress={() => updateQuestion(question.id, (current) => ({ ...current, correctIndex: optionIndex }))} style={[styles.answerMark, { backgroundColor: question.correctIndex === optionIndex ? palette.mintTint : palette.paperMuted }]}><Ionicons name={question.correctIndex === optionIndex ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={question.correctIndex === optionIndex ? palette.mint : palette.inkMuted} /></Pressable>
        <TextInput testID={`question-${index}-option-${optionIndex}`} accessibilityLabel={`${t.home.optionLabel} ${optionIndex+1}`} placeholder={`${t.home.optionLabel} ${optionIndex + 1}`} value={option} onChangeText={(nextOption) => updateQuestion(question.id, (current) => ({ ...current, options: current.options.map((value, currentIndex) => currentIndex === optionIndex ? nextOption : value) }))} style={[styles.optionInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
      </View>)}
      <TextInput testID={`question-${index}-explanation`} accessibilityLabel="Explanation" value={question.explanation} onChangeText={(explanation) => updateQuestion(question.id, (current) => ({ ...current, explanation }))} placeholder="Add an explanation" placeholderTextColor={palette.inkMuted} multiline style={[styles.explanationInput, { color: palette.ink, borderColor: palette.paperMuted }]} />
    </Card>)}

    <View style={styles.actions}>{!manualMode && <Button variant="secondary" onPress={() => void generate()} disabled={busy}>{busy ? 'Generating…' : 'Generate from reviewed source'}</Button>}<Button testID="save-question-set" icon="checkmark" onPress={() => void save()} disabled={busy || questions.length === 0}>{busy ? 'Saving…' : manualMode ? t.home.saveSet : 'Save question set'}</Button></View>
  </Screen>;
}

const styles = StyleSheet.create({
  controls: { padding: spacing.xl },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  question: { marginBottom: spacing.md, gap: spacing.sm },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionInput: { minHeight: 62, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 16, lineHeight: 22 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  answerMark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  optionInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 14 },
  explanationInput: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 14 },
  actions: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
