import type { SyncItem } from '@/core/domain/models';
import type { SyncQueueRepository } from './repository';

export async function drainOutbox(input: {
  queue: SyncQueueRepository;
  push: (item: SyncItem) => Promise<void>;
}): Promise<{ acknowledged: number; failed: number }> {
  const items = (await input.queue.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  let acknowledged = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await input.push(item);
      await input.queue.acknowledge(item.id);
      acknowledged += 1;
    } catch {
      await input.queue.markRetry(item.id);
      failed += 1;
    }
  }
  return { acknowledged, failed };
}
