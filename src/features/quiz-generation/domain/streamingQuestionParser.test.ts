import { StreamingQuestionParser } from './streamingQuestionParser';

const question = { id: 'q1', content: 'Question?', options: ['A', 'B', 'C', 'D'], correct_index: 1, explanation: 'Why.' };
const frame = (event: string, payload: unknown) => 'event: ' + event + '\ndata: ' + JSON.stringify(payload) + '\n\n';

test('emits valid question frames even when transport splits them across arbitrary chunks', () => {
  const parser = new StreamingQuestionParser();
  const text = frame('question', { question });
  expect(parser.addChunk(text.slice(0, 17))).toEqual([]);
  const events = parser.addChunk(text.slice(17));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ type: 'question', question: { content: 'Question?', correctIndex: 1 } });
});

test('drops invalid and duplicate questions then parses completion state', () => {
  const parser = new StreamingQuestionParser();
  const all = frame('question', { question }) + frame('question', { question: { ...question, id: 'q2' } })
    + frame('question', { question: { ...question, id: 'bad', options: ['A'] } })
    + frame('done', { count: 1, complete: false });
  expect(parser.addChunk(all).map(event => event.type)).toEqual(['question', 'done']);
  expect(parser.addChunk(frame('question', { question: { ...question, id: 'late' } }))).toEqual([]);
});

test('surfaces safe stream errors', () => {
  const parser = new StreamingQuestionParser();
  expect(parser.addChunk(frame('error', { code: 'generation_failed', message: 'Try again.' }))).toEqual([
    { type: 'error', code: 'generation_failed', message: 'Try again.' },
  ]);
});
