import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { GenerationJobs, type GenerationJobStore } from '../domain/generationJobs';
import { randomUUID } from 'expo-crypto';

const question = z.object({
  id: z.string(), content: z.string(), options: z.array(z.string()), correctIndex: z.number(),
  explanation: z.string(), position: z.number(),
  questionType: z.enum(['multiple_choice', 'true_false', 'poll', 'word_cloud', 'rating', 'open_text']).optional(),
  multiSelect: z.boolean().optional(), correctIndices: z.array(z.number()).optional(),
  ratingMax: z.union([z.literal(5), z.literal(10)]).optional(),
  ratingLabels: z.object({ low: z.string(), high: z.string() }).optional(),
  codeSnippet: z.string().optional(),
});
const metadata = z.object({ title: z.string().max(160), subject: z.string().max(100), tags: z.array(z.string().max(30)).max(10), sourceDocumentId: z.string().nullable(), sourceDocumentTitle: z.string() });
const job = z.object({
  id: z.string().uuid(), requestId: z.string().uuid(), ownerId: z.string().uuid(),
  metadata,
  request: z.object({ sourceText: z.string().min(1).max(30000), questionCount: z.number().int().min(1).max(30),
    difficulty: z.enum(['easy', 'medium', 'hard']), languageCode: z.enum(['vi', 'en']), excludeQuestions: z.array(z.string()).max(30).optional() }),
  status: z.enum(['queued', 'running', 'failed', 'completed', 'cancelled']),
  attempt: z.number().int().nonnegative(), retryAt: z.number().nonnegative(), createdAt: z.number(),
  updatedAt: z.number(), questions: z.array(question), initialQuestions: z.array(question).default([]),
  replaceQuestionId: z.string().optional(), error: z.string().optional(),
  draftSetId: z.string().optional(),
  review: z.object({ metadata, questions: z.array(question), count: z.number().int().min(1).max(30) }).optional(),
});
const key = (owner: string) => 'papyrus.generation-jobs.v1:' + owner;

export const generationJobStore: GenerationJobStore = {
  async load(owner) {
    try {
      const raw = await AsyncStorage.getItem(key(owner));
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 8).flatMap(item => {
        const result = job.safeParse(item);
        return result.success && result.data.ownerId === owner ? [result.data] : [];
      });
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
