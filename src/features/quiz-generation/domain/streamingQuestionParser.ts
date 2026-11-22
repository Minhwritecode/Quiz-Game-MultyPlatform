import { isValidQuestion } from '@/core/domain/models';
import type { Question } from '@/core/domain/models';

export type GenerationStreamEvent =
  | { type: 'question'; question: Question }
  | { type: 'done'; count: number; complete: boolean }
  | { type: 'error'; code: string; message: string };

/** Parses SSE frames independently of network chunk boundaries. */
export class StreamingQuestionParser {
  private buffer = '';
  private event = 'message';
  private readonly seen = new Set<string>();
  private finished = false;

  addChunk(chunk: string): GenerationStreamEvent[] {
    if (this.finished) return [];
    this.buffer += chunk;
    const events: GenerationStreamEvent[] = [];
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      if (line === '') { this.event = 'message'; continue; }
      if (line.startsWith('event:')) { this.event = line.slice(6).trim(); continue; }
      if (!line.startsWith('data:')) continue;
      let data: unknown;
      try { data = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (!data || typeof data !== 'object') continue;
      const value = data as Record<string, unknown>;
      if (this.event === 'question') {
        const raw = value.question;
        if (!raw || typeof raw !== 'object') continue;
        const row = raw as Record<string, unknown>;
        const options = Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === 'string') : [];
        const candidate: Question = {
          id: typeof row.id === 'string' ? row.id : 'stream-' + this.seen.size,
          content: typeof row.content === 'string' ? row.content : '',
          options,
          correctIndex: typeof row.correct_index === 'number' ? row.correct_index : -1,
          explanation: typeof row.explanation === 'string' ? row.explanation : '',
          position: typeof row.position === 'number' ? row.position : this.seen.size,
        };
        const key = candidate.content.trim().toLocaleLowerCase();
        if (isValidQuestion(candidate) && !this.seen.has(key)) {
          this.seen.add(key);
          events.push({ type: 'question', question: { ...candidate, position: this.seen.size - 1 } });
        }
      } else if (this.event === 'done' && typeof value.count === 'number' && typeof value.complete === 'boolean') {
        this.finished = true;
        events.push({ type: 'done', count: value.count, complete: value.complete });
      } else if (this.event === 'error' && typeof value.message === 'string') {
        this.finished = true;
        events.push({ type: 'error', code: typeof value.code === 'string' ? value.code : 'generation_failed', message: value.message });
      }
    }
    return events;
  }
}
