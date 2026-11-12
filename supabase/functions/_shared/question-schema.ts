export type GeneratedQuestion = {
  content: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asQuestions(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.questions)) return value.questions;
  return [];
}

export function normaliseQuestions(value: unknown, expectedCount: number): GeneratedQuestion[] {
  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];

  for (const item of asQuestions(value)) {
    if (!isRecord(item)) continue;
    const content = asText(item.content ?? item.question);
    const options = Array.isArray(item.options) ? item.options.map(asText) : [];
    const correctIndex = typeof item.correct_index === "number" ? item.correct_index : -1;
    const explanation = asText(item.explanation);
    const key = content.toLocaleLowerCase();
    const valid = content.length > 0 && options.length === 4 &&
      options.every(Boolean) && new Set(options.map((option) => option.toLocaleLowerCase())).size === 4 &&
      Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex < 4 && explanation.length > 0;
    if (!valid || seen.has(key)) continue;
    seen.add(key);
    questions.push({ content, options, correct_index: correctIndex, explanation });
  }

  if (questions.length !== expectedCount) {
    throw new Error(`AI returned ${questions.length} valid questions; expected ${expectedCount}.`);
  }
  return questions;
}

export function parseModelJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first < 0 || last <= first) throw new Error("AI returned malformed JSON.");
    return JSON.parse(cleaned.slice(first, last + 1)) as unknown;
  }
}
