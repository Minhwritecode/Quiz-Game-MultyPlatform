import * as Crypto from 'expo-crypto';
import type { QuestionSet } from '@/core/domain/models';
import type { RoomData, RoomPlayer } from '../domain/models';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { preferenceStorage, seedQuestionSets } from '@/composition/preferences';
import { useMultiplayerStore } from '../state/useMultiplayerStore';
import { socket, SOCKET_EVENTS } from './socket';

export const BACKEND_URL = 'supabase-realtime';
const KAHOOT_ROOM_STORAGE_PREFIX = 'papyrus.kahoot.room.';

export interface LiveKahootRoomState extends RoomData {
  secondsPerQuestion: number;
  questionStartedAt: number;
  answersByPlayer: Record<string, { answer: number; elapsedSec: number }>;
  isHostInstance?: boolean;
}

export interface CreateKahootRoomOptions {
  questionSet?: QuestionSet | null;
  questionCount?: number;
  secondsPerQuestion?: number;
  maxPlayers?: number;
}

export const liveRooms = new Map<string, LiveKahootRoomState>();

function makeShortId(prefix: string): string {
  try {
    return `${prefix}-${Crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function persistKahootRoomSnapshot(room: LiveKahootRoomState): Promise<void> {
  try {
    await preferenceStorage.setItem(
      `${KAHOOT_ROOM_STORAGE_PREFIX}${room.roomCode}`,
      JSON.stringify(room)
    );
  } catch {
    // Ignore storage quota errors
  }
}

async function loadPersistedKahootRoom(code: string): Promise<LiveKahootRoomState | null> {
  try {
    const raw = await preferenceStorage.getItem(`${KAHOOT_ROOM_STORAGE_PREFIX}${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveKahootRoomState;
    if (parsed && parsed.roomCode && parsed.quizId?.questions?.length) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getMergedQuestionSetPool(): QuestionSet[] {
  const storeSets = usePapyrusStore.getState().questionSets;
  const seenIds = new Set(storeSets.map((s) => s.id));
  const seenTitles = new Set(storeSets.map((s) => s.title.trim().toLowerCase()));
  return [
    ...storeSets,
    ...seedQuestionSets.filter(
      (sd) => !seenIds.has(sd.id) && !seenTitles.has(sd.title.trim().toLowerCase())
    ),
  ];
}

let syncWired = false;
function wireRealtimeRoomSync() {
  if (syncWired) return;
  syncWired = true;

  // Host responds to join / sync requests with authoritative room snapshot
  socket.on(
    SOCKET_EVENTS.ROOM_SYNC_REQUEST,
    (payload: { roomCode?: string; joinPlayer?: RoomPlayer }) => {
      const code = (payload?.roomCode || '').toUpperCase();
      const room = liveRooms.get(code);
      if (!room || !room.isHostInstance) return;

      if (payload?.joinPlayer) {
        const cap = room.maxPlayers ?? 10;
        const exists = room.players.some(
          (p) =>
            p.playerId === payload.joinPlayer!.playerId ||
            p.nickname.toLowerCase() === payload.joinPlayer!.nickname.toLowerCase()
        );
        if (!exists && room.players.length < cap) {
          room.players = [...room.players, payload.joinPlayer];
          void persistKahootRoomSnapshot(room);
        }
      }

      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
        room: { ...room, isHostInstance: false },
      });
      socket.broadcast(code, SOCKET_EVENTS.PARTICIPANTS_UPDATED, { players: room.players });
    }
  );

  // Players receive authoritative snapshot from Host
  socket.on(SOCKET_EVENTS.ROOM_SYNC_STATE, (payload: { room?: LiveKahootRoomState }) => {
    const incoming = payload?.room;
    if (!incoming?.roomCode) return;
    const code = incoming.roomCode.toUpperCase();
    const existing = liveRooms.get(code);
    if (existing?.isHostInstance) return;
    const synced: LiveKahootRoomState = { ...incoming, isHostInstance: false };
    liveRooms.set(code, synced);
    useMultiplayerStore.getState().setCurrentRoom(synced);
    void persistKahootRoomSnapshot(synced);
    socket.dispatchLocal(SOCKET_EVENTS.PARTICIPANTS_UPDATED, { players: incoming.players });
  });
}

function generatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export const roomApi = {
  async create(
    quizId: string,
    hostName = 'Chủ phòng',
    options?: CreateKahootRoomOptions
  ): Promise<{ roomCode: string; room: RoomData }> {
    wireRealtimeRoomSync();
    const mergedPool = getMergedQuestionSetPool();
    const chosen =
      options?.questionSet ??
      mergedPool.find((s) => s.id === quizId || s.title === quizId) ??
      mergedPool[0] ??
      seedQuestionSets[0]!;

    const code = generatePin();
    const maxQuestions = Math.max(
      1,
      Math.min(chosen.questions.length, options?.questionCount ?? chosen.questions.length)
    );
    const secs = Math.max(5, options?.secondsPerQuestion ?? 20);
    const maxP = Math.min(10, Math.max(2, options?.maxPlayers ?? 6));

    const mappedQuestions = chosen.questions.slice(0, maxQuestions).map((q, idx) => {
      const cleanOpts = (q.options ?? []).map((o) => String(o).trim()).filter(Boolean);
      const opts =
        cleanOpts.length >= 2
          ? cleanOpts.slice(0, 4)
          : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'];
      return {
        question: q.content?.trim() || `Câu hỏi ${idx + 1}`,
        options: opts,
        correctAnswer: Math.max(0, Math.min(opts.length - 1, q.correctIndex ?? 0)),
        explanation: q.explanation,
        codeSnippet: q.codeSnippet,
      };
    });

    const cleanHost = hostName.trim() || 'Chủ phòng';
    const room: LiveKahootRoomState = {
      roomCode: code,
      quizId: {
        id: chosen.id,
        title: chosen.title,
        description: chosen.subject || 'Đấu trường Kahoot Live',
        questions: mappedQuestions,
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      secondsPerQuestion: secs,
      timeLimit: secs,
      maxPlayers: maxP,
      readTimeSec: 3,
      reactionsEnabled: true,
      questionStartedAt: Date.now(),
      answersByPlayer: {},
      isHostInstance: true,
      players: [
        {
          playerId: makeShortId('host'),
          nickname: cleanHost,
          score: 0,
          isHost: true,
        },
      ],
    };

    liveRooms.set(code, room);
    useMultiplayerStore.getState().setPlayerInfo(code, cleanHost);
    useMultiplayerStore.getState().setCurrentRoom(room);
    await persistKahootRoomSnapshot(room);
    socket.ensureChannel(code);
    return { roomCode: code, room };
  },

  updateConfig(
    roomCode: string,
    patch: {
      maxPlayers?: number;
      secondsPerQuestion?: number;
      readTimeSec?: 0 | 3 | 5 | 10;
      reactionsEnabled?: boolean;
    }
  ): RoomData | null {
    wireRealtimeRoomSync();
    const code = (roomCode || '').trim().toUpperCase();
    const room = liveRooms.get(code);
    if (!room) return null;
    if (typeof patch.maxPlayers === 'number') {
      room.maxPlayers = Math.min(10, Math.max(2, patch.maxPlayers));
    }
    if (typeof patch.secondsPerQuestion === 'number') {
      room.secondsPerQuestion = Math.max(5, patch.secondsPerQuestion);
      room.timeLimit = room.secondsPerQuestion;
    }
    if (patch.readTimeSec !== undefined) {
      room.readTimeSec = patch.readTimeSec;
    }
    if (typeof patch.reactionsEnabled === 'boolean') {
      room.reactionsEnabled = patch.reactionsEnabled;
    }
    useMultiplayerStore.getState().setCurrentRoom({ ...room });
    void persistKahootRoomSnapshot(room);
    socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
      room: { ...room, isHostInstance: false },
    });
    return { ...room };
  },

  kickPlayer(roomCode: string, playerId: string): RoomData | null {
    const code = (roomCode || '').trim().toUpperCase();
    const room = liveRooms.get(code);
    if (!room) return null;
    room.players = room.players.filter((p) => p.playerId !== playerId);
    useMultiplayerStore.getState().setCurrentRoom({ ...room });
    void persistKahootRoomSnapshot(room);
    socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
      room: { ...room, isHostInstance: false },
    });
    socket.broadcast(code, SOCKET_EVENTS.PARTICIPANTS_UPDATED, { players: room.players });
    return { ...room };
  },

  async join(roomCode: string, nickname: string): Promise<{ playerId: string; room: RoomData }> {
    wireRealtimeRoomSync();
    const code = roomCode.trim().toUpperCase();
    const playerId = makeShortId('p');
    const player: RoomPlayer = { playerId, nickname: nickname.trim() || 'Học giả', score: 0 };

    socket.ensureChannel(code);

    // Check same-device persisted room first, then request authoritative state from Host over Realtime
    const persisted = await loadPersistedKahootRoom(code);
    if (persisted && !liveRooms.has(code)) {
      liveRooms.set(code, persisted);
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        socket.off(SOCKET_EVENTS.ROOM_SYNC_STATE, onSync);
        resolve();
      };
      const onSync = () => finish();
      socket.on(SOCKET_EVENTS.ROOM_SYNC_STATE, onSync);
      socket.broadcast(
        code,
        SOCKET_EVENTS.ROOM_SYNC_REQUEST,
        { roomCode: code, joinPlayer: player },
        true
      );
      setTimeout(finish, 900);
    });

    let room = liveRooms.get(code);
    if (!room) {
      const defaultSet = getMergedQuestionSetPool()[0] ?? seedQuestionSets[0]!;
      room = {
        roomCode: code,
        quizId: {
          id: defaultSet.id,
          title: defaultSet.title,
          description: defaultSet.subject || 'Phòng Kahoot Nhanh',
          questions: defaultSet.questions.map((q) => ({
            question: q.content,
            options: q.options.slice(0, 4),
            correctAnswer: q.correctIndex,
            explanation: q.explanation,
            codeSnippet: q.codeSnippet,
          })),
        },
        status: 'waiting',
        currentQuestionIndex: 0,
        secondsPerQuestion: 20,
        timeLimit: 20,
        maxPlayers: 6,
        questionStartedAt: Date.now(),
        answersByPlayer: {},
        isHostInstance: true,
        players: [
          { playerId: 'host-auto', nickname: 'Chủ phòng Papyrus', score: 0, isHost: true },
          player,
        ],
      };
      liveRooms.set(code, room);
    } else if (
      !room.players.some(
        (p) =>
          p.playerId === playerId ||
          p.nickname.toLowerCase() === player.nickname.toLowerCase()
      )
    ) {
      room.players = [...room.players, player];
    }

    useMultiplayerStore.getState().setPlayerInfo(code, player.nickname);
    useMultiplayerStore.getState().setCurrentRoom(room);
    await persistKahootRoomSnapshot(room);
    return { playerId, room };
  },

  async get(roomCode: string): Promise<RoomData> {
    wireRealtimeRoomSync();
    const code = (roomCode || '').trim().toUpperCase();
    const found = liveRooms.get(code);
    if (found) return found;

    const persisted = await loadPersistedKahootRoom(code);
    if (persisted) {
      liveRooms.set(code, persisted);
      useMultiplayerStore.getState().setCurrentRoom(persisted);
      return persisted;
    }

    // Request live state from remote Host over Supabase Realtime
    socket.ensureChannel(code);
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        socket.off(SOCKET_EVENTS.ROOM_SYNC_STATE, onSync);
        resolve();
      };
      const onSync = () => finish();
      socket.on(SOCKET_EVENTS.ROOM_SYNC_STATE, onSync);
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_REQUEST, { roomCode: code }, false);
      setTimeout(finish, 650);
    });

    const syncedAfterWait = liveRooms.get(code);
    if (syncedAfterWait) return syncedAfterWait;

    const storeCurrent = useMultiplayerStore.getState().currentRoom;
    if (storeCurrent && storeCurrent.roomCode.toUpperCase() === code) {
      return storeCurrent;
    }

    const fallbackSet = getMergedQuestionSetPool()[0] ?? seedQuestionSets[0]!;
    return {
      roomCode: code,
      quizId: {
        id: fallbackSet.id,
        title: fallbackSet.title,
        description: fallbackSet.subject || 'Phòng Quiz Trực tiếp',
        questions: fallbackSet.questions.map((q) => ({
          question: q.content,
          options: q.options.slice(0, 4),
          correctAnswer: q.correctIndex,
          explanation: q.explanation,
          codeSnippet: q.codeSnippet,
        })),
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      players: [],
    };
  },
};
