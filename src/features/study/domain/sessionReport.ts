import type { Attempt } from '@/core/domain/models';

export interface SessionAnalyticsReport {
  title: string;
  generatedAt: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number;
  participationPercent: number;
  totalScore: number;
  avgTimeMs: number;
  fastestCorrectMs: number | null;
  slowestAnswerMs: number | null;
}

export function buildStudySessionReport(attempt: Attempt, title: string): SessionAnalyticsReport {
  const answers = attempt.answers ?? [];
  const totalQuestions = Math.max(attempt.total, answers.length);
  const answeredCount = answers.filter((a) => a.chosenIndex !== null).length;
  const correctCount = attempt.correctCount;
  const accuracyPercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const participationPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const times = answers.map((a) => a.timeMs).filter((t) => Number.isFinite(t) && t >= 0);
  const elapsedMs = Math.max(0, Date.parse(attempt.finishedAt) - Date.parse(attempt.startedAt));
  const avgTimeMs =
    times.length > 0
      ? Math.round(times.reduce((sum, t) => sum + t, 0) / times.length)
      : totalQuestions > 0 && Number.isFinite(elapsedMs)
      ? Math.round(elapsedMs / totalQuestions)
      : 0;

  const correctTimes = answers.filter((a) => a.isCorrect && a.timeMs >= 0).map((a) => a.timeMs);
  const fastestCorrectMs = correctTimes.length > 0 ? Math.min(...correctTimes) : null;
  const slowestAnswerMs = times.length > 0 ? Math.max(...times) : null;

  return {
    title,
    generatedAt: new Date().toISOString(),
    totalQuestions,
    answeredCount,
    correctCount,
    accuracyPercent,
    participationPercent,
    totalScore: attempt.score,
    avgTimeMs,
    fastestCorrectMs,
    slowestAnswerMs,
  };
}

export function formatMsSeconds(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatStudyReportSummary(report: SessionAnalyticsReport): string {
  return [
    `📊 BÁO CÁO PHIÊN HỌC PAPYRUS`,
    `Bộ đề: ${report.title}`,
    `• Độ chính xác: ${report.accuracyPercent}% (${report.correctCount}/${report.totalQuestions} câu đúng)`,
    `• Điểm XP nhận được: +${report.totalScore}`,
    `• Tốc độ trung bình: ${formatMsSeconds(report.avgTimeMs)} / câu`,
    `• Câu đúng nhanh nhất: ${formatMsSeconds(report.fastestCorrectMs)}`,
    `• Tỷ lệ hoàn thành: ${report.participationPercent}%`,
  ].join('\n');
}

export function buildLeaderboardCsv(
  roomCode: string,
  players: Array<{ nickname: string; score: number }>
): string {
  const header = '"Rank","Player","Score","RoomCode"';
  const rows = players.map(
    (p, idx) => `"${idx + 1}","${p.nickname.replace(/"/g, '""')}","${p.score}","${roomCode}"`
  );
  return [header, ...rows].join('\n');
}
