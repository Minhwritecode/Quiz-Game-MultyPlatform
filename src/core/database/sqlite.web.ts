import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Attempt, QuestionSet } from '@/core/domain/models';

export type WebDatabase = null;

export function getLocalDatabase(): WebDatabase {
  return null;
}

const setsKey = 'papyrus.local.question-sets';
const attemptsKey = 'papyrus.local.attempts';

export async function loadQuestionSets(): Promise<QuestionSet[]> {
  const raw = await AsyncStorage.getItem(setsKey);
  return raw ? JSON.parse(raw) as QuestionSet[] : [];
}

export async function persistQuestionSet(questionSet: QuestionSet): Promise<void> {
  const current = await loadQuestionSets();
  const next = [questionSet, ...current.filter((item) => item.id !== questionSet.id)];
  await AsyncStorage.setItem(setsKey, JSON.stringify(next));
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  const next = [attempt, ...current.filter((item) => item.id !== attempt.id)];
  await AsyncStorage.setItem(attemptsKey, JSON.stringify(next));
}

export async function getLatestAttempt(questionSetId: string): Promise<Attempt | null> {
  const raw = await AsyncStorage.getItem(attemptsKey);
  const current = raw ? JSON.parse(raw) as Attempt[] : [];
  return current.find((attempt) => attempt.questionSetId === questionSetId) ?? null;
}
