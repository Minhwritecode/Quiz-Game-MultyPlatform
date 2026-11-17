import { z } from 'zod';
import { AppError } from '@/core/domain/failure';
import type { Attempt, SourceDocument } from '@/core/domain/models';

export type LearningPayloads = { source_documents: SourceDocument; attempts: Attempt };
export type LearningEntity = keyof LearningPayloads;
const idSchema = z.string().min(1);
const revisionSchema = z.string().regex(/^\d+$/);
const sourceSchema = z.object({ id: idSchema, title: z.string(), text: z.string(), createdAt: z.string() }).passthrough();
const answerSchema = z.object({ questionId: idSchema, chosenIndex: z.number().int().nonnegative().nullable(), isCorrect: z.boolean(), timeMs: z.number().nonnegative() }).passthrough();
const attemptSchema = z.object({
  id: idSchema, questionSetId: idSchema, score: z.number(), correctCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(), startedAt: z.string(), finishedAt: z.string(),
  status: z.literal('completed'), answers: z.array(answerSchema),
}).passthrough();
const envelope = { id: idSchema, revision: revisionSchema, updatedAt: z.string(), deleted: z.boolean() };
export const learningDocumentSchema = z.discriminatedUnion('entity', [
  z.object({ ...envelope, entity: z.literal('source_documents'), payload: sourceSchema }).passthrough(),
  z.object({ ...envelope, entity: z.literal('attempts'), payload: attemptSchema }).passthrough(),
]).refine(document => document.id === document.payload.id, 'Payload identity does not match envelope.');
export type LearningDocument<E extends LearningEntity = LearningEntity> = {
  [K in E]: { entity: K; id: string; revision: string; updatedAt: string; deleted: boolean; payload: LearningPayloads[K] }
}[E];
export const pendingLearningSchema = z.object({
  mutationId: z.string().uuid(), baseRevision: revisionSchema, document: learningDocumentSchema,
  failures: z.number().int().nonnegative(), retryAt: z.number().nonnegative(), conflict: learningDocumentSchema.optional(),
}).refine(item => !item.conflict || (item.conflict.entity === item.document.entity && item.conflict.id === item.document.id));
export type PendingLearning = z.infer<typeof pendingLearningSchema>;
export const learningStateSchema = z.object({
  cursor: revisionSchema, documents: z.array(learningDocumentSchema), pending: z.array(pendingLearningSchema),
});
export type LearningState = z.infer<typeof learningStateSchema>;
export const emptyLearningState = (): LearningState => ({ cursor: '0', documents: [], pending: [] });
export const learningPushSchema = z.object({ conflict: z.boolean(), document: learningDocumentSchema });
export const learningPullSchema = z.object({ documents: z.array(learningDocumentSchema), cursor: revisionSchema, hasMore: z.boolean() });
export interface LearningStore {
  load(owner: string): Promise<LearningState>;
  /** Atomically replace the entire envelope; a rejected write must retain the previous envelope. */
  save(owner: string, state: LearningState): Promise<void>;
}
export interface LearningRemote {
  push(owner: string, item: PendingLearning): Promise<z.infer<typeof learningPushSchema>>;
  pull(owner: string, cursor: string): Promise<z.infer<typeof learningPullSchema>>;
}
const same = (a: { entity: LearningEntity; id: string }, b: { entity: LearningEntity; id: string }) => a.entity === b.entity && a.id === b.id;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** All operations, including reads and cache clearing, share a single serialization queue. */
export class LearningSync {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private store: LearningStore, private remote: LearningRemote, private uuid: () => string, private now: () => number = Date.now) {}

  private exclusive<T>(owner: string, operation: () => Promise<T>): Promise<T> {
    const job = this.tail.then(async () => {
      if (!owner.trim()) throw new AppError('authentication', 'Sign in to the account that owns this queue.');
      try { return await operation(); }
      catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('unavailable', 'Learning sync could not complete. Saved pending changes remain on this device.');
      }
    });
    this.tail = job.catch(() => undefined);
    return job;
  }
  private async load(owner: string): Promise<LearningState> {
    // Never mutate a storage adapter's references before a durable write succeeds.
    const state = await this.store.load(owner);
    learningStateSchema.parse(state);
    return copy(state);
  }
  private put(state: LearningState, document: LearningDocument) {
    state.documents = [document, ...state.documents.filter(value => !same(value, document))];
  }
  private enqueue(state: LearningState, document: LearningDocument) {
    const previous = state.pending.find(item => same(item.document, document));
    if (previous?.conflict) {
      throw new AppError('conflict', 'Resolve the existing conflict before editing this document.');
    }
    learningDocumentSchema.parse(document);
    // A replacement is a new mutation, but never assumes an unacknowledged write
    // succeeded. If it did commit remotely, this original base produces a conflict.
    const item = { mutationId: this.uuid(), baseRevision: previous?.baseRevision ?? document.revision, document, failures: 0, retryAt: 0 };
    pendingLearningSchema.parse(item);
    state.pending = state.pending.filter(value => !same(value.document, document));
    state.pending.push(item);
    this.put(state, document);
  }
  list(owner: string): Promise<LearningState> { return this.exclusive(owner, () => this.load(owner)); }
  clearAccountCache(owner: string): Promise<void> { return this.exclusive(owner, () => this.store.save(owner, emptyLearningState())); }

  save<E extends LearningEntity>(owner: string, entity: E, payload: LearningPayloads[E]): Promise<void> {
    // Snapshot at invocation: callers cannot change a queued write by mutating its payload.
    const snapshot = copy(payload);
    return this.exclusive(owner, async () => {
      const state = await this.load(owner);
      const existing = state.documents.find(value => same(value, { entity, id: snapshot.id }));
      const document = { entity, id: snapshot.id, revision: existing?.revision ?? '0', updatedAt: new Date(this.now()).toISOString(), deleted: false, payload: snapshot } as LearningDocument;
      this.enqueue(state, document);
      await this.store.save(owner, state);
    });
  }
  remove(owner: string, entity: LearningEntity, id: string): Promise<void> {
    return this.exclusive(owner, async () => {
      const state = await this.load(owner);
      const existing = state.documents.find(value => same(value, { entity, id }));
      if (!existing) throw new AppError('validation', 'Learning document not found.');
      this.enqueue(state, { ...existing, deleted: true, updatedAt: new Date(this.now()).toISOString() });
      await this.store.save(owner, state);
    });
  }
  resolve(owner: string, entity: LearningEntity, id: string, choice: 'local' | 'server'): Promise<void> {
    return this.exclusive(owner, async () => {
      const state = await this.load(owner);
      const item = state.pending.find(value => same(value.document, { entity, id }));
      if (!item?.conflict) throw new AppError('conflict', 'No conflict to resolve.');
      state.pending = state.pending.filter(value => value !== item);
      if (choice === 'server') this.put(state, item.conflict);
      else this.enqueue(state, { ...item.document, revision: item.conflict.revision, updatedAt: new Date(this.now()).toISOString() });
      await this.store.save(owner, state);
    });
  }
  sync(owner: string): Promise<LearningState> {
    return this.exclusive(owner, async () => {
      const state = await this.load(owner);
      for (const item of [...state.pending]) {
        if (item.conflict || item.retryAt > this.now()) continue;
        let reply: Awaited<ReturnType<LearningRemote['push']>>;
        try {
          // The mutation UUID and original transport document are already durable.
          reply = await this.remote.push(owner, copy(item));
          learningPushSchema.parse(reply);
          if (!same(reply.document, item.document)) throw new Error('Unexpected response identity.');
        } catch (error) {
          item.failures++;
          item.retryAt = this.now() + Math.min(60000, 1000 * 2 ** Math.min(item.failures, 6));
          await this.store.save(owner, state);
          throw error;
        }
        if (reply.conflict) item.conflict = reply.document;
        else {
          state.pending = state.pending.filter(value => value.mutationId !== item.mutationId);
          this.put(state, reply.document);
        }
        // Do not pull or process another mutation unless this acknowledgement is durable.
        // On failure the old disk envelope replays the exact same UUID on the next sync.
        await this.store.save(owner, state);
      }
      let more = true;
      while (more) {
        const page = await this.remote.pull(owner, state.cursor);
        learningPullSchema.parse(page);
        if (BigInt(page.cursor) < BigInt(state.cursor) || (page.hasMore && BigInt(page.cursor) === BigInt(state.cursor))) {
          throw new AppError('unavailable', 'The sync server returned an invalid cursor. Please try again later.');
        }
        for (const document of page.documents) {
          if (!state.pending.some(item => same(item.document, document))) this.put(state, document);
        }
        state.cursor = page.cursor;
        more = page.hasMore;
        await this.store.save(owner, state);
      }
      return copy(state);
    });
  }
}
