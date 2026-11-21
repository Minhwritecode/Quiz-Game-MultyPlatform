import { fetch } from 'expo/fetch';
import { supabase } from '@/core/network/supabase';
import type { GenerationRequest, Question } from '@/core/domain/models';
import { AppError, serviceFailure } from '@/core/domain/failure';
import { traceOperation } from '@/core/observability/monitoring';
import { StreamingQuestionParser } from '../domain/streamingQuestionParser';

export type GenerationProgress = { count: number; complete: boolean };
export type GenerateOptions = {
  requestId: string;
  signal: AbortSignal;
  onQuestion: (question: Question) => void | Promise<void>;
};

export const isGenerationConfigured = Boolean(supabase);

export async function requestGeneratedQuestions(
  request: GenerationRequest,
  options: GenerateOptions,
): Promise<GenerationProgress> {
  if (!supabase) throw new AppError('unavailable', 'Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new AppError('authentication', 'Sign in to generate questions. Manual authoring works offline.');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new AppError('unavailable', 'Generation service is not configured.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);
  const cancel = () => controller.abort();
  options.signal.addEventListener('abort', cancel, { once: true });
  if (options.signal.aborted) controller.abort();
  try {
    return await traceOperation('generation', async () => {
      const response = await fetch(url.replace(/\/$/, '') + '/functions/v1/generate-questions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: 'Bearer ' + data.session!.access_token,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          request_id: options.requestId,
          source_text: request.sourceText,
          question_count: request.questionCount,
          difficulty: request.difficulty,
          language: request.languageCode,
          exclude_questions: (request.excludeQuestions ?? []).slice(0, 30).map(item => item.slice(0, 500)),
        }),
      });
      if (!response.ok) {
        let body: { error?: string } = {};
        try { body = await response.json() as { error?: string }; } catch { /* status remains authoritative */ }
        if (response.status === 429) throw new AppError('unavailable', body.error ?? 'Daily AI question limit reached. Try again tomorrow.');
        const safe = serviceFailure(response.status);
        throw new AppError(safe.code, body.error ?? safe.userMessage);
      }
      if (!response.body) throw new AppError('unavailable', 'This connection cannot receive a live generation stream.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new StreamingQuestionParser();
      let completed: GenerationProgress | undefined;
      const consume = async (text: string) => {
        for (const event of parser.addChunk(text)) {
          if (event.type === 'question') await options.onQuestion(event.question);
          else if (event.type === 'done') completed = { count: event.count, complete: event.complete };
          else if (event.type === 'error') throw new AppError('unavailable', event.message);
        }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await consume(decoder.decode(value, { stream: true }));
        }
        const last = decoder.decode();
        if (last) await consume(last);
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      if (!completed) throw new AppError('unavailable', 'Generation stream ended before completion. Valid questions have been saved in the job; retry or fill the missing ones.');
      return completed;
    });
  } catch (error) {
    if (controller.signal.aborted && !options.signal.aborted) throw new AppError('unavailable', 'Generation timed out. Retry the saved job.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener('abort', cancel);
  }
}
