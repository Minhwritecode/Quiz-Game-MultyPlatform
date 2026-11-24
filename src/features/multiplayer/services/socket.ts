import {
  createRealtimeKahootChannel,
  removeRealtimeKahootChannel,
  type RealtimeBroadcastChannel,
} from '@/composition/platform';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'supabase-realtime';

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Room
  JOIN_ROOM: 'join-room',
  PARTICIPANTS_UPDATED: 'participants-updated',

  // Quiz Control
  START_QUIZ: 'start-quiz',
  QUIZ_STARTED: 'quiz-started',
  PAUSE_QUIZ: 'pause-quiz',
  QUIZ_PAUSED: 'quiz-paused',
  RESUME_QUIZ: 'resume-quiz',
  QUIZ_RESUMED: 'quiz-resumed',
  END_QUIZ: 'end-quiz',

  // Game Play
  SUBMIT_ANSWER: 'submit-answer',
  NEXT_QUESTION: 'next-question',
  QUESTION_ENDED: 'question-ended',
  SHOW_LEADERBOARD: 'show-leaderboard',
  LEADERBOARD_UPDATED: 'leaderboard-updated',
  QUIZ_FINISHED: 'quiz-finished',

  // Internal Realtime Sync
  ROOM_SYNC_REQUEST: 'room-sync-request',
  ROOM_SYNC_STATE: 'room-sync-state',
  QUIZ_ERROR: 'quiz-error',
} as const;

type Listener = (...args: any[]) => void;

/**
 * Cross-device Realtime Kahoot Event Bus backed by Supabase Realtime Broadcast Channels.
 * Works across mobile & desktop browsers worldwide without needing any separate localhost:5000 server,
 * and falls back cleanly to in-memory pub/sub when offline.
 */
class SupabaseRealtimeSocket {
  public connected = true;
  private listeners = new Map<string, Set<Listener>>();
  private channels = new Map<string, RealtimeBroadcastChannel>();
  private activeRoomCode: string | null = null;

  connect() {
    this.connected = true;
    this.dispatchLocal(SOCKET_EVENTS.CONNECT);
    return this;
  }

  disconnect() {
    this.channels.forEach((ch) => {
      removeRealtimeKahootChannel(ch);
    });
    this.channels.clear();
    this.activeRoomCode = null;
    return this;
  }

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return this;
  }

  off(event: string, fn?: Listener) {
    if (!fn) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(fn);
    return this;
  }

  dispatchLocal(event: string, payload?: any) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try {
        fn(payload);
      } catch {
        // Ignore listener errors
      }
    });
  }

  ensureChannel(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    if (!code) return null;
    this.activeRoomCode = code;
    if (this.channels.has(code)) return this.channels.get(code)!;

    const ch = createRealtimeKahootChannel(code, (type, data) => {
      this.dispatchLocal(type, data);
    });
    if (ch) {
      this.channels.set(code, ch);
    }
    return ch;
  }

  broadcast(roomCode: string, type: string, data?: any, includeSelf = true) {
    const code = (roomCode || this.activeRoomCode || '').trim().toUpperCase();
    if (includeSelf) {
      this.dispatchLocal(type, data);
    }
    if (!code) return;
    const ch = this.ensureChannel(code);
    if (ch) {
      void ch.send({
        type: 'broadcast',
        event: 'kahoot-msg',
        payload: { type, data },
      });
    }
  }

  emit(event: string, payload?: any) {
    if (event === SOCKET_EVENTS.JOIN_ROOM && typeof payload === 'string') {
      const code = payload.trim().toUpperCase();
      this.ensureChannel(code);
      this.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_REQUEST, { roomCode: code }, false);
      return this;
    }
    const code =
      (typeof payload === 'string' ? payload : payload?.roomCode) ||
      this.activeRoomCode ||
      '';
    this.broadcast(code, event, payload, true);
    return this;
  }
}

const realtimeBus = new SupabaseRealtimeSocket();

export function getSocket() {
  return realtimeBus;
}

export const socket = realtimeBus;
