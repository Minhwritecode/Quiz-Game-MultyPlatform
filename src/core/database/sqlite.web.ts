import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Attempt, QuestionSet, SyncItem } from '@/core/domain/models';

export type WebDatabase = null;

export function getLocalDatabase(): WebDatabase {
  return null;
}

const setsKey = 'papyrus.local.question-sets';
const attemptsKey = 'papyrus.local.attempts';
const syncKey = 'papyrus.local.sync-queue';

export async function loadQuestionSets(): Promise<QuestionSet[]> {
  const raw = await AsyncStorage.getItem(setsKey);
  return raw ? JSON.parse(raw) as QuestionSet[] : [];
}

export async function persistQuestionSet(questionSet: QuestionSet): Promise<void> {
  const current = await loadQuestionSets();
  const next = [questionSet, ...current.filter((item) => item.id !== questionSet.id)];
  await AsyncStorage.setItem(setsKey, JSON.stringify(next));
  await appendSyncItem({ entity: 'question_sets', entityId: questionSet.id, operation: current.some((item) => item.id === questionSet.id) ? 'update' : 'insert', payload: questionSet as unknown as Record<string, unknown> });
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  const next = [attempt, ...current.filter((item) => item.id !== attempt.id)];
  await AsyncStorage.setItem(attemptsKey, JSON.stringify(next));
  await appendSyncItem({ entity: 'attempts', entityId: attempt.id, operation: 'insert', payload: attempt as unknown as Record<string, unknown> });
}

export async function getLatestAttempt(questionSetId: string): Promise<Attempt | null> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  return current.find((attempt) => attempt.questionSetId === questionSetId) ?? null;
}

async function appendSyncItem(input: Omit<SyncItem, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const raw = await AsyncStorage.getItem(syncKey);
  const current = raw ? JSON.parse(raw) as SyncItem[] : [];
  const next: SyncItem[] = [...current.filter((item) => !(item.entity === input.entity && item.entityId === input.entityId)), { ...input, id: Date.now(), createdAt: new Date().toISOString(), retryCount: 0 }];
  await AsyncStorage.setItem(syncKey, JSON.stringify(next));
}

export async function loadSyncItems(): Promise<SyncItem[]> {
  const raw = await AsyncStorage.getItem(syncKey);
  return raw ? JSON.parse(raw) as SyncItem[] : [];
}

export async function acknowledgeSyncItem(id: number): Promise<void> {
  const next = (await loadSyncItems()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(syncKey, JSON.stringify(next));
}

export async function markSyncItemRetry(id: number): Promise<void> {
  const next = (await loadSyncItems()).map((item) => item.id === id ? { ...item, retryCount: item.retryCount + 1 } : item);
  await AsyncStorage.setItem(syncKey, JSON.stringify(next));
}
