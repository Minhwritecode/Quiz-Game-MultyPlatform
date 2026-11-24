import { seedQuestionSets } from '@/core/data/seed';
import type { ChatMessage } from '../domain/repository';

const STOP_WORDS = new Set([
  'là', 'gì', 'của', 'và', 'các', 'trong', 'có', 'được', 'cho', 'với', 'một', 'những',
  'khi', 'nào', 'như', 'thế', 'hãy', 'giải', 'thích', 'tôi', 'bạn', 'giúp', 'về', 'tại',
  'sao', 'theo', 'này', 'đó', 'the', 'what', 'how', 'why', 'is', 'are', 'of', 'in', 'to', 'for', 'and',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function summarizeDocument(doc: string): string {
  const sentences = doc
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
  const top = sentences.slice(0, 6);
  if (top.length === 0) {
    return `Tài liệu có nội dung ngắn:\n• ${doc.trim().slice(0, 400)}`;
  }
  return [
    '📚 **Tóm tắt trọng tâm từ tài liệu của bạn:**',
    ...top.map((s, i) => `${i + 1}. ${s.slice(0, 220)}${s.length > 220 ? '…' : ''}`),
    '',
    '💡 Bạn có thể nhấn **Tạo Quiz bằng AI** ở mục Quét tài liệu để chuyển trực tiếp nội dung này thành bộ câu hỏi ôn tập.',
  ].join('\n');
}

function buildQuickQuizFromDocument(doc: string): string {
  const sentences = doc
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28 && s.length <= 260);

  if (sentences.length >= 2) {
    const picked = sentences.slice(0, 3);
    const lines = ['✨ **3 câu hỏi ôn tập nhanh trích từ tài liệu của bạn:**'];
    picked.forEach((sent, idx) => {
      const words = sent.split(/\s+/);
      const mid = Math.floor(words.length / 2);
      const blankWord = words[mid]?.replace(/[.,;:!?()"]/g, '') || 'khái niệm chính';
      const cloze = words.map((w, i) => (i === mid ? '______' : w)).join(' ');
      lines.push(`\n**Câu ${idx + 1}:** Điền thuật ngữ còn thiếu: "${cloze}"`);
      lines.push(`• **Đáp án:** ${blankWord}`);
      lines.push(`• **Giải thích:** Theo tài liệu gốc: "${sent}"`);
    });
    return lines.join('\n');
  }

  // Fallback to 3 real university questions
  const sample = seedQuestionSets.flatMap((s) => s.questions).slice(0, 3);
  return [
    '✨ **3 câu hỏi ôn tập nhanh (Kho kiến thức Đại học Papyrus):**',
    ...sample.map(
      (q, i) =>
        `\n**Câu ${i + 1}:** ${q.content}\n• **Đáp án đúng:** ${q.options[q.correctIndex]}\n• **Giải thích:** ${q.explanation}`
    ),
  ].join('\n');
}

function findMatchingKnowledge(query: string): string | null {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;

  const scored: Array<{
    score: number;
    setTitle: string;
    content: string;
    answer: string;
    explanation: string;
  }> = [];

  for (const set of seedQuestionSets) {
    const setHay = `${set.title} ${set.subject} ${(set.tags ?? []).join(' ')}`.toLowerCase();
    const setBoost = qTokens.filter((t) => setHay.includes(t)).length * 2;
    for (const q of set.questions) {
      const hay = `${q.content} ${q.options.join(' ')} ${q.explanation}`.toLowerCase();
      let score = setBoost;
      for (const tok of qTokens) {
        if (hay.includes(tok)) score += 3;
      }
      if (score >= 4) {
        scored.push({
          score,
          setTitle: set.title,
          content: q.content,
          answer: q.options[q.correctIndex] ?? '',
          explanation: q.explanation,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (top.length === 0) return null;

  return [
    `🎓 **Kiến thức liên quan từ Kho học thuật Papyrus (${top[0]!.setTitle}):**`,
    ...top.map(
      (item, idx) =>
        `\n**${idx + 1}. ${item.content}**\n• **Trọng tâm / Đáp án:** ${item.answer}\n• **Giải thích chi tiết:** ${item.explanation}`
    ),
  ].join('\n');
}

export function answerLocally(
  messages: ChatMessage[],
  context: string,
  document?: string
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content.trim() ?? '';
  const lower = lastUser.toLowerCase();

  // 1. Document summary / quiz request
  if (document && document.trim().length > 20) {
    if (/(tóm tắt|summary|ý chính|tổng hợp)/i.test(lower)) {
      return `${summarizeDocument(document)}\n\n_(Papybot Trợ lý Học thuật cục bộ)_`;
    }
    if (/(câu hỏi|quiz|trắc nghiệm|ôn nhanh|test)/i.test(lower)) {
      return `${buildQuickQuizFromDocument(document)}\n\n_(Papybot Trợ lý Học thuật cục bộ)_`;
    }
    const docTokens = tokenize(lastUser);
    const matchingLines = document
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 10 && docTokens.some((t) => l.toLowerCase().includes(t)))
      .slice(0, 4);
    if (matchingLines.length > 0) {
      return [
        '📄 **Đoạn liên quan trong tài liệu bạn đã đính kèm:**',
        ...matchingLines.map((l) => `• ${l.slice(0, 260)}`),
        '',
        '_(Papybot Trợ lý Học thuật cục bộ)_',
      ].join('\n');
    }
    return `${summarizeDocument(document)}\n\n_(Papybot Trợ lý Học thuật cục bộ)_`;
  }

  // 2. Quick practice quiz request
  if (/(tạo.*câu hỏi|ôn nhanh|trắc nghiệm|quiz)/i.test(lower)) {
    return `${buildQuickQuizFromDocument('')}\n\n_(Papybot Trợ lý Học thuật cục bộ)_`;
  }

  // 3. App guidance shortcuts
  if (/(ocr|quét|scan|chụp ảnh|đọc chữ)/i.test(lower)) {
    return '📸 **Hướng dẫn Quét OCR đa ngôn ngữ:** Vào mục **Tạo Quiz bằng AI** → chọn ngôn ngữ tài liệu (Việt, Anh, Nhật, Hàn, Trung, Pháp, Đức, Nga...) → chụp hoặc tải ảnh. Papyrus tự tối ưu độ nét và trích xuất văn bản nhanh chỉ trong vài giây!';
  }
  if (/(elo|1v1|đấu trường|phòng đấu|sinh tồn|ghép thẻ)/i.test(lower)) {
    return '⚔️ **Hướng dẫn các chế độ Đấu trường 3D:**\n• **Đấu trường Sinh tồn 3D:** 3 mạng đấu Boss, trả lời đúng để tung phép 3D hạ Boss.\n• **Ghép thẻ Thư viện 3D:** Lật thẻ ghép câu hỏi – đáp án tính combo & XP.\n• **1v1 ELO:** Ghép đối thủ online trực tiếp hoặc luyện cùng Bot học giả.\n• **Phòng đấu nhóm:** Tạo phòng mã PIN/QR 2–10 người chơi cùng lúc.';
  }
  if (/(streak|chuỗi|điểm danh)/i.test(lower)) {
    return '🔥 **Chuỗi học tập (Streak):** Nhấn vào biểu tượng chuỗi ở Trang chủ hoặc trong Hồ sơ cá nhân để **Điểm danh 1 chạm mỗi ngày** hoặc hoàn thành 1 ván game/quét OCR để giữ lửa liên tiếp!';
  }

  // 4. Academic knowledge lookup across all 20 university sets
  const matched = findMatchingKnowledge(lastUser);
  if (matched) {
    return `${matched}\n\n_(Nguồn: Thư viện 20 bộ học thuật Đại học Papyrus)_`;
  }

  // 5. Greeting or general coaching response
  if (/^(xin chào|chào|hello|hi|hey)\b/i.test(lower)) {
    return [
      '👋 Xin chào! Mình là **Papybot** — Gia sư AI của Papyrus!',
      '',
      'Mình có thể hỗ trợ bạn ngay lúc này:',
      '• Hỏi kiến thức Đại học: **IT/DSA, Hệ điều hành, Mạng máy tính, CSDL, Cloud, Lịch sử VN & Thế giới, Sinh – Lý – Hóa, Văn học**.',
      '• Đính kèm file **TXT / DOCX / PDF** để tóm tắt ý chính hoặc tạo câu hỏi trắc nghiệm.',
      '• Hướng dẫn sử dụng mọi tính năng & chế độ đấu trường 3D.',
      '',
      `_(Màn hình hiện tại: ${context || '/'})_`,
    ].join('\n');
  }

  return [
    `💡 Mình đã ghi nhận câu hỏi: **"${lastUser.slice(0, 140)}"**.`,
    '',
    'Để mình giải thích sát nhất, bạn có thể:',
    '1. Nêu từ khóa môn học cụ thể (ví dụ: *QuickSort, Deadlock, TCP 3-way handshake, ACID, Định luật Faraday, Truyện Kiều, Thơ Mới, Chiến thắng Bạch Đằng...*).',
    '2. Đính kèm file tài liệu (nút kẹp giấy bên dưới) rồi gõ **"Tóm tắt tài liệu"** hoặc **"Tạo 3 câu hỏi ôn nhanh"**.',
    '',
    '_(Mẹo cho Admin: cập nhật GEMINI_API_KEY có billing hợp lệ trên Supabase Secrets để mở khóa Gemini 2.5 Cloud cho mọi câu hỏi mở rộng.)_',
  ].join('\n');
}
