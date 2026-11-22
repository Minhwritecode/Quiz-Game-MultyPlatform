import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppError } from '@/core/domain/failure';
import { emptyLearningState, learningStateSchema, type LearningStore } from '../domain/learningSync';

const key = (owner: string) => {
  if (!owner.trim()) throw new AppError('authentication', 'Sign in to the account that owns this queue.');
  return `learning-sync:v1:${encodeURIComponent(owner)}`;
};
const storageError = () => new AppError('unavailable', 'Learning data could not be read or saved on this device. Please try again.');

/** One owner-scoped value keeps documents, outbox and cursor in the same atomic write. */
export const learningStorage: LearningStore = {
  async load(owner) {
    const storageKey = key(owner);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw === null) return emptyLearningState();
      const state: unknown = JSON.parse(raw);
      learningStateSchema.parse(state);
      // Validate without transforming/stripping the stored transport envelope.
      return state as ReturnType<typeof emptyLearningState>;
    } catch { throw storageError(); }
  },
  async save(owner, state) {
    const storageKey = key(owner);
    try {
      learningStateSchema.parse(state);
      await AsyncStorage.setItem(storageKey, JSON.stringify(state));
    } catch { throw storageError(); }
  },
};
