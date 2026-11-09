import { parseGeneratedQuestions } from './parseGeneratedQuestions';

describe('parseGeneratedQuestions', () => {
  it('parses structured JSON and removes duplicate content', () => {
    const result = parseGeneratedQuestions(JSON.stringify({ questions: [
      { id: 'q-1', content: 'What is local-first?', options: ['A', 'B', 'C', 'D'], correct_index: 0, explanation: 'It works locally.' },
      { id: 'q-2', content: 'What is local-first?', options: ['A', 'B', 'C', 'D'], correct_index: 0, explanation: 'Duplicate.' },
    ] }));
    expect(result).toHaveLength(1);
    expect(result[0]?.correctIndex).toBe(0);
  });

  it('accepts a fenced JSON response and rejects malformed questions', () => {
    const result = parseGeneratedQuestions('```json\n{"questions":[{"content":"Valid?","options":["A","B","C","D"],"correct_index":2,"explanation":"Because."},{"content":"Invalid","options":["A"],"correct_index":0,"explanation":"No."}]}\n```');
    expect(result).toHaveLength(1);
    expect(result[0]?.content).toBe('Valid?');
  });
});
