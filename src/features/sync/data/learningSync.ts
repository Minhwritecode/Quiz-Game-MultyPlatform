import { randomUUID } from 'expo-crypto';
import { AppError } from '@/core/domain/failure';
import { supabase } from '@/core/network/supabase';
import { LearningSync, learningPushSchema, learningPullSchema, type LearningRemote } from '../domain/learningSync';
import { learningStorage } from './learningStorage';

async function rpc(owner: string, name: string, args: object): Promise<unknown> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabase || !url || !apiKey) throw new AppError('unavailable', 'Learning sync is not configured.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Bound session lookup, fetch and response decoding together.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AppError('unavailable', 'Learning sync timed out. Please try again.'));
    }, 15000);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (controller.signal.aborted) throw new AppError('unavailable', 'Learning sync timed out. Please try again.');
      if (error || !data.session || data.session.user.id !== owner) {
        throw new AppError('authentication', 'Sign in to the account that owns this queue.');
      }
      // Bind this request to the verified owner even if another account signs in mid-request.
      const token = data.session.access_token;
      const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', apikey: apiKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify(args),
      });
      if (!response.ok) {
        throw new AppError(response.status === 401 || response.status === 403 ? 'authentication' : 'unavailable',
          'Learning sync failed. Sign in to the owning account and try again.');
      }
      return await response.json() as unknown;
    })()]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('unavailable', 'Learning sync could not connect. Please try again.');
  } finally { clearTimeout(timer); }
}
function validate<T>(schema: { safeParse(value: unknown): { success: boolean } }, value: unknown): T {
  if (!schema.safeParse(value).success) throw new AppError('unavailable', 'Learning sync received an invalid response. Please try again.');
  // Validation must not transform the server document, including unknown transport fields.
  return value as T;
}
export const learningRemote: LearningRemote = {
  async push(owner, item) {
    return validate<Awaited<ReturnType<LearningRemote['push']>>>(learningPushSchema, await rpc(owner, 'sync_push_learning', {
      mutation_id: item.mutationId, base_revision: item.baseRevision, entity: item.document.entity, document: item.document,
    }));
  },
  async pull(owner, cursor) {
    return validate<Awaited<ReturnType<LearningRemote['pull']>>>(learningPullSchema, await rpc(owner, 'sync_pull_learning', { after_revision: cursor }));
  },
};
export const learningSync = new LearningSync(learningStorage, learningRemote, randomUUID);
