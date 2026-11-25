import { AppError, serviceFailure } from '@/core/domain/failure';
import { fetch } from 'expo/fetch';
import { createAnswerParser } from './stream';
import type { PdfAttachment } from './pdf';
import { supabase } from '@/core/network/supabase';
import type { ChatMessage, ImageAttachment } from '../domain/repository';
import type { QuestionSet } from '@/core/domain/models';
import { answerLocally } from './localTutor';
import { extractTextFromPdfBase64 } from '@/features/ai-quiz/services/documentTextExtractor';
import { sanitizeOcrAndDocumentText } from '@/features/scan-ocr/domain/ocrCleaner';
export type { ChatMessage } from '../domain/repository';

/**
 * Ensures strictly alternating `user` -> `assistant` -> `user` messages ending with `user`
 * so the Supabase `papybot` Edge Function validator never rejects multi-turn conversations.
 */
function normalizeAlternatingMessages(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const m of messages) {
    const clean = m.content.trim().slice(0, 3900);
    if (!clean) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content}\n\n${clean}`.slice(0, 3900);
    } else {
      merged.push({ role: m.role, content: clean });
    }
  }
  while (merged.length > 0 && merged[0]?.role !== 'user') {
    merged.shift();
  }
  if (merged.length === 0) {
    return [{ role: 'user', content: 'Hãy hỗ trợ phân tích nội dung bài học này.' }];
  }
  if (merged[merged.length - 1]?.role !== 'user') {
    merged.push({ role: 'user', content: 'Hãy tiếp tục giải thích chi tiết.' });
  }
  return merged.slice(-19);
}

export async function askPapybot(
  messages: ChatMessage[],
  context: string,
  document: string | undefined,
  signal: AbortSignal,
  onText?: (text: string) => void,
  pdf?: PdfAttachment,
  extraSets?: QuestionSet[],
  image?: ImageAttachment
): Promise<string> {
  const cleanDoc = document ? sanitizeOcrAndDocumentText(document) : undefined;
  const normalizedMessages = normalizeAlternatingMessages(messages);

  if (!supabase) {
    const local = answerLocally(normalizedMessages, context, cleanDoc, extraSets);
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
  const timer = setTimeout(cancel, 28000);

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const fallbackLocal = (): string => {
    const effectiveDoc =
      cleanDoc && cleanDoc.trim().length > 0
        ? cleanDoc
        : pdf?.data
        ? extractTextFromPdfBase64(pdf.data)
        : undefined;
    const reply = answerLocally(normalizedMessages, context, effectiveDoc, extraSets);
    onText?.(reply);
    return reply;
  };

  const buildRequestBody = (stream: boolean) => ({
    messages: normalizedMessages,
    context: (context || '/').slice(0, 110),
    ...(cleanDoc ? { document: cleanDoc.slice(0, 28000) } : {}),
    ...(pdf?.data ? { pdf: pdf.data } : {}),
    ...(image?.data && image.data.length <= 4_400_000 ? { image } : {}),
    ...(stream ? { stream: true } : {}),
  });

  const invokeNonStream = async (): Promise<string> => {
    const result = await client.functions.invoke('papybot', {
      body: buildRequestBody(false),
      signal: controller.signal,
    });
    if (result.error) {
      const status = result.error.context?.status;
      if (status === 429 || status === 401) {
        throw serviceFailure(status);
      }
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
        body: JSON.stringify(buildRequestBody(true)),
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 401) {
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
