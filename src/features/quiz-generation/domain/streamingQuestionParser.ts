import { isValidQuestion } from '@/core/domain/models';
import type { Question } from '@/core/domain/models';

export class StreamingQuestionParser {
  private buffer = '';

  addChunk(chunk: string): Question[] {
    this.buffer += chunk;
    const questions: Question[] = [];
    while (this.buffer.trim()) {
      const start = this.buffer.indexOf('{');
      if (start < 0) { this.buffer = ''; break; }
      if (start > 0) this.buffer = this.buffer.slice(start);
      try {
        const value = JSON.parse(this.buffer) as Record<string, unknown>;
        const candidate = this.toQuestion(value, questions.length);
        if (candidate) questions.push(candidate);
        this.buffer = '';
      } catch {
        break;
      }
    }
    return questions;
  }

  private toQuestion(value: Record<string, unknown>, position: number): Question | null {
    const options = Array.isArray(value.options) ? value.options.filter((item): item is string => typeof item === 'string') : [];
    const candidate: Question = {
      id: typeof value.id === 'string' ? value.id : `stream-${position}`,
      content: typeof value.question === 'string' ? value.question : '',
      options,
      correctIndex: typeof value.correct_index === 'number' ? value.correct_index : -1,
      explanation: typeof value.explanation === 'string' ? value.explanation : '',
      position: typeof value.position === 'number' ? value.position : position,
    };
    return isValidQuestion(candidate) ? candidate : null;
  }
}
