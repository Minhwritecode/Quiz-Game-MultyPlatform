import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { corsHeaders } from '../_shared/cors.ts';
import { streamGeminiQuestions } from '../_shared/gemini-stream.ts';

type RequestBody = {
  request_id: string;
  source_text: string;
  question_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  language: 'vi' | 'en';
  exclude_questions?: string[];
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return json({ error: 'Sign in to generate questions.' }, 401);

  const url = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json({ error: 'Generation service is unavailable.' }, 503);
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: authError } = await authClient.auth.getUser(token);
  if (authError || !data.user || data.user.is_anonymous) return json({ error: 'Sign in to generate questions.' }, 401);

  let body: RequestBody;
  try {
    const raw = await request.text();
    if (raw.length > 60_000) throw Error();
    body = JSON.parse(raw);
    if (!body || !uuid.test(body.request_id) || typeof body.source_text !== 'string'
      || !body.source_text.trim() || body.source_text.length > 30_000
      || !Number.isInteger(body.question_count) || body.question_count < 1 || body.question_count > 30
      || !['easy', 'medium', 'hard'].includes(body.difficulty)
      || !['vi', 'en'].includes(body.language)
      || (body.exclude_questions !== undefined && (!Array.isArray(body.exclude_questions)
        || body.exclude_questions.length > 30
        || body.exclude_questions.some(item => typeof item !== 'string' || !item.trim() || item.length > 500)))) throw Error();
  } catch {
    return json({ error: 'Invalid source or generation settings.' }, 400);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY'), model = Deno.env.get('GEMINI_MODEL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiKey || !model || !serviceKey) return json({ error: 'AI generation is not configured.' }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const quota = await admin.rpc('consume_quiz_generation_quota', { p_user: data.user.id, p_request_id: body.request_id });
  if (quota.error) {
    console.error('generate-questions: quota service unavailable');
    return json({ error: 'Could not check the generation limit. Try again later.' }, 503);
  }
  if (!quota.data) {
    const seconds = 86400 - Math.floor((Date.now() / 1000) % 86400);
    return json({ error: 'Daily question-generation limit reached. Try again after 00:00 UTC.', code: 'generation_quota_exceeded' }, 429, {
      'Retry-After': String(seconds), 'X-Generation-Limit': '20',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) controller.abort();
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;
  const send = (event: string, value: unknown) => {
    if (!closed && streamController) streamController.enqueue(encoder.encode('event: ' + event + '\ndata: ' + JSON.stringify(value) + '\n\n'));
  };
  const closeStream = () => {
    if (closed) return;
    closed = true;
    try { streamController?.close(); } catch { /* client cancelled the stream */ }
  };
  const cleanup = () => { clearTimeout(timeout); request.signal.removeEventListener('abort', abort); };
  const stream = new ReadableStream<Uint8Array>({
    start(output) {
      streamController = output;
      void (async () => {
      try {
        const count = await streamGeminiQuestions({
          sourceText: body.source_text.trim(), questionCount: body.question_count, difficulty: body.difficulty,
          language: body.language, excludeQuestions: body.exclude_questions ?? [], apiKey, model, signal: controller.signal,
          emit: question => send('question', { question: { ...question, id: crypto.randomUUID() } }),
        });
        send('done', { count, complete: count === body.question_count });
        closeStream();
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('generate-questions: provider stream failed');
          send('error', { code: 'generation_failed', message: 'AI generation stopped. Keep valid questions and retry the missing ones.' });
          closeStream();
        } else closeStream();
      } finally { cleanup(); }
      })();
    },
    async cancel() {
      controller.abort();
      closed = true;
      cleanup();
    },
  });
  return new Response(stream, { headers: {
    ...corsHeaders, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Generation-Limit': '20',
  } });
});
