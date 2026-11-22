import { requestGeneratedQuestions } from './edgeFunctionClient';
import { fetch } from 'expo/fetch';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
import type { GenerationRequest } from '@/core/domain/models';

jest.mock('@/core/network/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'user-jwt' } }, error: null }) } },
}));
jest.mock('@/core/observability/monitoring', () => ({ traceOperation: (_name: string, operation: () => unknown) => operation() }));

const request: GenerationRequest = { sourceText: 'Reviewed source', questionCount: 2, difficulty: 'medium', languageCode: 'en' };
const event = (name: string, data: unknown) => 'event: ' + name + '\ndata: ' + JSON.stringify(data) + '\n\n';
const question = { id: 'q1', content: 'What is streaming?', options: ['A','B','C','D'], correct_index: 1, explanation: 'Chunks.' };
const streamResponse = (body: string) => ({
  ok: true, status: 200,
  body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }),
});


beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://papyrus.test';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
  jest.clearAllMocks();
});


test('authenticated client forwards each validated question from the SSE stream', async () => {
  const fetchMock = jest.fn().mockResolvedValue(streamResponse(
    event('question', { question }) + event('question', { question: { ...question, id: 'q2', content: 'Second?' } })
      + event('done', { count: 2, complete: true }),
  ));
  (fetch as jest.Mock).mockImplementation(fetchMock);
  const received: string[] = [];
  const result = await requestGeneratedQuestions(request, {
    requestId: '00000000-0000-4000-8000-000000000001',
    signal: new AbortController().signal,
    onQuestion: item => { received.push(item.content); },
  });
  expect(received).toEqual(['What is streaming?', 'Second?']);
  expect(result).toEqual({ count: 2, complete: true });
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://papyrus.test/functions/v1/generate-questions');
  expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer user-jwt');
});

test('quota responses are shown as a safe actionable error', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 429, json: async () => ({ error: 'Daily generation limit reached.' }),
  });
  await expect(requestGeneratedQuestions(request, {
    requestId: '00000000-0000-4000-8000-000000000002',
    signal: new AbortController().signal, onQuestion: () => undefined,
  })).rejects.toMatchObject({ userMessage: 'Daily generation limit reached.' });
});
