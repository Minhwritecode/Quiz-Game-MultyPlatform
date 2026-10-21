import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, PageHeader, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { saveQuestionSetOffline } from '@/features/question-sets/data/persistence';
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
  const saveQuestionSet = usePapyrusStore((state) => state.saveQuestionSet);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Balanced' | 'Challenge'>('Balanced');
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    setBusy(false);
  };
  const save = () => {
    const questionSet = { id: `generated-${Date.now()}`, title: 'My generated study set', subject: 'From scanned material', updatedAt: new Date().toISOString(), syncStatus: 'pending' as const, questions: generated };
    saveQuestionSet(questionSet);
    saveQuestionSetOffline(questionSet);
    Alert.alert('Saved locally', 'Your question set is ready for offline study.', [{ text: 'Open library', onPress: () => router.replace('/sets') }]);
  };
  return <Screen><TopBar title="Shape your quiz" /><PageHeader eyebrow="STEP 2 OF 3 · SHAPE" title="Make the generation yours" subtitle="Choose the output before the protected generation request begins." /><Card style={styles.controls}><Text style={[typography.title, { color: palette.ink }]}>Question count</Text><View style={styles.choiceRow}>{[5, 10, 15].map((value) => <Button key={value} variant={count === value ? 'primary' : 'secondary'} onPress={() => setCount(value)}>{String(value)}</Button>)}</View><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>Difficulty</Text><View style={styles.choiceRow}>{(['Easy', 'Balanced', 'Challenge'] as const).map((value) => <Button key={value} variant={difficulty === value ? 'primary' : 'secondary'} onPress={() => setDifficulty(value)}>{value}</Button>)}</View><Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.lg }]}>{count} questions · {difficulty} · English</Text></Card><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.md }]}>Review preview</Text>{generated.slice(0, 2).map((question, index) => <Card key={question.id} style={styles.question}><Text style={[typography.label, { color: palette.indigo }]}>QUESTION {index + 1}</Text><Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>{question.content}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>{question.options.join('  ·  ')}</Text></Card>)}<View style={styles.actions}><Button variant="secondary" onPress={generate} disabled={busy}>{busy ? 'Generating…' : 'Regenerate preview'}</Button><Button icon="checkmark" onPress={save}>Save question set</Button></View></Screen>;
}

const styles = StyleSheet.create({
  controls: { padding: spacing.xl },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  question: { marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
});
