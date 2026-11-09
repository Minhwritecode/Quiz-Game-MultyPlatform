import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import type { Attempt } from '@/core/domain/models';
import { dependencies } from '@/app/composition/dependencies';
import { spacing, typography } from '@/core/theme/tokens';

export default function StudyResultScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const palette = usePalette();
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    let active = true;
    void dependencies.study.getLatestAttempt(setId ?? '').then((value) => {
      if (active) setAttempt(value);
    });
    return () => { active = false; };
  }, [setId]);

  if (!attempt) return <Screen><TopBar title="Study result" /><Card style={styles.empty}><Text style={[typography.title, { color: palette.ink }]}>No saved result yet.</Text><Button variant="secondary" onPress={() => router.replace('/sets')}>Back to library</Button></Card></Screen>;

  const accuracy = attempt.total === 0 ? 0 : Math.round((attempt.correctCount / attempt.total) * 100);
  return <Screen><TopBar title="Study result" action={<Badge tone="success">SAVED OFFLINE</Badge>} /><Card color={palette.indigoTint} style={styles.hero}><Text style={[typography.label, { color: palette.indigo }]}>SESSION COMPLETE</Text><Text style={[typography.display, { color: palette.indigo, marginTop: spacing.sm }]}>{accuracy}%</Text><Text style={[typography.body, { color: palette.indigoDeep, marginTop: spacing.sm }]}>{attempt.correctCount} of {attempt.total} answers correct</Text></Card><Card style={styles.summary}><View><Text style={[typography.caption, { color: palette.inkMuted }]}>Score</Text><Text style={[typography.heading, { color: palette.ink }]}>{attempt.score}</Text></View><View><Text style={[typography.caption, { color: palette.inkMuted }]}>Answers stored</Text><Text style={[typography.heading, { color: palette.ink }]}>{attempt.answers.length}</Text></View><View><Text style={[typography.caption, { color: palette.inkMuted }]}>Mode</Text><Text style={[typography.heading, { color: palette.ink }]}>Offline</Text></View></Card><Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl }]}>What happens next?</Text><Text style={[typography.body, { color: palette.inkMuted, marginTop: spacing.sm }]}>This result is persisted locally and can be queued for cloud sync when the account and sync slice are enabled.</Text><View style={styles.actions}><Button onPress={() => router.replace('/sets')}>Back to library</Button><Button variant="secondary" onPress={() => router.replace({ pathname: '/study/[setId]', params: { setId } })}>Study again</Button></View></Screen>;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl },
  hero: { alignItems: 'center', paddingVertical: spacing.xxxl },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
