import type { SyncItem } from '@/core/domain/models';

export interface SyncQueueRepository {
  list(): Promise<SyncItem[]>;
  acknowledge(id: number): Promise<void>;
  markRetry(id: number): Promise<void>;
}
