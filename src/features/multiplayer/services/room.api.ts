import * as Crypto from 'expo-crypto';
import type { RoomData, RoomPlayer } from '../domain/models';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { seedQuestionSets } from '@/composition/preferences';
import { socket, SOCKET_EVENTS } from './socket';

export const BACKEND_URL = 'supabase-realtime';

export interface LiveKahootRoomState extends RoomData {
  secondsPerQuestion: number;
  questionStartedAt: number;
  answersByPlayer: Record<string, { answer: number; elapsedSec: number }>;
  isHostInstance?: boolean;
}

export const liveRooms = new Map<string, LiveKahootRoomState>();

let syncWired = false;
function wireRealtimeRoomSync() {
  if (syncWired) return;
  syncWired = true;

  // Host responds to join / sync requests with authoritative room snapshot
  socket.on(SOCKET_EVENTS.ROOM_SYNC_REQUEST, (payload: { roomCode?: string; joinPlayer?: RoomPlayer }) => {
    const code = (payload?.roomCode || '').toUpperCase();
    const room = liveRooms.get(code);
    if (!room || !room.isHostInstance) return;

    if (payload?.joinPlayer) {
      const exists = room.players.some(
        (p) =>
          p.playerId === payload.joinPlayer!.playerId ||
          p.nickname.toLowerCase() === payload.joinPlayer!.nickname.toLowerCase()
      );
      if (!exists) {
        room.players = [...room.players, payload.joinPlayer];
      }
    }

    socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
      room: { ...room, isHostInstance: false },
    });
    socket.broadcast(code, SOCKET_EVENTS.PARTICIPANTS_UPDATED, { players: room.players });
  });

  // Players receive authoritative snapshot from Host
  socket.on(SOCKET_EVENTS.ROOM_SYNC_STATE, (payload: { room?: LiveKahootRoomState }) => {
    const incoming = payload?.room;
    if (!incoming?.roomCode) return;
    const code = incoming.roomCode.toUpperCase();
    const existing = liveRooms.get(code);
    if (existing?.isHostInstance) return;
    liveRooms.set(code, { ...incoming, isHostInstance: false });
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
  async create(quizId: string, hostName = 'Chủ phòng (Host)'): Promise<{ roomCode: string; room: RoomData }> {
    wireRealtimeRoomSync();
    const storeSets = usePapyrusStore.getState().questionSets;
    const allSets = storeSets.length > 0 ? storeSets : seedQuestionSets;
    const chosen = allSets.find((s) => s.id === quizId) ?? allSets[0]!;

    const code = generatePin();
    const mappedQuestions = chosen.questions.slice(0, 12).map((q) => {
      const opts =
        q.options.length >= 2
          ? q.options.slice(0, 4)
          : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'];
      return {
        question: q.content,
        options: opts,
        correctAnswer: Math.max(0, Math.min(opts.length - 1, q.correctIndex)),
        explanation: q.explanation,
      };
    });

    const room: LiveKahootRoomState = {
      roomCode: code,
      quizId: {
        id: chosen.id,
        title: chosen.title,
        description: chosen.subject || 'Đấu trường Kahoot Trực tiếp',
        questions: mappedQuestions,
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      secondsPerQuestion: 20,
      questionStartedAt: Date.now(),
      answersByPlayer: {},
      isHostInstance: true,
      players: [
        {
          playerId: `host-${Crypto.randomUUID().slice(0, 8)}`,
          nickname: hostName,
          score: 0,
          isHost: true,
        },
      ],
    };

    liveRooms.set(code, room);
    socket.ensureChannel(code);
    return { roomCode: code, room };
  },

  async join(roomCode: string, nickname: string): Promise<{ playerId: string; room: RoomData }> {
    wireRealtimeRoomSync();
    const code = roomCode.trim().toUpperCase();
    const playerId = `p-${Crypto.randomUUID().slice(0, 8)}`;
    const player: RoomPlayer = { playerId, nickname: nickname.trim() || 'Học giả', score: 0 };

    socket.ensureChannel(code);

    // Request authoritative room state from Host across Supabase Realtime
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
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_REQUEST, { roomCode: code, joinPlayer: player }, false);
      setTimeout(finish, 900);
    });

    let room = liveRooms.get(code);
    if (!room) {
      // Fallback instant practice room if testing single-device without active Host tab
      const defaultSet = seedQuestionSets[0]!;
      room = {
        roomCode: code,
        quizId: {
          id: defaultSet.id,
          title: defaultSet.title,
          description: 'Phòng Kahoot Nhanh',
          questions: defaultSet.questions.slice(0, 8).map((q) => ({
            question: q.content,
            options: q.options.slice(0, 4),
            correctAnswer: q.correctIndex,
          })),
        },
        status: 'waiting',
        currentQuestionIndex: 0,
        secondsPerQuestion: 20,
        questionStartedAt: Date.now(),
        answersByPlayer: {},
        isHostInstance: true,
        players: [
          { playerId: 'bot-host', nickname: 'Papybot Host 🤖', score: 0, isHost: true },
          player,
        ],
      };
      liveRooms.set(code, room);
    } else if (!room.players.some((p) => p.playerId === playerId)) {
      room.players = [...room.players, player];
    }

    return { playerId, room };
  },

  async get(roomCode: string): Promise<RoomData> {
    wireRealtimeRoomSync();
    const code = (roomCode || '').trim().toUpperCase();
    const found = liveRooms.get(code);
    if (found) return found;

    const fallbackSet = seedQuestionSets[0]!;
    return {
      roomCode: code,
      quizId: {
        id: fallbackSet.id,
        title: fallbackSet.title,
        description: 'Phòng Quiz Trực tiếp',
        questions: fallbackSet.questions.slice(0, 6).map((q) => ({
          question: q.content,
          options: q.options.slice(0, 4),
          correctAnswer: q.correctIndex,
        })),
      },
      status: 'waiting',
      currentQuestionIndex: 0,
      players: [],
    };
  },
};
