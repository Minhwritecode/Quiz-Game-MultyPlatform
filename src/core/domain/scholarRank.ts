export const XP_PER_SCHOLAR_LEVEL = 500;

export interface ScholarRankInfo {
  level: number;
  titleVi: string;
  titleEn: string;
  badge: string;
  color: string;
  currentLevelXp: number;
  xpForNextLevel: number;
  xpRemaining: number;
  progress: number;
  tierDescriptionVi: string;
}

const RANK_BANDS: Array<{
  minLevel: number;
  titleVi: string;
  titleEn: string;
  badge: string;
  color: string;
  descVi: string;
}> = [
  {
    minLevel: 25,
    titleVi: 'Huyền Thoại Papyrus',
    titleEn: 'Papyrus Legend',
    badge: '🌟',
    color: '#F59E0B',
    descVi: 'Đỉnh cao tri thức — Làm chủ học thuật đa lĩnh vực và thống lĩnh Đấu trường 3D.',
  },
  {
    minLevel: 15,
    titleVi: 'Đại Học Sĩ Hoàng Gia',
    titleEn: 'Royal Grand Scholar',
    badge: '👑',
    color: '#EC4899',
    descVi: 'Học giả uyên bác tích lũy trên 7.000 XP qua ôn tập chuyên sâu và thi đấu.',
  },
  {
    minLevel: 10,
    titleVi: 'Pháp Sư Hàn Lâm',
    titleEn: 'Arcane Academician',
    badge: '🔮',
    color: '#8B5CF6',
    descVi: 'Thành thạo hệ thống câu hỏi Đại học và chuỗi phản xạ tốc độ cao.',
  },
  {
    minLevel: 6,
    titleVi: 'Hiệp Sĩ Tri Thức',
    titleEn: 'Knowledge Knight',
    badge: '⚔️',
    color: '#06B6D4',
    descVi: 'Vững vàng kiến thức nền tảng, thường xuyên chiến thắng trên Đấu trường.',
  },
  {
    minLevel: 3,
    titleVi: 'Học Giả Tinh Thông',
    titleEn: 'Adept Scholar',
    badge: '📜',
    color: '#10B981',
    descVi: 'Đã hình thành thói quen chủ động gợi nhớ (Active Recall) mỗi ngày.',
  },
  {
    minLevel: 1,
    titleVi: 'Tân Học Giả',
    titleEn: 'Initiate Scholar',
    badge: '🌱',
    color: '#6366F1',
    descVi: 'Khởi đầu hành trình chinh phục tri thức — mỗi 500 XP giúp bạn tăng 1 Cấp!',
  },
];

/**
 * Transparent, deterministic Scholar Level & Rank formula:
 * - Every 500 XP = +1 Scholar Level (starts at Level 1 with 0 XP).
 * - Earned from: Daily Check-In (+50 XP), Study/Arena matches (+score XP), Daily Brain Teaser (+25 XP), Community Academic Post (+30 XP).
 */
export function getScholarRankInfo(totalScore: number): ScholarRankInfo {
  const safeScore = Math.max(0, Math.floor(totalScore || 0));
  const level = Math.floor(safeScore / XP_PER_SCHOLAR_LEVEL) + 1;
  const currentLevelXp = safeScore % XP_PER_SCHOLAR_LEVEL;
  const xpRemaining = XP_PER_SCHOLAR_LEVEL - currentLevelXp;
  const progress = currentLevelXp / XP_PER_SCHOLAR_LEVEL;

  const band = RANK_BANDS.find((b) => level >= b.minLevel) ?? RANK_BANDS[RANK_BANDS.length - 1]!;

  return {
    level,
    titleVi: band.titleVi,
    titleEn: band.titleEn,
    badge: band.badge,
    color: band.color,
    currentLevelXp,
    xpForNextLevel: XP_PER_SCHOLAR_LEVEL,
    xpRemaining,
    progress,
    tierDescriptionVi: band.descVi,
  };
}
