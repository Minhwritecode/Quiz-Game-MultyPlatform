import { AppError, serviceFailure } from '@/core/domain/failure';
import { fetch } from 'expo/fetch';
import { createAnswerParser } from './stream';
import type { PdfAttachment } from './pdf';
import { supabase } from '@/core/network/supabase';
import type { ChatMessage } from '../domain/repository';
export type { ChatMessage } from '../domain/repository';

export async function askPapybot(
  messages: ChatMessage[],
  context: string,
  document: string | undefined,
  signal: AbortSignal,
  onText?: (text: string) => void,
  pdf?: PdfAttachment
): Promise<string> {
  if (!supabase) throw new AppError('unavailable', 'Papybot chưa được cấu hình.');
  const client = supabase;
  const { data } = await client.auth.getSession();
  if (!data.session) throw new AppError('unavailable', 'Đăng nhập để trò chuyện với Papybot.');

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 45000);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const invokeNonStream = async (): Promise<string> => {
    const body = pdf
      ? { messages, context, document, pdf: pdf.data }
      : { messages, context, document };
    const result = await client.functions.invoke('papybot', {
      body,
      signal: controller.signal,
    });
    if (result.error) throw serviceFailure(result.error.context?.status);
    if (typeof result.data?.answer !== 'string' || !result.data.answer.trim()) {
      throw new AppError('unavailable', 'Phản hồi AI không hợp lệ.');
    }
    onText?.(result.data.answer);
    return result.data.answer;
  };

  try {
    if (onText) {
      if (!url || !key) throw new AppError('unavailable', 'Papybot chưa được cấu hình.');
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
      if (!response.ok) throw serviceFailure(response.status);

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
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
