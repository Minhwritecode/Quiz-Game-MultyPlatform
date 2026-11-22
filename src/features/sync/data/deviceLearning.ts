import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SourceDocument, StudyProgress } from '@/core/domain/models';

let tail: Promise<unknown> = Promise.resolve();
function ordered<T>(job: () => Promise<T>): Promise<T> {
  const next = tail.then(job, job); tail = next.catch(() => undefined); return next;
}
const progressKey = (owner: string) => `papyrus.progress.v2:${owner}`;
async function read<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : [];
}
export const deviceLearning = {
  progress(owner: string) { return ordered(() => read<StudyProgress>(progressKey(owner))); },
  saveProgress(owner: string, progress: StudyProgress) { return ordered(async () => {
    const all = await read<StudyProgress>(progressKey(owner));
    await AsyncStorage.setItem(progressKey(owner), JSON.stringify([progress, ...all.filter(p => p.questionSetId !== progress.questionSetId)]));
  }); },
  clearProgress(owner: string, id: string) { return ordered(async () => {
    const all = await read<StudyProgress>(progressKey(owner));
    await AsyncStorage.setItem(progressKey(owner), JSON.stringify(all.filter(p => p.questionSetId !== id)));
  }); },
  sources() { return ordered(() => read<SourceDocument>('papyrus.guest.sources')); },
  saveSource(document: SourceDocument) { return ordered(async () => {
    const all = await read<SourceDocument>('papyrus.guest.sources');
    await AsyncStorage.setItem('papyrus.guest.sources', JSON.stringify([document, ...all.filter(p => p.id !== document.id)]));
  }); },
  removeSource(id: string) { return ordered(async () => {
    await AsyncStorage.setItem('papyrus.guest.sources', JSON.stringify((await read<SourceDocument>('papyrus.guest.sources')).filter(p => p.id !== id)));
  }); },
};
