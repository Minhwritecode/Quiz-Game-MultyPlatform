import type { SourceDocument } from '@/core/domain/models';

export function createSourceDocument(id: string, text: string): SourceDocument {
  return { id, title: 'Scanned material', text, createdAt: new Date().toISOString() };
}
