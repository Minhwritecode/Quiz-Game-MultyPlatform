import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Reliable web storage adapter backed directly by window.localStorage.
 * Prevents Safari PWA / Web cold-start session drops that occur when async
 * wrappers lag behind initial auth bootstrap.
 */
const webLocalStorageAdapter = {
  getItem: (storageKey: string): string | null => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  },
  setItem: (storageKey: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, value);
      }
    } catch {
      // Ignore storage quota or private-mode restrictions
    }
  },
  removeItem: (storageKey: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore
    }
  },
};

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        storage: Platform.OS === 'web' ? webLocalStorageAdapter : AsyncStorage,
        storageKey: 'papyrus-auth-session',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
