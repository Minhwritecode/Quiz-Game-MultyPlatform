import type { QuestionSet } from '@/core/domain/models';

jest.mock('@/core/data/seed', () => ({ seedQuestionSets: [] }));
jest.mock('@/features/sync/data/cloudSets', () => ({
  cloudSets: { list: jest.fn(), sync: jest.fn() },
}));
jest.mock('@/features/sync/data/learningSync', () => ({
  learningSync: { sync: jest.fn() },
}));
jest.mock('@/features/question-sets/data/persistence', () => ({
  questionSetRepository: { list: jest.fn() },
}));
jest.mock('@/features/study/data/persistence', () => ({ studyRepository: {} }));
jest.mock('@/features/sync/data/deviceLearning', () => ({ deviceLearning: {} }));
jest.mock('@/features/sync/data/connectivity', () => ({
  canSync: jest.fn(), observeSyncWake: jest.fn(),
}));
jest.mock('@/core/state/useAuthStore', () => ({
  useAuthStore: { getState: jest.fn(), subscribe: jest.fn() },
}));
jest.mock('@/core/state/usePapyrusStore', () => ({
  usePapyrusStore: { getState: jest.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const questionSet = (id: string): QuestionSet => ({
  id, title: id, subject: 'Math', questions: [],
  updatedAt: '2026-11-17T00:00:00Z', syncStatus: 'synced',
});
const cloudState = (id: string) => ({ documents: [questionSet(id)], pending: [] });
type AuthState = { user: { id: string } | null; status: string };

function setup(initialOwner: string | null = 'alice') {
  // Each test gets fresh coordinator singleton state (running/refreshVersion/notify).
  jest.resetModules();
  const { cloudSets } = require('@/features/sync/data/cloudSets');
  const { learningSync } = require('@/features/sync/data/learningSync');
  const { questionSetRepository } = require('@/features/question-sets/data/persistence');
  const { canSync, observeSyncWake } = require('@/features/sync/data/connectivity');
  const { useAuthStore } = require('@/core/state/useAuthStore');
  const { usePapyrusStore } = require('@/core/state/usePapyrusStore');
  let auth: AuthState = { user: initialOwner ? { id: initialOwner } : null, status: initialOwner ? 'authenticated' : 'guest' };
  const listeners = new Set<(state: AuthState, previous: AuthState) => void>();
  const unsubscribe = jest.fn();
  useAuthStore.getState.mockImplementation(() => auth);
  useAuthStore.subscribe.mockImplementation((listener: (state: AuthState, previous: AuthState) => void) => {
    listeners.add(listener);
    unsubscribe.mockImplementation(() => listeners.delete(listener));
    return unsubscribe;
  });
  const view = {
    questionSets: [] as QuestionSet[], deletedSetIds: [], syncMessage: '',
    replaceQuestionSets: jest.fn((sets: QuestionSet[]) => { view.questionSets = sets; }),
    resetAccountView: jest.fn(() => { view.questionSets = []; }),
    setSyncMessage: jest.fn((message: string) => { view.syncMessage = message; }),
  };
  usePapyrusStore.getState.mockReturnValue(view);
  cloudSets.list.mockImplementation(async (owner: string) => cloudState(owner));
  cloudSets.sync.mockResolvedValue(undefined);
  learningSync.sync.mockResolvedValue(undefined);
  questionSetRepository.list.mockResolvedValue([questionSet('guest')]);
  canSync.mockResolvedValue(true);
  let signal: (() => void) | undefined;
  const stopSignals = jest.fn(() => { signal = undefined; });
  observeSyncWake.mockImplementation((wake: () => void) => { signal = wake; return stopSignals; });
  const { learning } = require('./learning') as typeof import('./learning');
  return {
    learning, cloudSets, learningSync, canSync, observeSyncWake, view, unsubscribe, stopSignals, listeners,
    signal: () => signal?.(),
    switchOwner(id: string | null) {
      const previous = auth;
      auth = { user: id ? { id } : null, status: id ? 'authenticated' : 'guest' };
      listeners.forEach(listener => listener(auth, previous));
    },
  };
}

const settle = () => jest.advanceTimersByTimeAsync(0);
let dispose: (() => void) | undefined;
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { dispose?.(); dispose = undefined; jest.clearAllTimers(); jest.useRealTimers(); });

it('wakes immediately on start and refreshes the signed-in library after syncing', async () => {
  const f = setup();
  f.cloudSets.sync.mockImplementation(async () => {
    f.cloudSets.list.mockResolvedValue(cloudState('downloaded'));
  });
  dispose = f.learning.start();
  await settle();
  expect(f.observeSyncWake).toHaveBeenCalledTimes(1);
  expect(f.cloudSets.sync).toHaveBeenCalledWith('alice');
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']],['alice',['attempts']]]);
  expect(f.view.questionSets).toEqual([questionSet('downloaded')]);
  expect(f.view.syncMessage).toBe('');
});

it('shows guest data without cloud access and wakes on login', async () => {
  const f = setup(null);
  dispose = f.learning.start();
  await settle();
  expect(f.view.questionSets).toEqual([questionSet('guest')]);
  expect(f.cloudSets.sync).not.toHaveBeenCalled();
  expect(f.canSync).not.toHaveBeenCalled();
  f.switchOwner('alice');
  expect(f.view.questionSets).toEqual([]);
  await settle();
  expect(f.cloudSets.sync).toHaveBeenCalledWith('alice');
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']],['alice',['attempts']]]);
  expect(f.view.questionSets).toEqual([questionSet('alice')]);
});

it.each(['network reconnect', 'foreground'])('wakes through observeSyncWake on %s', async () => {
  const f = setup();
  f.canSync.mockResolvedValue(false);
  dispose = f.learning.start();
  await settle();
  expect(f.cloudSets.sync).not.toHaveBeenCalled();
  f.canSync.mockResolvedValue(true);
  f.signal();
  await settle();
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(1);
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']],['alice',['attempts']]]);
  expect(jest.getTimerCount()).toBe(1);
});

it('retries a failed sync after 30 seconds and clears its error on success', async () => {
  const f = setup();
  f.cloudSets.sync.mockRejectedValueOnce(new Error('offline'));
  dispose = f.learning.start();
  await settle();
  expect(f.view.syncMessage).toBe('Chưa đồng bộ được. Dữ liệu vẫn được giữ trên thiết bị.');
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']]]);
  await jest.advanceTimersByTimeAsync(29999);
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(2);
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']],['alice',['source_documents']],['alice',['attempts']]]);
  expect(f.view.syncMessage).toBe('');
  await jest.advanceTimersByTimeAsync(30000);
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(3);
});

it('hides the old library immediately and ignores its late sync response after switching owner', async () => {
  const f = setup();
  const oldSync = deferred<void>();
  f.cloudSets.sync.mockImplementationOnce(() => oldSync.promise);
  dispose = f.learning.start();
  await settle();
  expect(f.view.questionSets).toEqual([questionSet('alice')]);
  f.switchOwner('bob');
  expect(f.view.questionSets).toEqual([]);
  await settle();
  expect(f.view.questionSets).toEqual([questionSet('bob')]);
  f.view.replaceQuestionSets.mockClear();
  oldSync.resolve(undefined);
  await settle();
  expect(f.cloudSets.sync.mock.calls).toEqual([['alice'], ['bob']]);
  expect(f.learningSync.sync.mock.calls).toEqual([['alice',['source_documents']],['bob',['source_documents']],['bob',['attempts']]]);
  expect(f.view.questionSets).toEqual([questionSet('bob')]);
  expect(f.view.replaceQuestionSets.mock.calls.length).toBeGreaterThan(0);
  for (const [sets] of f.view.replaceQuestionSets.mock.calls) expect(sets).toEqual([questionSet('bob')]);
});

it('ignores a stale library read that resolves after the new account view', async () => {
  const f = setup();
  const oldRead = deferred<ReturnType<typeof cloudState>>();
  f.cloudSets.list.mockImplementationOnce(() => oldRead.promise);
  dispose = f.learning.start();
  f.switchOwner('bob');
  await settle();
  expect(f.view.questionSets).toEqual([questionSet('bob')]);
  f.view.replaceQuestionSets.mockClear();
  oldRead.resolve(cloudState('alice-stale'));
  await settle();
  expect(f.cloudSets.sync.mock.calls).toEqual([['bob']]);
  expect(f.view.questionSets).toEqual([questionSet('bob')]);
  for (const [sets] of f.view.replaceQuestionSets.mock.calls) expect(sets).toEqual([questionSet('bob')]);
});

it('disposes auth and wake listeners and cancels periodic retries', async () => {
  const f = setup();
  dispose = f.learning.start();
  await settle();
  expect(jest.getTimerCount()).toBe(1);
  const capturedWake = f.observeSyncWake.mock.calls[0][0];
  dispose();
  dispose = undefined;
  expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  expect(f.stopSignals).toHaveBeenCalledTimes(1);
  expect(f.listeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  f.switchOwner('bob');
  f.signal();
  capturedWake();
  await jest.advanceTimersByTimeAsync(60000);
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(1);
  expect(f.view.resetAccountView).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('does not recreate a retry timer when an in-flight sync finishes after disposal', async () => {
  const f = setup();
  const pending = deferred<void>();
  f.cloudSets.sync.mockImplementationOnce(() => pending.promise);
  dispose = f.learning.start();
  await settle();
  dispose();
  dispose = undefined;
  pending.resolve(undefined);
  await settle();
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(60000);
  expect(f.cloudSets.sync).toHaveBeenCalledTimes(1);
});
