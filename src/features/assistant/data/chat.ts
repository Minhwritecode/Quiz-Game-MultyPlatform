import { AppError, serviceFailure } from '@/core/domain/failure';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
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
    return [{ role: 'user', content: 'Xin chào Papybot!' }];
  }
  if (merged[merged.length - 1]?.role !== 'user') {
    merged.push({ role: 'user', content: 'Hãy tiếp tục giải thích chi tiết.' });
  }
  return merged.slice(-19);
}

function resolvePapybotServerlessUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/papybot`;
  }
  return 'https://papyrus-lyart-five.vercel.app/api/papybot';
}

export async function askPapybot(
  messages: ChatMessage[],
  context: string,
  document: string | undefined,
  signal: AbortSignal,
  onText?: (text: string) => void,
  pdf?: PdfAttachment,
  extraSets?: QuestionSet[],
  image?: ImageAttachment,
  allowGuestConversational = false
): Promise<string> {
  const cleanDoc = document ? sanitizeOcrAndDocumentText(document) : undefined;
  const effectiveDoc =
    cleanDoc && cleanDoc.trim().length > 0
      ? cleanDoc
      : pdf?.data
      ? extractTextFromPdfBase64(pdf.data)
      : undefined;
  const normalizedMessages = normalizeAlternatingMessages(messages);

  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const timer = setTimeout(cancel, 25000);

  const fallbackConversational = async (): Promise<string> => {
    // 1. Check fast local math solver or exact study-set match first if offline; otherwise call /api/papybot!
    const lastUser = normalizedMessages[normalizedMessages.length - 1]?.content ?? '';
    const localCandidate = answerLocally(normalizedMessages, context, effectiveDoc, extraSets, true);
    if (localCandidate) {
      onText?.(localCandidate);
      return localCandidate;
    }

    try {
      const apiRes = await fetch(resolvePapybotServerlessUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          task: 'chat',
          messages: normalizedMessages,
          query: lastUser,
          context: (context || '/').slice(0, 110),
          ...(effectiveDoc ? { document: effectiveDoc.slice(0, 24000) } : {}),
          ...(image?.data && image.data.length <= 4_400_000 ? { image } : {}),
        }),
      });
      if (apiRes.ok) {
        const json = (await apiRes.json()) as { answer?: unknown };
        if (typeof json.answer === 'string' && json.answer.trim()) {
          onText?.(json.answer);
          return json.answer;
        }
      }
    } catch {
      // Offline or unreachable -> graceful local conversational tutor
    }

    const offlineReply = answerLocally(normalizedMessages, context, effectiveDoc, extraSets, false);
    onText?.(offlineReply);
    return offlineReply;
  };

  try {
    if (!supabase) {
      return await fallbackConversational();
    }

    const client = supabase;
    const { data } = await client.auth.getSession();
    if (!data.session) {
      if (!allowGuestConversational) {
        throw new AppError('authentication', 'Đăng nhập để hỏi Papybot.');
      }
      return await fallbackConversational();
    }

    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    const buildRequestBody = (stream: boolean) => ({
      messages: normalizedMessages,
      context: (context || '/').slice(0, 110),
      ...(effectiveDoc ? { document: effectiveDoc.slice(0, 28000) } : {}),
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
        if (status === 429) {
          throw serviceFailure(status);
        }
        return await fallbackConversational();
      }
      if (typeof result.data?.answer !== 'string' || !result.data.answer.trim()) {
        return await fallbackConversational();
      }
      onText?.(result.data.answer);
      return result.data.answer;
    };

    if (onText && url && key) {
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
        if (response.status === 429) {
          throw serviceFailure(response.status);
        }
        return await fallbackConversational();
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
    return await fallbackConversational();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}
