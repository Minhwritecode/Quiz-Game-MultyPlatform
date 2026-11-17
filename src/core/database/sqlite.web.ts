import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Attempt, QuestionSet, StudyProgress, SyncItem } from '@/core/domain/models';

export type WebDatabase = null;

export function getLocalDatabase(): WebDatabase {
  return null;
}

const setsKey = 'papyrus.local.question-sets';
const attemptsKey = 'papyrus.local.attempts';
const syncKey = 'papyrus.local.sync-queue';
const progressKey = 'papyrus.local.study-progress';

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

export async function removeQuestionSet(questionSetId: string): Promise<void> {
  const current = await loadQuestionSets();
  const removed = current.find((item) => item.id === questionSetId);
  if (!removed) return;
  await AsyncStorage.setItem(setsKey, JSON.stringify(current.filter((item) => item.id !== questionSetId)));
  await appendSyncItem({ entity: 'question_sets', entityId: questionSetId, operation: 'delete', payload: { id: questionSetId, title: removed.title } });
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
  return current.filter((attempt) => attempt.questionSetId === questionSetId).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0] ?? null;
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  return current.find((attempt) => attempt.id === attemptId) ?? null;
}

export async function listAttempts(): Promise<Attempt[]> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  return current.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
}

async function readProgress(): Promise<StudyProgress[]> {
  const raw = await AsyncStorage.getItem(progressKey);
  return raw ? JSON.parse(raw) as StudyProgress[] : [];
}

export async function getProgress(questionSetId: string): Promise<StudyProgress | null> {
  return (await readProgress()).find((item) => item.questionSetId === questionSetId) ?? null;
}

export async function listProgress(): Promise<StudyProgress[]> {
  return (await readProgress()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProgress(progress: StudyProgress): Promise<void> {
  const current = await readProgress();
  await AsyncStorage.setItem(progressKey, JSON.stringify([progress, ...current.filter((item) => item.questionSetId !== progress.questionSetId)]));
}

export async function clearProgress(questionSetId: string): Promise<void> {
  await AsyncStorage.setItem(progressKey, JSON.stringify((await readProgress()).filter((item) => item.questionSetId !== questionSetId)));
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
