import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SourceDocument } from '@/core/domain/models';

const key = 'papyrus.quiz-source-sign-in.v1';
type Handoff = { document: SourceDocument; owner: string | null };
let pending: Promise<unknown> = Promise.resolve();

function ordered<T>(work: () => Promise<T>): Promise<T> {
  const next = pending.then(work, work);
  pending = next.catch(() => undefined);
  return next;
}

// Only an explicit guest sign-in action stages a document. The first successful
// account claims it before saving, so interrupted imports cannot follow a switch.
export const sourceHandoff = {
  stage(document: SourceDocument): Promise<void> {
    return ordered(() => AsyncStorage.setItem(key, JSON.stringify({ document, owner: null } satisfies Handoff)));
  },
  clear(): Promise<void> {
    return ordered(() => AsyncStorage.removeItem(key));
  },
  claim(owner: string, isCurrent: () => boolean): Promise<string | null> {
    return ordered(async () => {
      const raw = await AsyncStorage.getItem(key);
      if (!raw || !isCurrent()) return null;
      const entry = JSON.parse(raw) as Handoff;
      if (entry.owner && entry.owner !== owner) return null;
      if (!entry.owner) await AsyncStorage.setItem(key, JSON.stringify({ ...entry, owner }));
      return entry.document.id;
    });
  },
  complete(owner: string, sourceId: string, save: (document: SourceDocument) => Promise<void>): Promise<SourceDocument | null> {
    return ordered(async () => {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as Handoff;
      if (entry.owner !== owner || entry.document.id !== sourceId) return null;
      await save(entry.document);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return entry.document;
    });
  },
};
