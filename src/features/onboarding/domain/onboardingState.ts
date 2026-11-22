export interface OnboardingRepository {
  hasSeenIntro(userId: string): Promise<boolean>;
  markIntroSeen(userId: string): Promise<void>;
  resetIntroSeen(userId: string): Promise<void>;
}

export interface OnboardingActSlide {
  id: 'painpoint' | 'solution' | 'payoff';
  stepLabel: string;
  badgeVi: string;
  badgeEn: string;
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  accent: string;
  highlightsVi: string[];
  highlightsEn: string[];
}

export const ONBOARDING_STORAGE_PREFIX = 'papyrus:onboarding:illusion-intro:v1:';
export const ONBOARDING_VIDEO_DURATION_SEC = 9.5;

export function onboardingStorageKey(userId: string): string {
  const clean = userId.trim();
  return `${ONBOARDING_STORAGE_PREFIX}${clean || 'guest'}`;
}

export function shouldAutoShowOnboarding(params: {
  userId: string | null | undefined;
  hasSeen: boolean;
  isTestEnv?: boolean;
}): boolean {
  if (params.isTestEnv) return false;
  if (!params.userId || !params.userId.trim()) return false;
  return !params.hasSeen;
}

export function resolveOnboardingActIndex(currentTimeSec: number): 0 | 1 | 2 {
  if (currentTimeSec >= 6.8) return 2;
  if (currentTimeSec >= 3.0) return 1;
  return 0;
}

export const ONBOARDING_ACT_SLIDES: readonly OnboardingActSlide[] = [
  {
    id: 'painpoint',
    stepLabel: '01',
    badgeVi: 'VẤN ĐỀ THƯỜNG GẶP',
    badgeEn: 'THE PAIN POINT',
    titleVi: 'Học cả trăm trang… nhưng vẫn quên sạch trước giờ thi?',
    titleEn: 'Read hundreds of pages… yet blank out on exam day?',
    bodyVi:
      'Đọc thụ động PDF, slide dày đặc và ghi chú rời rạc khiến não nhanh quá tải và rơi vào đường cong quên lãng chỉ sau 24 giờ.',
    bodyEn:
      'Passive reading across dense PDFs, slides, and scattered notes overloads memory and fades rapidly before exam time.',
    accent: '#FB7185',
    highlightsVi: ['Quá tải PDF & slide dài', 'Khó lọc trọng tâm để ôn gấp', 'Đọc nhiều nhưng nhớ rất ít'],
    highlightsEn: ['Dense PDFs & long decks', 'Hard to extract key concepts', 'Passive reading fades fast'],
  },
  {
    id: 'solution',
    stepLabel: '02',
    badgeVi: 'GIẢI PHÁP TỪ PAPYRUS AI',
    badgeEn: 'WHY PAPYRUS AI',
    titleVi: '3 bước biến mọi tài liệu thành vũ khí ôn thi',
    titleEn: '3 steps from raw notes to high-retention mastery',
    bodyVi:
      'Một cú chạm đảo chiều cách học: chuyển thẳng tài liệu thô thành câu hỏi chủ động, gia sư RAG và đấu trường game hóa.',
    bodyEn:
      'Flip passive reading into active recall with instant AI quiz generation, grounded RAG tutoring, and live game arenas.',
    accent: '#7C3AED',
    highlightsVi: [
      'Scan / PDF → Quiz AI trong vài giây',
      'Gia sư Papybot RAG bám sát nguồn gốc',
      'Battle 1v1 & Đấu trường Sinh tồn',
    ],
    highlightsEn: [
      'Scan / PDF → Instant AI Quizzes',
      'Grounded Papybot RAG Tutor',
      'Live 1v1 Battle & Survival Arena',
    ],
  },
  {
    id: 'payoff',
    stepLabel: '03',
    badgeVi: 'SẴN SÀNG BỨT PHÁ',
    badgeEn: 'READY TO LEVEL UP',
    titleVi: 'From Ancient Scroll to AI Power.',
    titleEn: 'From Ancient Scroll to AI Power.',
    bodyVi:
      'Học ít hơn nhưng nhớ lâu hơn — mọi bộ đề, tiến độ và lịch sử ôn tập của bạn đều đồng bộ xuyên suốt Web & Mobile.',
    bodyEn:
      'Study smarter and retain more — your sets, mastery stats, and battles sync seamlessly across Web & Mobile.',
    accent: '#F6C358',
    highlightsVi: ['Học ít hơn · Nhớ lâu hơn', 'Đồng bộ đa thiết bị Cloud & Offline', 'Sẵn sàng chinh phục mục tiêu ngay'],
    highlightsEn: ['Study less · Retain longer', 'Cloud + Offline cross-device sync', 'Start your first smart session'],
  },
] as const;
