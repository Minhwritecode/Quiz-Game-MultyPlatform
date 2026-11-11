import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { needsUpgrade, recordCompletion, type ReleasePolicy, type ReviewHistory } from '../domain/policy';

const reviewKey = 'papyrus.review-history';
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> { const job=tail.then(work,work);tail=job.catch(()=>undefined);return job; }
async function readHistory(): Promise<ReviewHistory> {
  const raw=await AsyncStorage.getItem(reviewKey);
  try { const h=JSON.parse(raw ?? 'null');if (typeof h?.firstUsed === 'number' && Array.isArray(h.completed)) return h; } catch { /* reset corrupt history */ }
  return {firstUsed:Date.now(),completed:[]};
}
export const releaseService = {
  version: Constants.expoConfig?.version ?? '0.2.0',
  async requiredUpgrade(): Promise<ReleasePolicy | null> {
    const endpoint=process.env.EXPO_PUBLIC_RELEASE_POLICY_URL;
    if (!endpoint || Platform.OS === 'web') return null;
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),4000);
    try {
      if(new URL(endpoint).protocol !== 'https:') return null;
      const response=await fetch(endpoint,{signal:controller.signal});
      if(!response.ok)return null;
      const body=await response.json();
      const policy=body?.[Platform.OS];
      return policy && needsUpgrade(releaseService.version,policy) ? policy : null;
    } catch { return null; } finally { clearTimeout(timeout); }
  },
  initializeReview: () => serial(async()=>{await AsyncStorage.setItem(reviewKey,JSON.stringify(await readHistory()));}),
  recordStudyCompletion: (attempt: string) => serial(async()=>{
    const {next,eligible}=recordCompletion(await readHistory(),attempt,Date.now());
    await AsyncStorage.setItem(reviewKey,JSON.stringify(next));
    if(!eligible || Platform.OS === 'web' || !await StoreReview.isAvailableAsync())return;
    // Persist before invoking the OS; a process restart must not spam the prompt.
    await AsyncStorage.setItem(reviewKey,JSON.stringify({...next,lastPrompt:Date.now()}));
    await StoreReview.requestReview();
  }),
};
