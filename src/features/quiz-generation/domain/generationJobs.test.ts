import { GenerationJobs, type GenerationJob, type GenerationJobStore } from './generationJobs';
import type { GenerationRequest } from '@/core/domain/models';

const request: GenerationRequest = { sourceText: 'Reviewed notes', questionCount: 2, difficulty: 'medium', languageCode: 'vi' };
const metadata = { title: 'Study notes', subject: 'Biology', tags: ['cells'], sourceDocumentId: null, sourceDocumentTitle: '' };
function fixture() {
  const state: { jobs: GenerationJob[] } = { jobs: [] };
  const store: GenerationJobStore = {
    load: async owner => state.jobs.filter(job => job.ownerId === owner).map(job => structuredClone(job)),
    save: async (owner, jobs) => { state.jobs = [...state.jobs.filter(job => job.ownerId !== owner), ...structuredClone(jobs)]; },
  };
  let id = 0;
  const queue = new GenerationJobs(store, () => '00000000-0000-4000-8000-' + String(++id).padStart(12, '0'), () => 1000);
  return { queue, state };
}

test('jobs are account isolated and interrupted generation can recover for retry', async () => {
  const { queue } = fixture();
  const created = await queue.enqueue('owner-a', request, metadata);
  const firstRequestId=created.requestId;
  await queue.markRunning('owner-a', created.id);
  expect((await queue.list('owner-a'))[0]?.requestId).not.toBe(firstRequestId);
  expect(await queue.list('owner-b')).toEqual([]);
  expect((await queue.recover('owner-a'))[0]).toMatchObject({ id: created.id, status: 'queued', attempt: 1 });
});

test('failed jobs use bounded backoff; retry gets a fresh quota request ID and cancellation persists', async () => {
  const { queue } = fixture();
  const created = await queue.enqueue('owner-a', request, metadata);
  await queue.markRunning('owner-a', created.id);
  const firstRequestId=(await queue.list('owner-a'))[0]!.requestId;
  const failed = await queue.fail('owner-a', created.id, 'offline');
  expect(failed?.retryAt).toBe(3000);
  expect((await queue.retry('owner-a', created.id))?.id).toBe(created.id);
  await queue.markRunning('owner-a', created.id);
  expect((await queue.list('owner-a'))[0]?.requestId).not.toBe(firstRequestId);
  expect((await queue.cancel('owner-a', created.id))?.status).toBe('cancelled');
  expect((await queue.list('owner-a'))[0]?.request).toEqual(request);
});

test('partial questions survive failure and duplicate replay does not duplicate them', async () => {
  const { queue } = fixture();
  const created = await queue.enqueue('owner-a', request, metadata);
  await queue.markRunning('owner-a', created.id);
  const question = { id: 'q1', content: 'Question?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'A', position: 0 };
  await queue.appendQuestion('owner-a', created.id, question);
  await queue.appendQuestion('owner-a', created.id, question);
  await queue.appendQuestion('owner-a', created.id, { ...question, id: 'another-id' });
  expect((await queue.list('owner-a'))[0]?.questions).toHaveLength(1);
});


test('cancellation prevents late stream writes and the queue enforces its requested count', async () => {
  const { queue } = fixture();
  const job = await queue.enqueue('owner-a', { ...request, questionCount: 1 }, metadata);
  await queue.markRunning('owner-a', job.id);
  const q = { id: 'q1', content: 'First?', options: ['A','B','C','D'], correctIndex: 0, explanation: 'A', position: 0 };
  await queue.appendQuestion('owner-a', job.id, q);
  await queue.appendQuestion('owner-a', job.id, { ...q, id: 'q2', content: 'Second?' });
  expect((await queue.list('owner-a'))[0]?.questions).toHaveLength(1);
  await queue.cancel('owner-a', job.id);
  await queue.appendQuestion('owner-a', job.id, { ...q, id: 'q3', content: 'Late?' });
  expect((await queue.list('owner-a'))[0]?.questions).toHaveLength(1);
});
