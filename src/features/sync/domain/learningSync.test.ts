import { LearningSync, emptyLearningState, type LearningState, type LearningRemote } from './learningSync';
import type { Attempt, SourceDocument } from '@/core/domain/models';

const source: SourceDocument = { id: 'source-1', title: 'Notes', text: 'Original', createdAt: '2026-11-17' };
const attempt: Attempt = {
  id: source.id, questionSetId: 'set-1', score: 100, correctCount: 1, total: 1,
  startedAt: '2026-11-17', finishedAt: '2026-11-17', status: 'completed',
  answers: [{ questionId: 'q-1', chosenIndex: 0, isCorrect: true, timeMs: 10 }],
};
function setup() {
  let id = 0, now = 0;
  const disk = new Map<string, LearningState>();
  // Deliberately return storage references: failed writes must not mutate disk.
  const store = {
    load: jest.fn(async (owner: string) => disk.get(owner) ?? emptyLearningState()),
    save: jest.fn(async (owner: string, state: LearningState) => { disk.set(owner, JSON.parse(JSON.stringify(state))); }),
  };
  const remote: jest.Mocked<LearningRemote> = {
    push: jest.fn(), pull: jest.fn().mockResolvedValue({ documents: [], cursor: '0', hasMore: false }),
  };
  const restart = () => new LearningSync(store, remote, () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`, () => now);
  return { service: restart(), restart, store, remote, tick: () => { now += 100000; } };
}

test('owners and entity identities isolate pending writes, sync and cache clearing', async () => {
  const { service, remote } = setup();
  await service.save('A', 'source_documents', source);
  await service.save('A', 'attempts', attempt);
  await service.save('B', 'source_documents', { ...source, title: 'B notes' });
  expect((await service.list('A')).pending).toHaveLength(2);
  remote.push.mockImplementation(async (_owner, item) => ({ conflict: false, document: { ...item.document, revision: '1' } }));
  await service.sync('B');
  expect(remote.push.mock.calls.map(([owner]) => owner)).toEqual(['B']);
  expect(remote.pull).toHaveBeenCalledWith('B', '0');
  await service.clearAccountCache('B');
  expect(await service.list('B')).toEqual(emptyLearningState());
  expect((await service.list('A')).pending).toHaveLength(2);
  await expect(service.save(' ', 'source_documents', source)).rejects.toMatchObject({ code: 'authentication' });
});

test('save snapshots nested input at invocation and list returns detached data', async () => {
  const { service } = setup();
  const input = JSON.parse(JSON.stringify(attempt)) as Attempt;
  const write = service.save('A', 'attempts', input);
  input.answers[0]!.chosenIndex = 3;
  input.answers.push({ ...input.answers[0]! });
  await write;
  const state = await service.list('A');
  expect(state.documents[0]?.payload).toEqual(attempt);
  state.documents[0]!.payload.id = 'changed';
  expect((await service.list('A')).documents[0]?.id).toBe(attempt.id);
});

test('offline edits and deletes coalesce only the same entity identity', async () => {
  const { service } = setup();
  await service.save('A', 'source_documents', source);
  await service.save('A', 'attempts', attempt);
  const first = (await service.list('A')).pending[0]!;
  await service.save('A', 'source_documents', { ...source, text: 'Edited offline' });
  const edit = (await service.list('A')).pending.find(item => item.document.entity === 'source_documents')!;
  expect(edit.mutationId).not.toBe(first.mutationId);
  expect(edit.baseRevision).toBe('0');
  await service.remove('A', 'source_documents', source.id);
  const state = await service.list('A');
  expect(state.pending).toHaveLength(2);
  expect(state.pending.find(item => item.document.entity === 'source_documents')).toMatchObject({
    baseRevision: '0', document: { deleted: true, payload: { text: 'Edited offline' } },
  });
  expect(state.pending.find(item => item.document.entity === 'attempts')?.document.deleted).toBe(false);
});

test('retry backoff and restart replay the exact UUID and transport document', async () => {
  const { service, restart, remote, tick } = setup();
  await service.save('A', 'source_documents', source);
  const original = (await service.list('A')).pending[0]!;
  remote.push.mockRejectedValueOnce(new Error('lost response'));
  await expect(service.sync('A')).rejects.toThrow();
  await restart().sync('A');
  expect(remote.push).toHaveBeenCalledTimes(1);
  tick();
  remote.push.mockResolvedValue({ conflict: false, document: { ...original.document, revision: '1' } });
  await restart().sync('A');
  expect(remote.push.mock.calls[1]?.[1]).toEqual({ ...original, failures: 1, retryAt: 2000 });
  expect((await service.list('A')).pending).toEqual([]);
});

test('failed durable acknowledgement stops pulling and restart replays the committed mutation', async () => {
  const { service, restart, remote, store } = setup();
  await service.save('A', 'source_documents', source);
  const before = await service.list('A');
  const original = before.pending[0]!;
  remote.push.mockResolvedValue({ conflict: false, document: { ...original.document, revision: '7' } });
  store.save.mockRejectedValueOnce(new Error('disk full'));
  await expect(service.sync('A')).rejects.toThrow();
  expect(remote.pull).not.toHaveBeenCalled();
  expect(await service.list('A')).toEqual(before);
  await restart().sync('A');
  expect(remote.push.mock.calls.map(([, item]) => item)).toEqual([original, original]);
  expect((await service.list('A')).documents[0]?.revision).toBe('7');
  expect((await service.list('A')).pending).toEqual([]);
});

test('editing after an ambiguous commit uses a new UUID and old base, preserving local conflict', async () => {
  const { service, remote } = setup();
  await service.save('A', 'source_documents', source);
  const original = (await service.list('A')).pending[0]!;
  const server = { ...original.document, revision: '8' };
  remote.push.mockRejectedValueOnce(new Error('committed but response lost'));
  await expect(service.sync('A')).rejects.toThrow();
  await service.save('A', 'source_documents', { ...source, text: 'New local edit' });
  const replacement = (await service.list('A')).pending[0]!;
  expect(replacement).toMatchObject({ baseRevision: original.baseRevision, failures: 0, retryAt: 0 });
  expect(replacement.mutationId).not.toBe(original.mutationId);
  remote.push.mockResolvedValue({ conflict: true, document: server });
  remote.pull.mockResolvedValue({ documents: [server], cursor: '8', hasMore: false });
  await service.sync('A');
  const conflicted = await service.list('A');
  expect(conflicted.documents[0]?.payload).toMatchObject({ text: 'New local edit' });
  expect(conflicted.pending[0]?.conflict).toEqual(server);
  await expect(service.save('A', 'source_documents', source)).rejects.toThrow('conflict');
  await expect(service.remove('A', 'source_documents', source.id)).rejects.toThrow('conflict');
  expect(await service.list('A')).toEqual(conflicted);
  await service.resolve('A', 'source_documents', source.id, 'local');
  const resolved = (await service.list('A')).pending[0]!;
  expect(resolved.baseRevision).toBe('8');
  expect(resolved.mutationId).not.toBe(replacement.mutationId);
  expect(resolved.document.payload).toMatchObject({ text: 'New local edit' });
});

test('tombstones survive acknowledgement and remote pull without resurrection', async () => {
  const { service, remote } = setup();
  await service.save('A', 'source_documents', source);
  await service.remove('A', 'source_documents', source.id);
  const tombstone = (await service.list('A')).pending[0]!.document;
  remote.push.mockResolvedValue({ conflict: false, document: { ...tombstone, revision: '2' } });
  remote.pull.mockResolvedValue({ documents: [{ ...tombstone, revision: '2' }], cursor: '2', hasMore: false });
  await service.sync('A');
  expect((await service.list('A')).documents).toEqual([{ ...tombstone, revision: '2' }]);
  expect((await service.list('A')).pending).toEqual([]);
});

test.each([{ cursor: '9', hasMore: false }, { cursor: '10', hasMore: true }, { cursor: '010', hasMore: true }])(
  'rejects regressing or stalled cursor %j without persisting the page', async page => {
    const { service, remote, store } = setup();
    await store.save('A', { ...emptyLearningState(), cursor: '10' });
    remote.pull.mockResolvedValue({ ...page, documents: [{ entity: 'source_documents', id: source.id, payload: source, deleted: true, revision: '11', updatedAt: 'now' }] });
    await expect(service.sync('A')).rejects.toThrow('invalid cursor');
    expect(await service.list('A')).toEqual({ ...emptyLearningState(), cursor: '10' });
  },
);
