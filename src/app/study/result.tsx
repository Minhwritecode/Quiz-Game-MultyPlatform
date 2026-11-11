import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Screen, StatCard, TopBar, usePalette } from '@/shared/ui';
import type { Attempt } from '@/core/domain/models';
import { dependencies } from '@/composition/dependencies';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';

export default function StudyResultScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    let active = true;
    void dependencies.study.getLatestAttempt(setId ?? '').then((value: Attempt | null) => {
      if (active) setAttempt(value);
    });
    return () => {
      active = false;
    };
  }, [setId]);

  if (!attempt) {
    return (
      <Screen>
        <TopBar title={t.result.title} />
        <Card style={styles.empty}>
          <Text style={[typography.title, { color: palette.ink }]}>{t.result.emptyTitle}</Text>
          <Button variant="secondary" onPress={() => router.replace('/sets')}>
            {t.study.backToLibrary}
          </Button>
        </Card>
      </Screen>
    );
  }

  const accuracy = attempt.total === 0 ? 0 : Math.round((attempt.correctCount / attempt.total) * 100);
  const isMastered = accuracy >= 80;

  return (
    <Screen>
      <TopBar title={t.result.title} action={<Badge tone="success">{t.result.savedOffline}</Badge>} />

      {/* Hero Result Card */}
      <Card color={isMastered ? palette.indigo : palette.paperRaised} style={styles.heroCard}>
        <Badge tone={isMastered ? 'reward' : 'neutral'}>
          {isMastered ? t.result.masteredBadge : t.result.needsWorkBadge}
        </Badge>
        <Text
          style={[
            typography.display,
            { color: isMastered ? palette.white : palette.indigo, fontSize: 56, lineHeight: 64, marginTop: spacing.md },
          ]}
        >
          {accuracy}%
        </Text>
        <Text
          style={[
            typography.title,
            { color: isMastered ? '#E0E7FF' : palette.ink, marginTop: spacing.xs },
          ]}
        >
          {language === 'vi'
            ? `Bạn trả lời đúng ${attempt.correctCount} / ${attempt.total} câu hỏi!`
            : `You answered ${attempt.correctCount} / ${attempt.total} questions correctly!`}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: isMastered ? '#C7D2FE' : palette.inkMuted, marginTop: 4 },
          ]}
        >
          {isMastered ? t.result.masteredDesc : t.result.needsWorkDesc}
        </Text>
      </Card>

      {/* Stats Breakdown */}
      <View style={styles.statsRow}>
        <StatCard
          value={`+${attempt.score}`}
          label={t.result.xpEarned}
          icon="flash"
          tone="reward"
        />
        <StatCard
          value={`${attempt.correctCount}/${attempt.total}`}
          label={t.result.correctCountLabel}
          icon="checkmark-circle"
          tone="success"
        />
      </View>

      {/* Next Actions */}
      <Card style={styles.actionCard}>
        <Text style={[typography.title, { color: palette.ink }]}>{t.result.whatNext}</Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
          {t.result.offlineSyncNote}
        </Text>
        <View style={styles.actionButtons}>
          <Button
            icon="refresh"
            variant="primary"
            onPress={() => router.replace({ pathname: '/study/[setId]', params: { setId: setId ?? '' } })}
          >
            {t.result.studyAgain}
          </Button>
          <Button
            icon="game-controller"
            variant="secondary"
            onPress={() => router.push('/battle')}
          >
            {t.result.challengeBattle}
          </Button>
          <Button
            variant="ghost"
            onPress={() => router.replace('/sets')}
          >
            {t.result.backToSets}
          </Button>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  heroCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginBottom: spacing.xxl,
  },
  actionButtons: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
