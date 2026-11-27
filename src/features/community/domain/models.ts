export type ReactionKey = 'heart' | 'bulb' | 'fire' | 'clap';

export interface ScholarStory {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorLevel: number;
  text: string;
  subtext?: string;
  gradient: [string, string];
  mediaType?: 'text' | 'image' | 'video';
  imageUri?: string | null;
  videoUri?: string | null;
  thumbnailUri?: string | null;
  durationSec?: number;
  badgeLabel?: string;
  viewedByIds: string[];
  reactions: Record<string, string[]>;
  isHighlight?: boolean;
  pinnedOnProfile?: boolean;
  expiresAt?: string;
  createdAt: string;
}

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Strict 24-hour story status check: returns true ONLY if story is < 24h old.
 */
export function isStoryActive24h(story: ScholarStory, nowMs = Date.now()): boolean {
  if (story.expiresAt) {
    const exp = Date.parse(story.expiresAt);
    if (Number.isFinite(exp)) return exp > nowMs;
  }
  const created = Date.parse(story.createdAt);
  if (!Number.isFinite(created)) return false;
  return nowMs - created < STORY_TTL_MS;
}

export interface GroupedStoryBox {
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  stories: ScholarStory[];
  coverStory: ScholarStory;
}

/**
 * Groups multiple stories of each user into ONE single Story Box (tap left/right inside box to flip).
 */
export function groupStoriesByAuthor(stories: ScholarStory[]): GroupedStoryBox[] {
  const byAuthor = new Map<string, ScholarStory[]>();
  for (const st of stories) {
    const bucket = byAuthor.get(st.authorId);
    if (bucket) bucket.push(st);
    else byAuthor.set(st.authorId, [st]);
  }
  const groups: GroupedStoryBox[] = [];
  for (const [authorId, list] of byAuthor.entries()) {
    // Chronological order (oldest -> newest) inside box so tapping right flips forward naturally;
    // cover preview displays the latest story posted in the box!
    const chronological = [...list]
      .reverse()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const latest = chronological[chronological.length - 1]!;
    groups.push({
      authorId,
      authorName: latest.authorName,
      authorAvatar: latest.authorAvatar,
      stories: chronological,
      coverStory: latest,
    });
  }
  return groups.sort(
    (a, b) => Date.parse(b.coverStory.createdAt) - Date.parse(a.coverStory.createdAt)
  );
}

export interface ThreadComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  likes: number;
  createdAt: string;
}

export interface ThreadPollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface ThreadPost {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string | null;
  authorLevel: number;
  authorRoleBadge?: string;
  threadParts: string[];
  templateBadge?: string;
  imageUri?: string | null;
  codeSnippet?: string;
  attachedQuiz?: {
    setId: string;
    title: string;
    questionCount: number;
    subject: string;
  };
  poll?: {
    question: string;
    options: ThreadPollOption[];
  };
  sourceCitation?: {
    title: string;
    url: string;
    sourceName: string;
  };
  tags: string[];
  reactions: Record<ReactionKey, string[]>;
  repostedByIds: string[];
  bookmarkedByIds: string[];
  comments: ThreadComment[];
  createdAt: string;
}

export interface StudyGroupChannel {
  id: string;
  name: string;
  subtitle: string;
  topic: string;
  icon: string;
  accentColor: string;
  isDirect?: boolean;
  peerUserId?: string;
  memberCount: number;
  pinnedMessageId?: string | null;
}

export interface GroupChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  replyTo?: {
    id: string;
    senderName: string;
    preview: string;
  };
  imageUri?: string | null;
  quizCard?: {
    setId: string;
    title: string;
    questionCount: number;
  };
  poll?: {
    question: string;
    options: Array<{ id: string; text: string; voterIds: string[] }>;
  };
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface DailyKnowledgeArticle {
  id: string;
  source:
    | 'Google News'
    | 'Wikipedia VI'
    | 'Wikipedia EN'
    | 'Dev.to Tech'
    | 'Hacker News'
    | 'OpenAlex Khoa Học'
    | 'Papyrus Học Thuật';
  category: string;
  title: string;
  summary: string;
  url: string;
  thumbnailUrl?: string | null;
  publishedLabel: string;
  publishedAtMs?: number;
}

export interface ViralThreadTemplate {
  id: string;
  badge: string;
  title: string;
  triggerLabel: string;
  defaultTag: string;
  parts: string[];
}

export const VIRAL_THREAD_TEMPLATES: ViralThreadTemplate[] = [
  {
    id: 'explain-60s',
    badge: '🔥 Giải ngố 60s',
    title: 'Giải thích 1 khái niệm khó trong 60 giây',
    triggerLabel: 'Curiosity Gap',
    defaultTag: 'CNTT',
    parts: [
      '90% sinh viên học thuộc lòng khái niệm [Tên Khái Niệm], nhưng chỉ 10% hiểu bản chất cốt lõi của nó trong 60 giây 👇',
      '1/ Bản chất thực sự:\n• Ví dụ thực tế: ...\n• Cơ chế hoạt động: Đầu vào → Xử lý → Đầu ra.',
      '2/ Mẹo nhớ nhanh trong phòng thi (TL;DR): Chốt lại 1 câu khóa này là ăn trọn điểm! Lưu bài lại nhé 🔖',
    ],
  },
  {
    id: 'chapter-tldr',
    badge: '📚 Tóm tắt Giáo trình',
    title: 'Cô đọng 1 chương sách dài thành 3 ý vàng',
    triggerLabel: 'High Bookmark Value',
    defaultTag: 'ÔnThi',
    parts: [
      'Mình vừa đọc xong chương [Tên Chương] để bạn chỉ mất đúng 2 phút nắm trọn chuỗi Thread tóm tắt này 📌',
      '1/ Ba trụ cột quan trọng nhất:\n• Ý cốt lõi #1: ...\n• Ý cốt lõi #2: ...\n• Ý cốt lõi #3: ...',
      '2/ Bấm vào bộ Quiz đính kèm bên dưới để luyện phản xạ nhớ lâu ngay lập tức!',
    ],
  },
  {
    id: 'mistakes-90',
    badge: '⚠️ Bẫy mất điểm',
    title: '3 Sai lầm khiến 90% sinh viên mất điểm oan',
    triggerLabel: 'Negative Constraint',
    defaultTag: 'KinhNghiệm',
    parts: [
      'Đừng bước vào phòng thi môn [Tên Môn] nếu bạn vẫn mắc 3 cái bẫy kinh điển gây mất điểm oan này ⚠️',
      '1/ Nhầm lẫn giữa [Khái niệm A] và [Khái niệm B].\n2/ Quên xét điều kiện biên / độ phức tạp.',
      'Cách khắc phục: Luyện Active Recall 15 phút/ngày. Bạn từng dính bẫy số mấy? 👇',
    ],
  },
  {
    id: 'vs-comparison',
    badge: '⚔️ So sánh Đối đầu',
    title: 'Đặt lên bàn cân 2 Công nghệ / Học thuyết',
    triggerLabel: 'Contrarian Debate',
    defaultTag: 'CNTT',
    parts: [
      'Đặt lên bàn cân: [Phương pháp A] vs [Phương pháp B] — Đâu mới là lựa chọn tối ưu? ⚖️',
      '1/ Khi nào chọn [A]? Tốc độ cao, gọn nhẹ.\n2/ Khi nào bắt buộc dùng [B]? Chịu tải lớn & nhất quán.',
      'Kết luận: Chọn đúng công cụ cho đúng bài toán. Team A hay Team B điểm danh nào!',
    ],
  },
  {
    id: 'roadmap-aplus',
    badge: '🗺️ Lộ trình Điểm A+',
    title: 'Lộ trình cày từ mất gốc lên A+ trong 14 ngày',
    triggerLabel: 'Step-by-Step System',
    defaultTag: 'ÔnThi',
    parts: [
      'Cách mình hệ thống hóa toàn bộ môn [Tên Môn] để đạt điểm A+ với lộ trình 3 chặng rõ ràng 🚀',
      '• Chặng 1 (Ngày 1–4): Nắm khung lý thuyết qua Papybot.\n• Chặng 2 (Ngày 5–10): Quét OCR slide & bắn Cung Thủ 3D.\n• Chặng 3 (Ngày 11–14): Luyện Đấu Trường Sinh Tồn & 1v1 ELO.',
      'Đều đặn 1 phiên Pomodoro 25 phút mỗi ngày là chìa khóa! 🔖',
    ],
  },
  {
    id: 'formula-cheatsheet',
    badge: '🧮 Sổ tay Công thức',
    title: 'Cheat-Sheet Công thức & Định lý bất bại',
    triggerLabel: 'Instant Save Trigger',
    defaultTag: 'ToánLýHóa',
    parts: [
      'Tổng hợp trọn bộ công thức & định lý bắt buộc thuộc lòng của phần [Chủ đề] — Gọn trên 1 màn hình! 📐',
      '• Công thức #1: ...\n• Hệ quả giải nhanh 10 giây: ...\n• Lưu ý đơn vị chuẩn SI: ...',
      'Bấm 🔖 Lưu bài viết để mở ra ôn nhanh trước giờ kiểm tra!',
    ],
  },
  {
    id: 'critical-quiz',
    badge: '🧩 Đố vui Phản biện',
    title: 'Câu hỏi tư duy 70% trả lời vội sẽ nhầm',
    triggerLabel: 'Interactive Hook',
    defaultTag: 'TưDuy',
    parts: [
      'Thử thách tư duy 10 giây: Hơn 70% người trả lời vội câu hỏi này đều chọn nhầm đáp án! 🧠',
      'Đề bài: [Nhập câu đố học thuật thú vị tại đây]...\nChọn đáp án ở Poll bên dưới trước khi đọc lời giải nhé!',
      'Giải mã: Điểm mấu chốt nằm ở [...]. Ai chọn đúng ngay lần đầu thả 🔥 nào!',
    ],
  },
  {
    id: 'book-paper-review',
    badge: '📖 Review Tài liệu',
    title: '3 Bài học đắt giá từ Giáo trình / Bài báo khoa học',
    triggerLabel: 'Authority Builder',
    defaultTag: 'VănSử',
    parts: [
      '3 góc nhìn thay đổi hoàn toàn tư duy của mình sau khi đọc xong tài liệu "[Tên Tài Liệu]" 📖',
      '1/ Luận điểm đột phá: ...\n2/ Dẫn chứng thực nghiệm / lịch sử: ...\n3/ Ứng dụng thực tế: ...',
      'Đánh giá cá nhân: 9.5/10 ⭐. Tuần này bạn đang đọc tài liệu nào hay?',
    ],
  },
  {
    id: 'study-log',
    badge: '🔥 Nhật ký #StudyWithMe',
    title: 'Nhật ký giữ chuỗi kỷ luật học tập mỗi ngày',
    triggerLabel: 'Accountability',
    defaultTag: 'StudyWithMe',
    parts: [
      'Ngày thứ [X] liên tiếp giữ chuỗi học tập trên Papyrus! Hôm nay mình đã hoàn thành: 🔥',
      '✅ Ôn tập xong chuyên đề: ...\n✅ Ghi nhớ sâu 20 thuật ngữ mới.\n🎯 Mục tiêu ngày mai: Phá kỷ lục điểm Đấu trường!',
      'Ai đang cùng cày bài tối nay thả ❤️ tiếp lửa cho nhau nhé!',
    ],
  },
  {
    id: 'sos-exam-qa',
    badge: '🆘 Hỏi đáp Cấp tốc',
    title: 'Nhờ cộng đồng gỡ rối câu hỏi hóc búa',
    triggerLabel: 'Fast Replies',
    defaultTag: 'HỏiĐáp',
    parts: [
      '🆘 Nhờ các cao nhân môn [Tên Môn] gỡ rối giúp mình bài toán hóc búa này với!',
      '• Đề bài / Ngữ cảnh: ...\n• Hướng mình đã thử nhưng chưa ra: ...',
      'Mọi người gợi ý giúp mình bước biến đổi tiếp theo dưới bình luận nhé, cảm ơn rất nhiều! 👏',
    ],
  },
];

export const STORY_GRADIENTS: Array<{ id: string; label: string; colors: [string, string] }> = [
  { id: 'royal', label: 'Hoàng gia', colors: ['#312E81', '#7C3AED'] },
  { id: 'aurora', label: 'Cực quang', colors: ['#065F46', '#0284C7'] },
  { id: 'phoenix', label: 'Phượng hoàng', colors: ['#9A3412', '#E11D48'] },
  { id: 'cosmos', label: 'Tinh vân', colors: ['#0F172A', '#4F46E5'] },
  { id: 'amber', label: 'Hổ phách', colors: ['#78350F', '#D97706'] },
];

export const DEFAULT_STUDY_GROUPS: StudyGroupChannel[] = [
  {
    id: 'grp-it-algo',
    name: 'Hội CNTT & Thuật Toán',
    subtitle: 'Cấu trúc dữ liệu, OOP, Hệ điều hành, Mạng & AI',
    topic: 'CNTT',
    icon: 'code-slash',
    accentColor: '#6366F1',
    memberCount: 0,
    pinnedMessageId: null,
  },
  {
    id: 'grp-stem-lab',
    name: 'Khoa Học Tự Nhiên (Lý · Hóa · Sinh)',
    subtitle: 'Bài tập đại cương, Cơ lượng tử & Di truyền học',
    topic: 'KHTN',
    icon: 'flask',
    accentColor: '#10B981',
    memberCount: 0,
    pinnedMessageId: null,
  },
  {
    id: 'grp-hist-lit',
    name: 'Sử Học & Văn Chương',
    subtitle: 'Lịch sử Việt Nam, Thế giới & Văn học',
    topic: 'Sử - Văn',
    icon: 'book',
    accentColor: '#F59E0B',
    memberCount: 0,
    pinnedMessageId: null,
  },
  {
    id: 'grp-arena-lobby',
    name: 'Sảnh Đấu Trực Tuyến',
    subtitle: 'Chia sẻ mã PIN phòng đấu & hẹn kèo 1v1 ELO',
    topic: 'Thi Đấu',
    icon: 'flash',
    accentColor: '#EC4899',
    memberCount: 0,
    pinnedMessageId: null,
  },
];
