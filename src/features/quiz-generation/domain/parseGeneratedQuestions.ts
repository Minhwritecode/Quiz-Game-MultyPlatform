import { isValidQuestion } from '@/core/domain/models';
import type { Question } from '@/core/domain/models';

function readJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('The AI response was not valid JSON.');
    return JSON.parse(cleaned.slice(first, last + 1)) as unknown;
  }
}

export function parseGeneratedQuestions(raw: string): Question[] {
  const value = readJson(raw);
  const items = Array.isArray(value) ? value : typeof value === 'object' && value !== null && 'questions' in value && Array.isArray(value.questions) ? value.questions : [];
  const seen = new Set<string>();
  return items.flatMap((item, position) => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const options = Array.isArray(record.options) ? record.options.filter((option): option is string => typeof option === 'string') : [];
    const question: Question = {
      id: typeof record.id === 'string' ? record.id : `generated-${position}`,
      content: typeof record.content === 'string' ? record.content : typeof record.question === 'string' ? record.question : '',
      options,
      correctIndex: typeof record.correct_index === 'number' ? record.correct_index : -1,
      explanation: typeof record.explanation === 'string' ? record.explanation : '',
      position,
    };
    const key = question.content.trim().toLocaleLowerCase();
    if (!key || seen.has(key) || !isValidQuestion(question)) return [];
    seen.add(key);
    return [question];
  });
}
