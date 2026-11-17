import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Attempt, StudyProgress } from '@/core/domain/models';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { Badge, Button, Card, Screen, SectionHeading, StatCard, TopBar, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';

export default function StudyHistoryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const sets = usePapyrusStore((state) => state.questionSets);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [drafts, setDrafts] = useState<StudyProgress[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([dependencies.study.listAttempts(), dependencies.study.listProgress()])
      .then(([savedAttempts, savedDrafts]) => {
        if (!active) return;
        setAttempts(savedAttempts);
        setDrafts(savedDrafts);
      })
      .catch(() => { if (active) setError(t.study.progressUnavailable); });
    return () => { active = false; };
  }, [t.study.progressUnavailable]);

  const totalAnswered = attempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const totalCorrect = attempts.reduce((sum, attempt) => sum + attempt.correctCount, 0);
  const accuracy = totalAnswered ? `${Math.round(totalCorrect / totalAnswered * 100)}%` : '—';

  return <Screen bottomNav>
    <TopBar title={t.study.historyTitle} onBack={() => router.back()} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.lg }}>
      <StatCard value={String(attempts.length)} label={t.study.historySessions} icon="time-outline" tone="primary" />
      <StatCard value={String(totalAnswered)} label={t.study.historyQuestions} icon="help-circle-outline" tone="success" />
      <StatCard value={accuracy} label={t.study.historyAccuracy} icon="analytics-outline" tone="reward" />
    </View>

    {error ? <Text accessibilityRole="alert" style={[typography.body, { color: palette.danger }]}>{error}</Text> : null}

    {drafts.length > 0 && <>
      <SectionHeading title={t.study.resumeStudy} />
      {drafts.map((draft) => {
        const set = sets.find((item) => item.id === draft.questionSetId);
        if (!set) return null;
        return <Card key={draft.questionSetId}>
          <Text style={[typography.title, { color: palette.ink }]}>{set.title}</Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>{draft.currentIndex + 1} / {set.questions.length} · {new Date(draft.updatedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</Text>
          <View style={{ marginTop: spacing.md }}><Button icon="play" onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })}>{t.study.resumeStudy}</Button></View>
        </Card>;
      })}
    </>}

    <SectionHeading title={t.study.historyTitle} />
    {attempts.length === 0 ? <Card><Text style={[typography.body, { color: palette.inkMuted }]}>{t.study.historyEmpty}</Text></Card> : attempts.map((attempt) => {
      const set = sets.find((item) => item.id === attempt.questionSetId);
      const percent = attempt.total ? Math.round(attempt.correctCount / attempt.total * 100) : 0;
      return <Card key={attempt.id} onPress={() => router.push({ pathname: '/study/result', params: { setId: attempt.questionSetId, attemptId: attempt.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title, { color: palette.ink }]} numberOfLines={1}>{set?.title ?? (language === 'vi' ? 'Bộ câu hỏi đã xóa' : 'Deleted question set')}</Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>{new Date(attempt.finishedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} · {attempt.correctCount}/{attempt.total}</Text>
        </View>
        <Badge tone={percent >= 80 ? 'success' : 'reward'}>{percent}%</Badge>
      </Card>;
    })}
  </Screen>;
}
