import type { SyncItem } from '@/core/domain/models';

export class SyncEngine {
  private running = false;

  constructor(
    private readonly push: (item: SyncItem) => Promise<void>,
    private readonly pull: (updatedAfter?: string) => Promise<void>,
  ) {}

  async runOnce(queue: SyncItem[], cursor?: string): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const item of [...queue].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) await this.push(item);
      await this.pull(cursor);
    } finally {
      this.running = false;
    }
  }
}
