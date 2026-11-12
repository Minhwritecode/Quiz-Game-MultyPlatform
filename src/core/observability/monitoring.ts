import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { sanitizeEvent } from './privacy';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn, enabled: Boolean(dsn) && !__DEV__, sendDefaultPii: false,
  environment: Constants.expoConfig?.extra?.appVariant ?? 'development',
  tracesSampleRate: 0.1, enableLogs: false,
  attachScreenshot: false, attachViewHierarchy: false,
  beforeBreadcrumb: () => null,
  beforeSend: sanitizeEvent, beforeSendTransaction: sanitizeEvent,
});

export const wrapRoot = Sentry.wrap;
export function reportFailure(error: unknown, operation: 'ocr' | 'generation' | 'sync' | 'startup') {
  Sentry.withScope(scope => { scope.setTag('operation', operation); Sentry.captureException(error); });
}
export async function traceOperation<T>(operation: 'ocr' | 'generation' | 'sync', work: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name: `papyrus.${operation}`, op: operation }, async () => {
    try { return await work(); }
    catch (error) { reportFailure(error, operation); throw error; }
  });
}
