import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { GenerationJobs, type GenerationJobStore } from '../domain/generationJobs';
import { randomUUID } from 'expo-crypto';

const question = z.object({
  id: z.string(), content: z.string(), options: z.array(z.string()), correctIndex: z.number(),
  explanation: z.string(), position: z.number(),
});
const job = z.object({
  id: z.string().uuid(), requestId: z.string().uuid(), ownerId: z.string().uuid(),
  metadata: z.object({ title: z.string().max(160), subject: z.string().max(100), tags: z.array(z.string().max(30)).max(10), sourceDocumentId: z.string().uuid().nullable(), sourceDocumentTitle: z.string().max(160) }),
  request: z.object({ sourceText: z.string().min(1).max(30000), questionCount: z.number().int().min(1).max(30),
    difficulty: z.enum(['easy', 'medium', 'hard']), languageCode: z.enum(['vi', 'en']), excludeQuestions: z.array(z.string()).max(30).optional() }),
  status: z.enum(['queued', 'running', 'failed', 'completed', 'cancelled']),
  attempt: z.number().int().nonnegative(), retryAt: z.number().nonnegative(), createdAt: z.number(),
  updatedAt: z.number(), questions: z.array(question), initialQuestions: z.array(question).default([]),
  replaceQuestionId: z.string().optional(), error: z.string().optional(),
});
const key = (owner: string) => 'papyrus.generation-jobs.v1:' + owner;

export const generationJobStore: GenerationJobStore = {
  async load(owner) {
    try {
      const raw = await AsyncStorage.getItem(key(owner));
      if (!raw) return [];
      const parsed = z.array(job).max(8).safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data.filter(item => item.ownerId === owner) : [];
    } catch { return []; }
  },
  async save(owner, jobs) {
    await AsyncStorage.setItem(key(owner), JSON.stringify(jobs.filter(item => item.ownerId === owner).slice(0, 8)));
  },
};

export const generationJobs = new GenerationJobs(generationJobStore, randomUUID);

export async function clearGenerationJobs(owner: string): Promise<void> {
  await AsyncStorage.removeItem(key(owner));
}
