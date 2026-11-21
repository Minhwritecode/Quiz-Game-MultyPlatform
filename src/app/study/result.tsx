import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Screen, StatCard, TopBar, usePalette } from '@/shared/ui';
import type { Attempt } from '@/core/domain/models';
import { dependencies } from '@/composition/dependencies';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import {
  buildStudySessionReport,
  formatMsSeconds,
  formatStudyReportSummary,
} from '@/features/study/domain/sessionReport';

export default function StudyResultScreen() {
  const { setId, attemptId } = useLocalSearchParams<{ setId: string; attemptId?: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const request = attemptId ? dependencies.study.getAttempt(attemptId) : dependencies.study.getLatestAttempt(setId ?? '');
    setLoadError('');
    void request.then((value: Attempt | null) => {
      if (active) {
        setAttempt(value);
        if(value)void dependencies.release.recordStudyCompletion(value.id).catch(()=>undefined);
      }
    }).catch(() => { if (active) setLoadError(language === 'vi' ? 'Không đọc được kết quả đã lưu.' : 'Could not load the saved result.'); });
    return () => {
      active = false;
    };
  }, [setId, attemptId, language]);

  if (!attempt) {
    return (
      <Screen>
        <TopBar title={t.result.title} />
        <Card style={styles.empty}>
          <Text style={[typography.title, { color: palette.ink }]}>{loadError || t.result.emptyTitle}</Text>
          <Button variant="secondary" onPress={() => router.replace('/sets')}>
            {t.study.backToLibrary}
          </Button>
        </Card>
      </Screen>
    );
  }

  const accuracy = attempt.total === 0 ? 0 : Math.round((attempt.correctCount / attempt.total) * 100);
  const isMastered = accuracy >= 80;
  const setTitle = usePapyrusStore.getState().questionSets.find((s) => s.id === (setId ?? attempt.questionSetId))?.title ?? 'Phiên ôn tập Papyrus';
  const sessionReport = buildStudySessionReport(attempt, setTitle);

  const handleShareReport = async () => {
    const summary = formatStudyReportSummary(sessionReport);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([summary], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `papyrus-report-${attempt.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ title: 'Báo cáo phiên học Papyrus', message: summary }).catch(() => undefined);
  };

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

      {/* Session Performance Report Card */}
      <Card style={styles.actionCard}>
        <Text style={[typography.title, { color: palette.ink, marginBottom: spacing.xs }]}>
          📊 {language === 'vi' ? 'Phân tích tốc độ & hiệu suất' : 'Session Performance Report'}
        </Text>
        <View style={styles.reportMetricsRow}>
          <View style={[styles.reportPill, { backgroundColor: palette.paper }]}>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>Tốc độ TB</Text>
            <Text style={[typography.title, { color: palette.indigo, fontSize: 16 }]}>
              {formatMsSeconds(sessionReport.avgTimeMs)}
            </Text>
          </View>
          <View style={[styles.reportPill, { backgroundColor: palette.paper }]}>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>Nhanh nhất</Text>
            <Text style={[typography.title, { color: palette.mint, fontSize: 16 }]}>
              {formatMsSeconds(sessionReport.fastestCorrectMs)}
            </Text>
          </View>
          <View style={[styles.reportPill, { backgroundColor: palette.paper }]}>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>Hoàn thành</Text>
            <Text style={[typography.title, { color: palette.gold, fontSize: 16 }]}>
              {sessionReport.participationPercent}%
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Button icon="share-outline" variant="secondary" onPress={() => void handleShareReport()} fullWidth>
            {language === 'vi' ? 'Xuất & Chia sẻ báo cáo phiên học' : 'Export & Share Session Report'}
          </Button>
        </View>
      </Card>

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
          <Button variant="ghost" icon="time-outline" onPress={() => router.push('/study/history')}>{t.study.historyTitle}</Button>
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
  reportMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  reportPill: {
    flex: 1,
    minWidth: 90,
    padding: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
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
