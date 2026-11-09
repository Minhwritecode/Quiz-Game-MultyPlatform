import { acknowledgeSyncItem, loadSyncItems, markSyncItemRetry } from '@/core/database/sqlite';
import type { SyncQueueRepository } from '../domain/repository';

export const localSyncQueue: SyncQueueRepository = {
  list: () => loadSyncItems(),
  acknowledge: (id) => acknowledgeSyncItem(id),
  markRetry: (id) => markSyncItemRetry(id),
};
