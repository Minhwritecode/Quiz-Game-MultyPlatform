import type { SyncItem } from '@/core/domain/models';
import { drainOutbox } from './drainOutbox';

const item = (id: number): SyncItem => ({ id, entity: 'question_sets', entityId: `set-${id}`, operation: 'insert', payload: {}, createdAt: `2026-11-10T00:00:0${id}.000Z`, retryCount: 0 });

describe('drainOutbox', () => {
  it('pushes oldest items first and acknowledges successes', async () => {
    const queue = { list: async () => [item(2), item(1)], acknowledge: jest.fn(async () => undefined), markRetry: jest.fn(async () => undefined) };
    const pushed: number[] = [];
    const result = await drainOutbox({ queue, push: async (value) => { pushed.push(value.id); } });
    expect(pushed).toEqual([1, 2]);
    expect(result).toEqual({ acknowledged: 2, failed: 0 });
    expect(queue.acknowledge).toHaveBeenCalledTimes(2);
  });

  it('marks failed items for retry without blocking later items', async () => {
    const queue = { list: async () => [item(1), item(2)], acknowledge: jest.fn(async () => undefined), markRetry: jest.fn(async () => undefined) };
    const result = await drainOutbox({ queue, push: async (value) => { if (value.id === 1) throw new Error('offline'); } });
    expect(result).toEqual({ acknowledged: 1, failed: 1 });
    expect(queue.markRetry).toHaveBeenCalledWith(1);
    expect(queue.acknowledge).toHaveBeenCalledWith(2);
  });
});
