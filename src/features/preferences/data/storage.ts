import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PreferenceStorage } from '../domain/storage';

const IDB_MARKER = '__PAPYRUS_IDB_V1__';
const IDB_NAME = 'papyrus_preference_kv_v1';
const IDB_STORE = 'kv';
const INLINE_MAX_CHARS = 180_000;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasBrowserIdb(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openKvIdb(): Promise<IDBDatabase | null> {
  if (!hasBrowserIdb()) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openKvIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<boolean> {
  const db = await openKvIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openKvIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Quota-resilient storage adapter:
 * - Uses AsyncStorage directly for normal payloads and native/test environments.
 * - Automatically spills large payloads (>180KB) or QuotaExceededError writes into IndexedDB on Web
 *   so cover photos, multi-photo posts, and 24h stories NEVER fail due to the 5MB localStorage ceiling.
 */
export const preferenceStorage: PreferenceStorage = {
  getItem: async (key: string) => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === IDB_MARKER) {
        return await idbGet(key);
      }
      if (raw !== null) return raw;
      if (hasBrowserIdb()) {
        return await idbGet(key);
      }
      return null;
    } catch {
      return hasBrowserIdb() ? await idbGet(key) : null;
    }
  },

  setItem: async (key: string, value: string) => {
    const canUseIdb = hasBrowserIdb();
    if (canUseIdb && value.length > INLINE_MAX_CHARS) {
      const ok = await idbSet(key, value);
      if (ok) {
        await AsyncStorage.setItem(key, IDB_MARKER).catch(async () => {
          await AsyncStorage.removeItem(key).catch(() => undefined);
        });
        return;
      }
    }

    try {
      await AsyncStorage.setItem(key, value);
      if (canUseIdb) {
        void idbDelete(key);
      }
    } catch {
      if (canUseIdb) {
        const savedToIdb = await idbSet(key, value);
        if (savedToIdb) {
          await AsyncStorage.removeItem(key).catch(() => undefined);
          await AsyncStorage.setItem(key, IDB_MARKER).catch(() => undefined);
          return;
        }
      }
    }
  },

  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    if (hasBrowserIdb()) {
      await idbDelete(key);
    }
  },
};
