import { seedQuestionSets } from '@/core/data/seed';
import type { QuestionSet } from '@/core/domain/models';
import { sanitizeOcrAndDocumentText } from '@/features/scan-ocr/domain/ocrCleaner';
import type { ChatMessage } from '../domain/repository';

const STOP_WORDS = new Set([
  'là', 'gì', 'của', 'và', 'các', 'trong', 'có', 'được', 'cho', 'với', 'một', 'những',
  'khi', 'nào', 'như', 'thế', 'hãy', 'giải', 'thích', 'tôi', 'bạn', 'giúp', 'về', 'tại',
  'sao', 'theo', 'này', 'đó', 'hỏi', 'ơi', 'nhé', 'nha', 'xin', 'chào', 'chao', 'hi', 'hello', 'hey', 'alo', 'hôm', 'nay',
  'the', 'what', 'how', 'why', 'is', 'are', 'of', 'in', 'to', 'for', 'and',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+#]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Safe recursive-descent arithmetic & algebra solver (handles 1+1=, powers, roots, percentages, linear/quadratic equations).
 */
function trySolveMath(rawInput: string): string | null {
  const cleaned = rawInput
    .trim()
    .replace(/^(tính|giải|kết quả|bằng bao nhiêu|what is|solve|calculate)\s*:?\s*/i, '')
    .replace(/[=?？]+$/g, '')
    .trim();

  // 1. Percentage: "15% của 240" or "15% of 240"
  const pctMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*%\s*(?:của|of|\*)\s*(\d+(?:[.,]\d+)?)$/i);
  if (pctMatch) {
    const p = parseFloat(pctMatch[1]!.replace(',', '.'));
    const v = parseFloat(pctMatch[2]!.replace(',', '.'));
    const res = (p / 100) * v;
    return `🧮 **Kết quả tính toán:**\n• \`${p}% × ${v} = ${Number(res.toFixed(6))}\`\n• **Giải thích:** Lấy \`(${p} / 100) × ${v} = ${Number(res.toFixed(6))}\`.`;
  }

  // 2. Square root in natural language: "căn bậc hai của 144" / "căn 81"
  const sqrtVi = cleaned.match(/^(?:căn bậc hai của|căn bậc 2 của|căn)\s*(\d+(?:[.,]\d+)?)$/i);
  if (sqrtVi) {
    const n = parseFloat(sqrtVi[1]!.replace(',', '.'));
    if (n >= 0) {
      const r = Math.sqrt(n);
      return `🧮 **Kết quả:**\n• \`√${n} = ${Number(r.toFixed(6))}\``;
    }
  }

  // 3. Linear equation a*x + b = c (e.g. "2x + 6 = 14", "3x - 9 = 0")
  const linMatch = cleaned.replace(/\s+/g, '').match(/^([+-]?\d*\.?\d*)x([+-]\d+\.?\d*)?=([+-]?\d+\.?\d*)$/i);
  if (linMatch) {
    const aRaw = linMatch[1] ?? '';
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : parseFloat(aRaw);
    const b = linMatch[2] ? parseFloat(linMatch[2]) : 0;
    const c = parseFloat(linMatch[3]!);
    if (a !== 0 && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      const x = (c - b) / a;
      return [
        `📐 **Giải phương trình bậc nhất:** \`${cleaned}\``,
        `1. Chuyển vế: \`${a}x = ${c} - (${b}) = ${c - b}\``,
        `2. Chia hai vế cho \`${a}\`: **\`x = ${Number(x.toFixed(6))}\`**`,
      ].join('\n');
    }
  }

  // 4. Quadratic equation ax^2 + bx + c = 0 (e.g. "x^2 - 5x + 6 = 0")
  const quadMatch = cleaned
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .match(/^([+-]?\d*\.?\d*)x\^2([+-]\d*\.?\d*)x([+-]\d+\.?\d*)=0$/i);
  if (quadMatch) {
    const parseCoef = (s: string) => (s === '' || s === '+' ? 1 : s === '-' ? -1 : parseFloat(s));
    const a = parseCoef(quadMatch[1] ?? '');
    const b = parseCoef(quadMatch[2] ?? '');
    const c = parseFloat(quadMatch[3]!);
    if (a !== 0 && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      const delta = b * b - 4 * a * c;
      if (delta < 0) {
        return `📐 **Phương trình bậc hai:** \`${cleaned}\`\n• Biệt thức \`Δ = (${b})² - 4·(${a})·(${c}) = ${delta} < 0\` → **Vô nghiệm thực**.`;
      }
      if (delta === 0) {
        const x = -b / (2 * a);
        return `📐 **Phương trình bậc hai:** \`${cleaned}\`\n• \`Δ = 0\` → Nghiệm kép: **\`x₁ = x₂ = ${Number(x.toFixed(6))}\`**.`;
      }
      const x1 = (-b + Math.sqrt(delta)) / (2 * a);
      const x2 = (-b - Math.sqrt(delta)) / (2 * a);
      return [
        `📐 **Giải phương trình bậc hai:** \`${cleaned}\``,
        `• \`Δ = (${b})² - 4·(${a})·(${c}) = ${delta} > 0\``,
        `• **\`x₁ = ${Number(x1.toFixed(6))}\`** · **\`x₂ = ${Number(x2.toFixed(6))}\`**`,
      ].join('\n');
    }
  }

  // 5. Pure arithmetic / scientific expression (1+1, (12+8)*3/4, 2^10, sqrt(81)+5)
  const expr = cleaned
    .replace(/×|x(?=\s*\d)/gi, '*')
    .replace(/÷|:/g, '/')
    .replace(/\^/g, '**')
    .replace(/\bsqrt\s*\(/gi, 'Math.sqrt(')
    .replace(/\babs\s*\(/gi, 'Math.abs(')
    .replace(/\bpi\b|π/gi, String(Math.PI));

  if (/^[0-9+\-*/().%\s]+$/.test(expr) || (/Math\.(sqrt|abs)\(/.test(expr) && /^[0-9+\-*/().%\sMathsqrtabs,]+$/.test(expr))) {
    if (!/[+\-*/%]/.test(expr) && !expr.includes('Math.')) return null;
    try {
      // Safe evaluation: strictly whitelisted numeric & Math tokens verified by regex above
      const fn = new Function(`return (${expr});`);
      const val = Number(fn());
      if (Number.isFinite(val)) {
        const formatted = Number.isInteger(val) ? String(val) : String(Number(val.toFixed(8)));
        return `🧮 **Đáp án chính xác:**\n• **\`${cleaned} = ${formatted}\`**`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Chunked RAG retrieval over attached PDF / DOCX / TXT / OCR Image text with explicit citations.
 */
function answerFromAttachedDocument(query: string, rawDoc: string): string {
  const doc = sanitizeOcrAndDocumentText(rawDoc.replace(/^\[Nội dung nhận diện từ ảnh đính kèm\]:\s*/i, ''));
  const lower = query.toLowerCase();
  const paragraphs = doc
    .replace(/\r/g, '\n')
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ỹ0-9•\-])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 12 && (p.match(/\p{L}{2,}/gu) || []).length >= 3);

  if (paragraphs.length === 0) {
    return [
      '🖼️ **Ảnh/Tài liệu đính kèm chứa nhiều chi tiết sơ đồ nhỏ hoặc chữ nghệ thuật:**',
      '• Để Papybot phân tích sâu nhất sơ đồ này, bạn hãy gõ tên chủ đề chính trên ảnh (ví dụ: *"Giải thích kiến trúc Voice AI Real-Time"* hoặc *"Phân tích luồng Data Flow"*) để mình giải thích từng thành phần thật mạch lạc nhé!',
    ].join('\n');
  }

  if (/(câu hỏi|quiz|trắc nghiệm|ôn nhanh|test)/i.test(lower)) {
    return buildQuickQuizFromDocument(doc);
  }

  if (/(tóm tắt|summary|ý chính|tổng hợp|phân tích)/i.test(lower) || query.length < 6) {
    const top = paragraphs.slice(0, 6);
    return [
      '📚 **Tổng hợp nội dung sạch đã chuẩn hóa từ tài liệu / ảnh của bạn:**',
      ...top.map((s, i) => `${i + 1}. ${s.slice(0, 240)}${s.length > 240 ? '…' : ''}`),
      '',
      '💡 Bạn có thể hỏi sâu bất kỳ mục nào ở trên hoặc bấm **"Tạo 3 câu hỏi ôn nhanh"** để luyện phản xạ ngay!',
    ].join('\n');
  }

  const qTokens = tokenize(query);
  const scored = paragraphs
    .map((para, idx) => {
      const hay = para.toLowerCase();
      let score = 0;
      for (const tok of qTokens) {
        if (hay.includes(tok)) score += 4;
      }
      return { para, idx: idx + 1, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (scored.length > 0) {
    return [
      `📖 **Câu trả lời trích xuất trực tiếp từ tài liệu đính kèm:**`,
      ...scored.map((s) => `• "${s.para.slice(0, 300)}${s.para.length > 300 ? '…' : ''}" **\`[Trích nguồn: Đoạn ${s.idx}]\`**`),
    ].join('\n\n');
  }

  // Fallback to summary of attached document
  const fallbackTop = paragraphs.slice(0, 4);
  return [
    `📄 **Tài liệu đính kèm không chứa nguyên văn cụm "${query.slice(0, 60)}", nhưng đây là các nội dung trọng tâm liên quan:**`,
    ...fallbackTop.map((s, i) => `• ${s.slice(0, 240)} \`[Nguồn: Đoạn ${i + 1}]\``),
  ].join('\n');
}

function buildQuickQuizFromDocument(doc: string): string {
  const sentences = doc
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 26 && s.length <= 260);

  if (sentences.length >= 2) {
    const picked = sentences.slice(0, 3);
    const lines = ['✨ **3 câu hỏi ôn tập trích xuất từ tài liệu đính kèm:**'];
    picked.forEach((sent, idx) => {
      const words = sent.split(/\s+/);
      const mid = Math.floor(words.length / 2);
      const blankWord = words[mid]?.replace(/[.,;:!?()"]/g, '') || 'khái niệm chính';
      const cloze = words.map((w, i) => (i === mid ? '______' : w)).join(' ');
      lines.push(`\n**Câu ${idx + 1}:** Điền thuật ngữ còn thiếu: "${cloze}"`);
      lines.push(`• **Đáp án:** ${blankWord}`);
      lines.push(`• **Trích nguồn:** "${sent}" \`[Đoạn ${idx + 1}]\``);
    });
    return lines.join('\n');
  }

  const sample = seedQuestionSets.flatMap((s) => s.questions).slice(0, 3);
  return [
    '✨ **3 câu hỏi ôn tập nhanh (Kho kiến thức Đại học Papyrus):**',
    ...sample.map(
      (q, i) =>
        `\n**Câu ${i + 1}:** ${q.content}\n• **Đáp án đúng:** ${q.options[q.correctIndex]}\n• **Giải thích:** ${q.explanation}`
    ),
  ].join('\n');
}

const CORE_ENCYCLOPEDIA: Array<{ pattern: RegExp; reply: string }> = [
  {
    pattern: /\b(python|javascript|typescript|react native|java|c\+\+|golang|rust)\b/i,
    reply:
      '💻 **Giải thích Lập trình & Kỹ thuật Phần mềm:**\n• **Python:** Ngôn ngữ thông dịch cú pháp ngắn gọn, mạnh về AI/ML, Data Science & tự động hóa.\n• **TypeScript / React Native:** Hệ kiểu tĩnh trên JavaScript kết hợp kiến trúc đa nền tảng (iOS, Android, Web) với hiệu năng cao.\n• **C++ / Rust:** Quản lý bộ nhớ cấp thấp, tối ưu tốc độ thực thi cho Game Engine, Hệ điều hành và Hệ thống nhúng.\n\nBạn muốn mình viết đoạn code mẫu hay phân tích độ phức tạp thuật toán (`Big-O`) cho bài toán nào?',
  },
  {
    pattern: /\b(oop|hướng đối tượng|đa hình|kế thừa|đóng gói|trừu tượng|solid)\b/i,
    reply:
      '🧱 **4 Tính chất Lập trình Hướng đối tượng (OOP) & SOLID:**\n1. **Encapsulation (Đóng gói):** Che giấu trạng thái nội tại, giao tiếp qua phương thức chuẩn.\n2. **Inheritance (Kế thừa):** Tái sử dụng thuộc tính/hành vi từ lớp cha.\n3. **Polymorphism (Đa hình):** Cùng một thông điệp/interface nhưng thực thi khác nhau tùy đối tượng.\n4. **Abstraction (Trừu tượng):** Tập trung vào bản chất cốt lõi thay vì chi tiết cài đặt.',
  },
  {
    pattern: /\b(pomodoro|cách học|phương pháp học|ôn thi|active recall|spaced repetition|ghi nhớ)\b/i,
    reply:
      '🧠 **Phương pháp Học Đỉnh Cao chuẩn Khoa học Thần kinh:**\n1. **Active Recall (Chủ động gợi nhớ):** Đóng tài liệu lại và tự trả lời bằng **Cung Thủ Thiên Thạch 3D** hoặc **Đấu Trường Sinh Tồn** thay vì đọc thụ động.\n2. **Spaced Repetition (Lặp lại ngắt quãng):** Ôn lại sau `1 ngày → 3 ngày → 7 ngày → 14 ngày`.\n3. **Pomodoro 25/5:** Tập trung sâu 25 phút không xao nhãng, nghỉ 5 phút để củng cố trí nhớ dài hạn.',
  },
  {
    pattern: /\b(bạn là ai|tên gì|who are you|làm được gì|chức năng)\b/i,
    reply:
      '✨ Mình là **Papybot AI** — Gia sư Học thuật Đa phương thức của **Papyrus**!\n\nMình có thể:\n• **Giải toán & phương trình tức thì** (số học, phần trăm, phương trình bậc 1 & bậc 2).\n• **Đọc ảnh chụp bài tập (Camera / Thư viện ảnh)** bằng OCR & giải thích từng bước.\n• **Phân tích PDF, Word (DOCX), Markdown, TXT** có trích dẫn `[Nguồn: Đoạn X]`.\n• **Nhận diện giọng nói (🎤 Mic)** và **đọc to câu trả lời (🔊 Loa)**.\n• Tra cứu toàn bộ **20 bộ đề Đại học** (CNTT, Lịch sử, Sinh-Lý-Hóa, Văn học) và các bộ đề riêng của bạn!',
  },
];

function findMatchingKnowledge(query: string, extraSets?: QuestionSet[]): string | null {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return null;

  const allSets = extraSets && extraSets.length > 0 ? extraSets : seedQuestionSets;

  const scored: Array<{
    score: number;
    setTitle: string;
    content: string;
    answer: string;
    explanation: string;
  }> = [];

  const hasWholeWord = (text: string, token: string): boolean => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
  };

  for (const set of allSets) {
    const setHay = `${set.title} ${set.subject} ${(set.tags ?? []).join(' ')}`.toLowerCase();
    const setBoost = qTokens.filter((t) => hasWholeWord(setHay, t)).length * 2;
    for (const q of set.questions) {
      const hay = `${q.content} ${q.options.join(' ')} ${q.explanation}`.toLowerCase();
      let score = setBoost;
      for (const tok of qTokens) {
        if (hasWholeWord(hay, tok)) score += 3;
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
    `🎓 **Kiến thức chuẩn xác từ Kho Học thuật Papyrus \`[Nguồn: ${top[0]!.setTitle}]\`:**`,
    ...top.map(
      (item, idx) =>
        `\n**${idx + 1}. ${item.content}**\n• **Đáp án / Khái niệm cốt lõi:** ${item.answer}\n• **Giải thích:** ${item.explanation}`
    ),
  ].join('\n');
}

export function answerLocally(
  messages: ChatMessage[],
  context: string,
  document?: string,
  extraSets?: QuestionSet[],
  strictMatchOnly = false
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content.trim() ?? '';
  const lower = lastUser.toLowerCase();

  // 0. Natural Conversational Check-ins, Small Talk & Greetings FIRST!
  if (
    /(hôm nay.*thế nào|bạn khỏe không|dạo này sao|how are you|how's it going|bạn đang làm gì|vui không|khỏe chứ)/i.test(
      lower
    )
  ) {
    const hasHi = /(xin chào|chào|hi|hello|hey)/i.test(lower);
    return [
      hasHi
        ? '👋 Chào bạn nhé! Hôm nay mình rất khỏe và tràn đầy năng lượng để trò chuyện cùng bạn! ✨'
        : '😊 Cảm ơn bạn đã hỏi thăm nha! Hôm nay Papybot rất vui và sẵn sàng đồng hành cùng bạn mọi lúc!',
      '',
      'Ngày hôm nay của bạn thế nào rồi? Bạn muốn **trò chuyện thư giãn**, **hỏi bất kỳ chủ đề nào đang tò mò**, **nhờ tóm tắt bài viết/tài liệu**, hay **luyện nhanh vài câu đố** cùng mình?',
    ].join('\n');
  }

  if (
    /^[\s!.,?]*(xin chào|chào bạn|chào papybot|chào papy|chào cậu|chào|hello|helo|hi|hey|alo|ê|hí|yo)(\s+(xin chào|chào|bạn|papybot|papy|cậu|mình|ơi|nhé|nha|ạ|there|ad))*[\s!.,?]*$/i.test(
      lower
    )
  ) {
    return [
      '👋 Xin chào! Rất vui được trò chuyện cùng bạn trên **Papyrus**!',
      'Bạn cứ hỏi tự nhiên bất cứ câu gì nhé — từ trò chuyện hàng ngày, giải toán, viết code, hỏi đáp kiến thức cho tới đọc ảnh/PDF, mình luôn sẵn sàng!',
    ].join('\n');
  }

  if (/(cảm ơn|thanks|thank you|tuyệt quá|giỏi quá|hay quá)/i.test(lower) && lastUser.length < 48) {
    return '🥰 Không có chi đâu nè! Rất vui vì giúp được bạn. Cần hỏi thêm câu gì cứ nhắn mình liền nhé!';
  }

  if (/(tạm biệt|bye|ngủ ngon|hẹn gặp lại)/i.test(lower) && lastUser.length < 48) {
    return '🌙 Tạm biệt bạn nhé! Chúc bạn một ngày thật vui vẻ và nhiều năng lượng nha! ✨';
  }

  // 1. Exact Math / Equation Solver (handles "1+1=", "2x + 6 = 14", percentages, roots...)
  const mathAns = trySolveMath(lastUser);
  if (mathAns) {
    return mathAns;
  }

  // 2. Source-Grounded Document / Image OCR / PDF RAG Analysis
  if (document && document.trim().length > 8) {
    return answerFromAttachedDocument(lastUser, document);
  }

  // 3. Quick practice quiz generation
  if (/(tạo.*câu hỏi|ôn nhanh|trắc nghiệm|quiz)/i.test(lower)) {
    return buildQuickQuizFromDocument('');
  }

  // 4. Built-in Academic & Programming Encyclopedia
  for (const item of CORE_ENCYCLOPEDIA) {
    if (item.pattern.test(lastUser)) {
      return item.reply;
    }
  }

  // 5. App feature guidance
  if (/(ocr|quét|scan|chụp ảnh|đọc chữ)/i.test(lower)) {
    return '📸 **Quét OCR & Giải bài qua ảnh:** Bạn có thể bấm thẳng nút **Máy ảnh** hoặc **Thư viện ảnh** ngay dưới thanh chat của Papybot để chụp đề bài, hoặc vào **Tạo Quiz bằng AI** để quét nhiều trang (9 ngôn ngữ) và xoay/sắp xếp trang!';
  }
  if (/(elo|1v1|đấu trường|phòng đấu|kahoot|sinh tồn|ghép thẻ|cung thủ|giả kim)/i.test(lower)) {
    return '⚔️ **Hệ sinh thái Game 3D của Papyrus:**\n• **🏹 Cung Thủ Thiên Thạch 3D:** Bắn nỏ lửa diệt thiên thạch không cần trắc nghiệm A/B/C/D.\n• **🧪 Giả Kim Phân Loại 3D:** Ném tinh thể tri thức vào 3 lò luyện kim 3D.\n• **🔥 Sinh Tồn Đấu Boss Golem 3D:** Trả lời đúng bắn tên lửa chí mạng, trả lời sai bị Golem hất đá chôn vùi!\n• **⚡ Phòng Đấu Kahoot Live:** Mở phòng mã PIN/QR cho bạn bè vào chơi ngay không cần đăng nhập!';
  }

  // 6. Search across all 20 University Sets + User's Own Sets
  const matched = findMatchingKnowledge(lastUser, extraSets);
  if (matched) {
    return matched;
  }

  // When called in pre-API mode, return empty string so /api/papybot handles open-ended conversation & live Wikipedia/LLM!
  if (strictMatchOnly) {
    return '';
  }

  if (/^(xin chào|chào|hello|hi|hey|alo|ê)\b/i.test(lower)) {
    return [
      '👋 Chào bạn! Mình đang lắng nghe bạn đây ✨',
      'Bạn hãy chia sẻ thêm câu hỏi hoặc chủ đề bạn muốn trao đổi nhé — mình sẽ giải đáp chi tiết ngay!',
    ].join('\n');
  }

  // Friendly offline conversational fallback (when device has no internet)
  return [
    `💬 Mình đã nhận được tin nhắn của bạn: *"${lastUser.slice(0, 120)}"*`,
    '',
    `Hiện thiết bị đang ở chế độ ngoại tuyến hoặc mất kết nối tạm thời nên mình chưa tra cứu trực tuyến mở rộng được. Ngay cả khi không có mạng, bạn vẫn có thể:`,
    `• Gửi **phép tính / phương trình** (vd: \`2x + 6 = 14\`, \`sqrt(144) + 25\`),`,
    `• Đính kèm **PDF / DOCX / Ảnh bài tập** để mình trích xuất nội dung tại chỗ,`,
    `• Hoặc hỏi về **20 bộ chuyên đề Đại học** có sẵn trên máy (CNTT, Toán-Lý-Hóa-Sinh, Lịch sử, Văn học) tại màn hình \`${context || '/'}\` nhé!`,
  ].join('\n');
}
