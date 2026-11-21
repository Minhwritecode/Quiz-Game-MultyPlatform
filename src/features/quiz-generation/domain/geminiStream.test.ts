import { QuestionObjectStream } from '../../../../supabase/functions/_shared/gemini-stream';

test('server tokenizer emits finished JSON question objects before the array closes', () => {
  const stream = new QuestionObjectStream();
  const payload = JSON.stringify({ questions: [
    { content: 'A brace } in a string', options: ['one','two','three','four'], correct_index: 0, explanation: 'nested { text }' },
    { content: 'Second', options: ['a','b','c','d'], correct_index: 2, explanation: 'Because' },
  ] });
  const result: unknown[] = [];
  for (let index = 0; index < payload.length; index += 5) result.push(...stream.push(payload.slice(index,index+5)));
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ content: 'A brace } in a string' });
  expect(result[1]).toMatchObject({ content: 'Second' });
});

test('server tokenizer handles a questions key split across chunks', () => {
  const stream = new QuestionObjectStream();
  const payload = '{"que' + 'stions":[' + JSON.stringify({ content: 'Split marker' }) + ']}';
  const result: unknown[] = [];
  for (const char of payload) result.push(...stream.push(char));
  expect(result).toEqual([{ content: 'Split marker' }]);
});
