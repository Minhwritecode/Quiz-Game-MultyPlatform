import { Platform, Share } from 'react-native';
import { formatMsSeconds, type SessionAnalyticsReport } from './sessionReport';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPrintableReportHtml(params: {
  heading: string;
  subtitle: string;
  kpis: Array<{ label: string; value: string }>;
  rows: Array<{ col1: string; col2: string; col3: string }>;
  headers: [string, string, string];
}): string {
  const kpiCards = params.kpis
    .map(
      (k) =>
        `<div class="kpi"><div class="kpi-label">${escapeHtml(k.label)}</div><div class="kpi-val">${escapeHtml(k.value)}</div></div>`
    )
    .join('');

  const tableRows = params.rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.col1)}</td><td>${escapeHtml(r.col2)}</td><td style="text-align:right;font-weight:700">${escapeHtml(r.col3)}</td></tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.heading)} — Papyrus Report</title>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { margin: 0; padding: 32px; color: #0F172A; background: #FFFFFF; }
  .banner { background: linear-gradient(135deg, #4F46E5, #6366F1); color: #FFF; padding: 24px 28px; border-radius: 16px; margin-bottom: 24px; }
  .eyebrow { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85; font-weight: 700; }
  h1 { margin: 6px 0 4px; font-size: 24px; }
  .sub { font-size: 13px; opacity: 0.9; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; background: #F8FAFC; }
  .kpi-label { font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; }
  .kpi-val { font-size: 20px; font-weight: 800; color: #4F46E5; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
  th { background: #F1F5F9; text-align: left; padding: 10px 14px; font-size: 12px; color: #475569; text-transform: uppercase; }
  td { padding: 10px 14px; border-top: 1px solid #E2E8F0; font-size: 14px; }
  .footer { margin-top: 28px; font-size: 12px; color: #64748B; text-align: center; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="banner">
    <div class="eyebrow">PAPYRUS QUEST ARENA · SESSION REPORT</div>
    <h1>${escapeHtml(params.heading)}</h1>
    <div class="sub">${escapeHtml(params.subtitle)} · Xuất lúc ${new Date().toLocaleString('vi-VN')}</div>
  </div>
  <div class="kpis">${kpiCards}</div>
  <table>
    <thead><tr><th>${escapeHtml(params.headers[0])}</th><th>${escapeHtml(params.headers[1])}</th><th style="text-align:right">${escapeHtml(params.headers[2])}</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Tạo tự động bởi nền tảng trắc nghiệm thông minh Papyrus</div>
</body>
</html>`;
}

export async function exportPrintablePdfReport(html: string, fallbackText: string, title: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const popup = window.open('', '_blank', 'width=900,height=720');
    if (popup) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 250);
      return;
    }
  }
  await Share.share({ title, message: fallbackText }).catch(() => undefined);
}

export async function exportStudyPdfReport(report: SessionAnalyticsReport): Promise<void> {
  const html = buildPrintableReportHtml({
    heading: report.title,
    subtitle: 'Báo cáo hiệu suất phiên ôn tập cá nhân',
    kpis: [
      { label: 'Độ chính xác', value: `${report.accuracyPercent}%` },
      { label: 'Điểm XP', value: `+${report.totalScore}` },
      { label: 'Tốc độ TB', value: formatMsSeconds(report.avgTimeMs) },
      { label: 'Nhanh nhất', value: formatMsSeconds(report.fastestCorrectMs) },
    ],
    headers: ['Chỉ số', 'Chi tiết', 'Giá trị'],
    rows: [
      { col1: 'Tổng số câu', col2: 'Số câu hỏi trong phiên', col3: String(report.totalQuestions) },
      { col1: 'Trả lời đúng', col2: 'Số câu chính xác', col3: `${report.correctCount}/${report.totalQuestions}` },
      { col1: 'Tỷ lệ hoàn thành', col2: 'Tỷ lệ câu đã nộp đáp án', col3: `${report.participationPercent}%` },
      { col1: 'Câu chậm nhất', col2: 'Thời gian suy nghĩ lâu nhất', col3: formatMsSeconds(report.slowestAnswerMs) },
    ],
  });
  const text = `📊 ${report.title}\nChính xác: ${report.accuracyPercent}% (${report.correctCount}/${report.totalQuestions})\nXP: +${report.totalScore} · Tốc độ TB: ${formatMsSeconds(report.avgTimeMs)}`;
  await exportPrintablePdfReport(html, text, `Papyrus Report - ${report.title}`);
}

export async function exportBattlePdfReport(
  roomCode: string,
  players: Array<{ nickname: string; score: number }>
): Promise<void> {
  const topScore = players[0]?.score ?? 0;
  const avgScore =
    players.length > 0 ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0;

  const html = buildPrintableReportHtml({
    heading: `Báo cáo Phòng đấu #${roomCode}`,
    subtitle: `Tổng kết bảng vàng (${players.length} người tham gia)`,
    kpis: [
      { label: 'Mã phòng', value: roomCode },
      { label: 'Người chơi', value: String(players.length) },
      { label: 'Điểm cao nhất', value: topScore.toLocaleString('vi-VN') },
      { label: 'Điểm trung bình', value: avgScore.toLocaleString('vi-VN') },
    ],
    headers: ['Hạng', 'Người chơi', 'Tổng điểm'],
    rows: players.map((p, idx) => ({
      col1: `#${idx + 1}`,
      col2: p.nickname,
      col3: `${p.score.toLocaleString('vi-VN')} đ`,
    })),
  });
  const text = `🏆 Báo cáo phòng #${roomCode}\n` + players.map((p, i) => `#${i + 1} ${p.nickname}: ${p.score}đ`).join('\n');
  await exportPrintablePdfReport(html, text, `Papyrus Battle Report #${roomCode}`);
}
