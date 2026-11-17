import type { Event } from '@sentry/react-native';

// Allowlist diagnostics. Never transmit notes, answer content, URLs, sessions or free-form logs.
export function sanitizeEvent<T extends Event>(event: T): T {
  const operation = ['ocr','generation','sync'].includes(String(event.contexts?.trace?.op)) ? String(event.contexts?.trace?.op) : 'app';
  return {
    event_id: event.event_id, timestamp: event.timestamp, platform: event.platform,
    level: event.level, release: event.release, dist: event.dist, environment: event.environment,
    type: event.type, start_timestamp: event.start_timestamp,
    transaction: event.type === 'transaction' ? `papyrus.${operation}` : undefined,
    exception: event.exception ? { values: event.exception.values?.map(value => ({
      type: 'ApplicationError', value: '[message removed for privacy]',
      stacktrace: { frames: value.stacktrace?.frames?.map(frame => ({
        filename: frame.filename?.split(/[?#]/)[0]?.split('/').pop(),
        function: frame.function, lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
      })) },
    })) } : undefined,
    contexts: event.contexts?.trace ? { trace: {
      trace_id: event.contexts.trace.trace_id, span_id: event.contexts.trace.span_id,
      op: operation, status: event.contexts.trace.status,
    } } : undefined,
    tags: { operation: ['ocr', 'generation', 'sync', 'startup'].includes(String(event.tags?.operation)) ? event.tags?.operation : 'app' },
  } as unknown as T;
}
