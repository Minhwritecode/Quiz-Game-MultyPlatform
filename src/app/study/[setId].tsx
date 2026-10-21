import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { spacing, typography } from '@/core/theme/tokens';

export default function StudyScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const palette = usePalette();
  const questionSet = usePapyrusStore((state) => state.questionSets.find((item) => item.id === setId));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const question = useMemo(() => questionSet?.questions[index], [index, questionSet]);
  if (!questionSet || !question) return <Screen><TopBar title="Study mode" /><Card style={styles.empty}><Ionicons name="book-outline" size={36} color={palette.indigo} /><Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>This set has no questions yet.</Text><Button onPress={() => router.back()} variant="secondary">Go back</Button></Card></Screen>;
  const next = () => { if (!revealed) { setRevealed(true); return; } if (index >= questionSet.questions.length - 1) { router.back(); return; } setIndex((value) => value + 1); setSelected(null); setRevealed(false); };
  return <Screen><TopBar title="Study mode" action={<Badge tone="success">OFFLINE</Badge>} /><View style={styles.progressMeta}><Text style={[typography.caption, { color: palette.inkMuted }]}>Question {index + 1} of {questionSet.questions.length}</Text><Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{Math.round(((index + 1) / questionSet.questions.length) * 100)}%</Text></View><View style={[styles.progressTrack, { backgroundColor: palette.paperMuted }]}><View style={[styles.progressFill, { backgroundColor: palette.indigo, width: `${((index + 1) / questionSet.questions.length) * 100}%` }]} /></View><Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xl }]}>{question.content}</Text><View style={{ marginTop: spacing.xl }}>{question.options.map((option, optionIndex) => { const chosen = selected === optionIndex; const correct = revealed && optionIndex === question.correctIndex; const wrong = revealed && chosen && !correct; return <Pressable key={option} disabled={revealed} onPress={() => setSelected(optionIndex)} style={[styles.option, { backgroundColor: correct ? palette.mintTint : wrong ? palette.dangerTint : chosen ? palette.indigoTint : palette.paperRaised, borderColor: correct ? palette.mint : wrong ? palette.danger : chosen ? palette.indigo : palette.paperMuted }]}><View style={[styles.letter, { backgroundColor: correct ? palette.mint : wrong ? palette.danger : chosen ? palette.indigo : palette.paperMuted }]}><Text style={{ color: correct || wrong || chosen ? palette.white : palette.inkMuted, fontWeight: '800' }}>{String.fromCharCode(65 + optionIndex)}</Text></View><Text style={[typography.body, { color: palette.ink, flex: 1 }]}>{option}</Text>{correct && <Ionicons name="checkmark-circle" size={22} color={palette.mint} />}</Pressable>; })}</View>{revealed && <Card color={selected === question.correctIndex ? palette.mintTint : palette.dangerTint} style={styles.explanation}><Ionicons name={selected === question.correctIndex ? 'checkmark-circle' : 'information-circle'} size={22} color={selected === question.correctIndex ? palette.mint : palette.danger} /><Text style={[typography.body, { color: selected === question.correctIndex ? palette.mint : palette.danger, flex: 1 }]}>{question.explanation}</Text></Card>}<Button disabled={selected === null} onPress={next} icon={revealed ? (index === questionSet.questions.length - 1 ? 'checkmark' : 'arrow-forward') : 'checkmark-circle'}>{revealed ? (index === questionSet.questions.length - 1 ? 'Finish session' : 'Next question') : 'Check answer'}</Button></Screen>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: spacing.sm },
  progressFill: { height: '100%', borderRadius: 4 },
  option: { minHeight: 64, borderWidth: 1, borderRadius: 16, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  letter: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  explanation: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginVertical: spacing.lg },
});
