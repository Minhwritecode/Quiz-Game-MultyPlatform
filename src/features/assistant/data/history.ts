import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from './chat';
import type { Conversation } from '../domain/repository';
export type { Conversation } from '../domain/repository';
const key = (user: string) => `papybot:history:v1:${user}`;
let pending: Promise<unknown> = Promise.resolve();
export async function loadHistory(user: string): Promise<Conversation[]> {
  await pending.catch(() => undefined);
  const raw = await AsyncStorage.getItem(key(user));
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((c): c is Conversation => typeof c?.id === 'string' && Number.isFinite(c.updatedAt) && Array.isArray(c.messages) && c.messages.length <= 20 && c.messages.length % 2 === 0 && c.messages.every((m: ChatMessage, i: number) => m?.role === (i % 2 ? 'assistant' : 'user') && typeof m.content === 'string' && m.content.length <= 4000)).slice(0, 20);
  } catch { return []; }
}
export function saveHistory(user: string, conversations: Conversation[]): Promise<void> {
  const value = JSON.stringify(conversations.slice(0, 20));
  const write = pending.catch(() => undefined).then(() => AsyncStorage.setItem(key(user), value));
  pending = write;
  return write;
}
