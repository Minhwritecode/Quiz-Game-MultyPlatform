import { AppError, serviceFailure } from '@/core/domain/failure';
import { fetch } from 'expo/fetch';
import { createAnswerParser } from './stream';
import type { PdfAttachment } from './pdf';
import { supabase } from '@/core/network/supabase';
import type { ChatMessage } from '../domain/repository';
import type { QuestionSet } from '@/core/domain/models';
import { answerLocally } from './localTutor';
import { extractTextFromPdfBase64 } from '@/features/ai-quiz/services/documentTextExtractor';
export type { ChatMessage } from '../domain/repository';

export async function askPapybot(
  messages: ChatMessage[],
  context: string,
  document: string | undefined,
  signal: AbortSignal,
  onText?: (text: string) => void,
  pdf?: PdfAttachment,
  extraSets?: QuestionSet[]
): Promise<string> {
  if (!supabase) {
    const local = answerLocally(messages, context, document, extraSets);
    onText?.(local);
    return local;
  }
  const client = supabase;
  const { data } = await client.auth.getSession();
  if (!data.session) throw new AppError('unavailable', 'Đăng nhập để trò chuyện với Papybot.');

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 25000);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const fallbackLocal = (): string => {
    const effectiveDoc =
      document && document.trim().length > 0
        ? document
        : pdf?.data
        ? extractTextFromPdfBase64(pdf.data)
        : undefined;
    const reply = answerLocally(messages, context, effectiveDoc, extraSets);
    onText?.(reply);
    return reply;
  };

  const invokeNonStream = async (): Promise<string> => {
    const body = pdf
      ? { messages, context, document, pdf: pdf.data }
      : { messages, context, document };
    const result = await client.functions.invoke('papybot', {
      body,
      signal: controller.signal,
    });
    if (result.error) {
      const status = result.error.context?.status;
      if (status === 429 || status === 401 || status === 400) {
        throw serviceFailure(status);
      }
      // Graceful local academic tutor fallback when cloud AI key/provider returns 502/503
      return fallbackLocal();
    }
    if (typeof result.data?.answer !== 'string' || !result.data.answer.trim()) {
      return fallbackLocal();
    }
    onText?.(result.data.answer);
    return result.data.answer;
  };

  try {
    if (onText) {
      if (!url || !key) return fallbackLocal();
      const response = await fetch(`${url}/functions/v1/papybot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${data.session.access_token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({ messages, context, document, pdf: pdf?.data, stream: true }),
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 401 || response.status === 400) {
          throw serviceFailure(response.status);
        }
        return fallbackLocal();
      }

      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('application/json')) {
        const parsed = (await response.json()) as { answer?: unknown };
        if (typeof parsed.answer === 'string' && parsed.answer.trim()) {
          onText(parsed.answer);
          return parsed.answer;
        }
      }

      if (!response.body) {
        return await invokeNonStream();
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createAnswerParser(onText);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
        return parser.finish();
      } catch (streamErr) {
        if (controller.signal.aborted) throw streamErr;
        return await invokeNonStream();
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }

    return await invokeNonStream();
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (controller.signal.aborted && signal.aborted) throw err;
    return fallbackLocal();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
