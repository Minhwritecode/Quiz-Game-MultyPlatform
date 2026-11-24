import type { GenerationRequest, Question } from '@/core/domain/models';

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'các', 'trong', 'có', 'được', 'cho', 'với', 'một', 'những', 'này', 'đó', 'theo', 'khi',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'were', 'have', 'has',
]);

function pickCandidateTerm(sentence: string): string | null {
  // Prefer term after "là" or before ":" or longest meaningful capitalized/technical word
  const colonMatch = sentence.match(/^([^:]{3,42}):\s+/);
  if (colonMatch?.[1]) return colonMatch[1].trim();

  const laMatch = sentence.match(/^([^,.]{3,42})\s+là\s+/i);
  if (laMatch?.[1]) return laMatch[1].trim();

  const words = sentence
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return null;
  words.sort((a, b) => b.length - a.length);
  return words[0] ?? null;
}

/**
 * Deterministic grounded quiz synthesizer used ONLY when remote cloud AI returns 502/503,
 * ensuring the learner can ALWAYS generate valid 4-option multiple-choice questions
 * directly from their reviewed study document.
 */
export function synthesizeQuestionsFromSource(request: GenerationRequest): Question[] {
  const cleanText = request.sourceText.replace(/\r/g, '\n').trim();
  const rawSentences = cleanText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 24);

  const sentences =
    rawSentences.length > 0
      ? rawSentences
      : [cleanText.slice(0, 260) || 'Nội dung tài liệu học tập trọng tâm.'];

  const isVi = request.languageCode !== 'en';
  const excluded = new Set((request.excludeQuestions ?? []).map((q) => q.toLowerCase()));

  // Build distractor term pool from the source document itself
  const termPool = Array.from(
    new Set(
      sentences
        .flatMap((s) => {
          const picked = pickCandidateTerm(s);
          const extra = s
            .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
          return picked ? [picked, ...extra.slice(0, 3)] : extra.slice(0, 3);
        })
        .filter((t) => t.length >= 3 && t.length <= 46)
    )
  );

  const fallbackDistractors = isVi
    ? ['Khái niệm không liên quan trong đoạn', 'Giả thuyết trái ngược tài liệu', 'Yếu tố ngoại lệ không được nhắc tới', 'Quy trình ngược chiều mô tả', 'Định nghĩa mở rộng ngoài phạm vi']
    : ['Unrelated concept', 'Contradictory hypothesis', 'Unmentioned exception', 'Opposite process', 'Out-of-scope definition'];

  const results: Question[] = [];
  const count = Math.max(1, Math.min(request.questionCount, 15));

  for (let i = 0; i < count; i++) {
    const sent = sentences[i % sentences.length]!;
    const answerTerm = pickCandidateTerm(sent) || sent.split(/\s+/).slice(0, 3).join(' ');
    const escaped = answerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cloze = sent.replace(new RegExp(escaped, 'i'), '________');
    const hasBlank = cloze !== sent;

    const prompt = hasBlank
      ? isVi
        ? `Theo tài liệu đã học, cụm từ thích hợp nhất điền vào chỗ trống là gì?\n"${cloze.slice(0, 220)}"`
        : `According to the source material, which term best completes the statement?\n"${cloze.slice(0, 220)}"`
      : isVi
      ? `Ý chính nào sau đây phản ánh đúng nội dung tài liệu (phần ${i + 1})?`
      : `Which statement best matches the study material (excerpt ${i + 1})?`;

    if (excluded.has(prompt.toLowerCase()) && i < sentences.length - 1) continue;

    const distractors: string[] = [];
    for (const cand of [...termPool, ...fallbackDistractors]) {
      if (distractors.length >= 3) break;
      if (cand.toLowerCase() !== answerTerm.toLowerCase() && !distractors.some((d) => d.toLowerCase() === cand.toLowerCase())) {
        distractors.push(cand);
      }
    }
    while (distractors.length < 3) {
      distractors.push(isVi ? `Phương án nhiễu ${distractors.length + 1}` : `Distractor ${distractors.length + 1}`);
    }

    const correctIndex = i % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, answerTerm);

    results.push({
      id: `local-ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      content: prompt,
      options: options.slice(0, 4),
      correctIndex,
      explanation: isVi
        ? `Dẫn chứng trực tiếp từ tài liệu nguồn: "${sent.slice(0, 240)}"`
        : `Grounded directly in source: "${sent.slice(0, 240)}"`,
      position: results.length,
    });
  }

  return results;
}
