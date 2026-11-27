import { AppError } from '@/core/domain/failure';
import { isValidQuestion, type GenerationRequest, type Question } from '@/core/domain/models';

export type GenerationJobStatus = 'queued' | 'running' | 'failed' | 'completed' | 'cancelled';
export type GenerationSetMetadata = { title: string; subject: string; tags: string[]; sourceDocumentId: string | null; sourceDocumentTitle: string };
export type GenerationReview = { metadata: GenerationSetMetadata; questions: Question[]; count: number };
export type GenerationJob = {
  id: string;
  requestId: string;
  ownerId: string;
  request: GenerationRequest;
  metadata: GenerationSetMetadata;
  status: GenerationJobStatus;
  attempt: number;
  retryAt: number;
  createdAt: number;
  updatedAt: number;
  questions: Question[];
  initialQuestions: Question[];
  replaceQuestionId?: string;
  draftSetId?: string;
  review?: GenerationReview;
  error?: string;
};
export interface GenerationJobStore {
  load(owner: string): Promise<GenerationJob[]>;
  save(owner: string, jobs: GenerationJob[]): Promise<void>;
}

/** Device-local, owner-scoped job journal. Each provider attempt gets a quota key. */
export class GenerationJobs {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly store: GenerationJobStore,
    private readonly uuid: () => string,
    private readonly now: () => number = Date.now,
  ) {}

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work, work);
    this.tail = next.catch(() => undefined);
    return next;
  }

  list(owner: string): Promise<GenerationJob[]> {
    return this.exclusive(() => this.store.load(owner));
  }

  enqueue(owner: string, request: GenerationRequest, metadata: GenerationSetMetadata, initialQuestions: Question[] = [], replaceQuestionId?: string, draftSetId?: string): Promise<GenerationJob> {
    return this.exclusive(async () => {
      const now = this.now();
      const jobs = (await this.store.load(owner)).filter(job => job.status !== 'cancelled');
      if (!request.sourceText.trim() || request.sourceText.length > 30_000) throw new AppError('validation', 'Source must contain 1–30,000 characters.');
      const previous = draftSetId ? jobs.find(job => (job.draftSetId ?? job.id) === draftSetId) : undefined;
      if (previous?.status === 'running') throw new AppError('validation', 'Generation is already running for this draft.');
      if (jobs.length >= 8 && !previous) {
        throw new AppError('validation', 'Generation queue is full. Save or remove an old draft before adding another.');
      }
      const job: GenerationJob = {
        id: this.uuid(), requestId: this.uuid(), ownerId: owner, request, metadata, status: 'queued', attempt: 0,
        retryAt: 0, createdAt: now, updatedAt: now, questions: [], initialQuestions, replaceQuestionId, draftSetId,
      };
      await this.store.save(owner, [job, ...jobs.filter(item => item.id !== previous?.id)]);
      return job;
    });
  }

  recover(owner: string, activeJobs: ReadonlySet<string> = new Set()): Promise<GenerationJob[]> {
    return this.exclusive(async () => {
      const jobs = (await this.store.load(owner)).map(job => job.status === 'running' && !activeJobs.has(job.id)
        ? { ...job, status: 'queued' as const, retryAt: 0, updatedAt: this.now(), error: 'Generation interrupted. Ready to resume.' }
        : job);
      await this.store.save(owner, jobs);
      return jobs;
    });
  }

  update(owner: string, id: string, change: (job: GenerationJob) => GenerationJob): Promise<GenerationJob | null> {
    return this.exclusive(async () => {
      const jobs = await this.store.load(owner);
      const index = jobs.findIndex(job => job.id === id && job.ownerId === owner);
      if (index < 0) return null;
      const updated = { ...change(jobs[index]!), updatedAt: this.now() };
      jobs[index] = updated;
      await this.store.save(owner, jobs);
      return updated;
    });
  }

  async markRunning(owner: string, id: string): Promise<GenerationJob | null> {
    const requestId = this.uuid();
    const job = await this.update(owner, id, current => current.status === 'queued' || current.status === 'failed'
      ? { ...current, requestId, status: 'running', attempt: current.attempt + 1, error: undefined }
      : current);
    return job?.requestId === requestId ? job : null;
  }

  appendQuestion(owner: string, id: string, question: Question, requestId?: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => {
      if (!isValidQuestion(question) || job.status !== 'running' || (requestId && job.requestId !== requestId)
        || job.questions.length >= job.request.questionCount) return job;
      const normalized = question.content.trim().toLocaleLowerCase();
      const existing = job.review?.questions ?? job.initialQuestions;
      if (job.questions.some(item => item.id === question.id || item.content.trim().toLocaleLowerCase() === normalized)
        || existing.some(item => item.id !== job.replaceQuestionId && (item.id === question.id || item.content.trim().toLocaleLowerCase() === normalized))) return job;
      const review = job.review && {
        ...job.review,
        questions: job.replaceQuestionId
          ? existing.map(item => item.id === job.replaceQuestionId ? { ...question, position: item.position } : item)
          : [...existing, { ...question, position: existing.length }],
      };
      return { ...job, review, questions: [...job.questions, { ...question, position: job.questions.length }] };
    });
  }

  saveReview(owner: string, id: string, review: GenerationReview): Promise<GenerationJob | null> {
    return this.update(owner, id, job => job.status === 'running' || job.status === 'cancelled' ? job : { ...job, review });
  }

  interrupt(owner: string, id: string, requestId: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => job.status === 'running' && job.requestId === requestId
      ? { ...job, status: 'queued', retryAt: 0, error: 'Generation interrupted. Ready to resume.' } : job);
  }

  fail(owner: string, id: string, error: string, requestId?: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => job.status !== 'running' || (requestId && job.requestId !== requestId) ? job : ({
      ...job, status: 'failed', error,
      retryAt: this.now() + Math.min(300_000, 2_000 * 2 ** Math.min(job.attempt - 1, 7)),
    }));
  }

  complete(owner: string, id: string, requestId?: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => job.status !== 'running' || (requestId && job.requestId !== requestId)
      ? job : { ...job, status: 'completed', retryAt: 0, error: undefined });
  }

  retry(owner: string, id: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => ['failed', 'queued'].includes(job.status)
      ? { ...job, status: 'queued', retryAt: 0, error: undefined } : job);
  }

  cancel(owner: string, id: string): Promise<GenerationJob | null> {
    return this.update(owner, id, job => ['queued', 'running', 'failed'].includes(job.status)
      ? { ...job, status: 'cancelled', retryAt: 0, error: undefined } : job);
  }

  remove(owner: string, id: string): Promise<void> {
    return this.exclusive(async () => {
      const jobs = await this.store.load(owner);
      await this.store.save(owner, jobs.filter(job => job.id !== id));
    });
  }

  clearCompleted(owner: string): Promise<void> {
    return this.exclusive(async () => {
      const jobs = await this.store.load(owner);
      await this.store.save(owner, jobs.filter(job => job.status !== 'completed'));
    });
  }
}
