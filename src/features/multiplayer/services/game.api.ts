import type { CurrentQuestionData, LeaderboardPlayer } from '../domain/models';
import { calculateSpeedPoints } from '../domain/shapes';
import { useMultiplayerStore } from '../state/useMultiplayerStore';
import { liveRooms, persistKahootRoomSnapshot, roomApi, type LiveKahootRoomState } from './room.api';
import { socket, SOCKET_EVENTS } from './socket';

export const BACKEND_URL = 'supabase-realtime';

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearRoomTimer(code: string) {
  const t = activeTimers.get(code);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(code);
  }
}

function buildLeaderboard(code: string): LeaderboardPlayer[] {
  const room = liveRooms.get(code);
  if (!room) return [];
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      score: p.score,
      rank: idx + 1,
    }));
}

function scheduleRoundClose(code: string) {
  clearRoomTimer(code);
  const room = liveRooms.get(code);
  if (!room || !room.isHostInstance) return;

  const timer = setTimeout(() => {
    closeCurrentRound(code);
  }, room.secondsPerQuestion * 1000);
  activeTimers.set(code, timer);
}

function closeCurrentRound(code: string) {
  clearRoomTimer(code);
  const room = liveRooms.get(code);
  if (!room) return;
  const q = room.quizId.questions?.[room.currentQuestionIndex];
  if (!q) return;

  const lb = buildLeaderboard(code);
  useMultiplayerStore.getState().setLeaderboard(lb);
  void persistKahootRoomSnapshot(room);

  socket.broadcast(code, SOCKET_EVENTS.QUESTION_ENDED, {
    correctAnswer: q.correctAnswer ?? 0,
    explanation: q.explanation,
  });
  socket.broadcast(code, SOCKET_EVENTS.LEADERBOARD_UPDATED, { leaderboard: lb });

  const { autoAdvance, autoAdvanceDelaySec } = useMultiplayerStore.getState();
  const delayMs = (autoAdvance ? autoAdvanceDelaySec : 5) * 1000;
  const nextIdx = room.currentQuestionIndex + 1;
  const total = room.quizId.questions?.length ?? 0;

  const advanceTimer = setTimeout(() => {
    if (nextIdx >= total) {
      room.status = 'ended';
      const finalLb = buildLeaderboard(code);
      useMultiplayerStore.getState().setFinalResults(finalLb);
      void persistKahootRoomSnapshot(room);
      socket.broadcast(code, SOCKET_EVENTS.QUIZ_FINISHED, { leaderboard: finalLb });
    } else {
      room.currentQuestionIndex = nextIdx;
      room.questionStartedAt = Date.now();
      room.answersByPlayer = {};
      void persistKahootRoomSnapshot(room);
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
        room: { ...room, isHostInstance: false },
      });
      socket.broadcast(code, SOCKET_EVENTS.NEXT_QUESTION, {
        index: nextIdx,
        room: { ...room, isHostInstance: false },
      });
      scheduleRoundClose(code);
    }
  }, delayMs);
  activeTimers.set(code, advanceTimer);
}

// Listen for remote player answers + incoming room state on all instances
let answerListenerWired = false;
function ensureHostAnswerListener() {
  if (answerListenerWired) return;
  answerListenerWired = true;

  socket.on(
    SOCKET_EVENTS.QUIZ_STARTED,
    (payload?: { roomCode?: string; room?: LiveKahootRoomState }) => {
      const incoming = payload?.room;
      if (!incoming?.roomCode) return;
      const code = incoming.roomCode.toUpperCase();
      const existing = liveRooms.get(code);
      if (existing?.isHostInstance) return;
      const synced: LiveKahootRoomState = { ...incoming, isHostInstance: false };
      liveRooms.set(code, synced);
      useMultiplayerStore.getState().setCurrentRoom(synced);
    }
  );

  socket.on(
    SOCKET_EVENTS.NEXT_QUESTION,
    (payload?: { index?: number; room?: LiveKahootRoomState }) => {
      const incoming = payload?.room;
      if (!incoming?.roomCode) return;
      const code = incoming.roomCode.toUpperCase();
      const existing = liveRooms.get(code);
      if (existing?.isHostInstance) return;
      const synced: LiveKahootRoomState = { ...incoming, isHostInstance: false };
      liveRooms.set(code, synced);
      useMultiplayerStore.getState().setCurrentRoom(synced);
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_ANSWER,
    (payload: { roomCode?: string; answer?: number; nickname?: string }) => {
      const code = (payload?.roomCode || '').toUpperCase();
      const room = liveRooms.get(code);
      if (!room || !room.isHostInstance || typeof payload?.answer !== 'number') return;

      const nick = payload.nickname || 'Học giả';
      if (room.answersByPlayer[nick]) return;
      const elapsedSec = Math.max(0.2, (Date.now() - room.questionStartedAt) / 1000);
      room.answersByPlayer[nick] = { answer: payload.answer, elapsedSec };

      const q = room.quizId.questions?.[room.currentQuestionIndex];
      const isRight = q ? payload.answer === (q.correctAnswer ?? 0) : false;
      const pts = calculateSpeedPoints(isRight, elapsedSec, room.secondsPerQuestion);

      const matchedExisting = room.players.some((p) => p.nickname === nick);
      room.players = matchedExisting
        ? room.players.map((p) => (p.nickname === nick ? { ...p, score: p.score + pts } : p))
        : [...room.players, { playerId: `p-${Date.now()}`, nickname: nick, score: pts }];

      void persistKahootRoomSnapshot(room);

      const expectedPlayers = Math.max(1, room.players.length);
      if (Object.keys(room.answersByPlayer).length >= expectedPlayers) {
        closeCurrentRound(code);
      }
    }
  );
}

export const gameApi = {
  async getCurrentQuestion(roomCode: string): Promise<CurrentQuestionData> {
    ensureHostAnswerListener();
    const code = (roomCode || '').trim().toUpperCase();
    let room = liveRooms.get(code);
    if (!room) {
      const loaded = await roomApi.get(code);
      room = liveRooms.get(code) ?? ({
        ...loaded,
        secondsPerQuestion: loaded.timeLimit ?? 20,
        questionStartedAt: Date.now(),
        answersByPlayer: {},
      } as LiveKahootRoomState);
    }
    const questions = room?.quizId.questions ?? [];
    const idx = Math.min(Math.max(0, room?.currentQuestionIndex ?? 0), Math.max(0, questions.length - 1));
    const item = questions[idx];

    if (room && item) {
      const secLimit = room.secondsPerQuestion || room.timeLimit || 20;
      const elapsed = Math.floor((Date.now() - (room.questionStartedAt || Date.now())) / 1000);
      return {
        index: idx,
        totalQuestions: questions.length,
        question: item.question,
        options: item.options,
        remainingTime: Math.max(3, Math.min(secLimit, secLimit - Math.max(0, elapsed))),
        explanation: item.explanation,
        codeSnippet: item.codeSnippet,
      };
    }

    return {
      index: 0,
      totalQuestions: 1,
      question: 'Đang đồng bộ câu hỏi trực tiếp từ Chủ phòng...',
      options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
      remainingTime: 20,
    };
  },

  submitAnswer(roomCode: string, answer: number) {
    ensureHostAnswerListener();
    const code = roomCode.trim().toUpperCase();
    const nickname = useMultiplayerStore.getState().nickname || 'Chủ phòng';
    socket.broadcast(code, SOCKET_EVENTS.SUBMIT_ANSWER, { roomCode: code, answer, nickname }, true);
  },

  startQuiz(roomCode: string) {
    ensureHostAnswerListener();
    const code = roomCode.trim().toUpperCase();
    const room = liveRooms.get(code);
    if (room) {
      room.status = 'live';
      room.currentQuestionIndex = 0;
      room.questionStartedAt = Date.now();
      room.answersByPlayer = {};
      useMultiplayerStore.getState().setCurrentRoom({ ...room });
      void persistKahootRoomSnapshot(room);
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, {
        room: { ...room, isHostInstance: false },
      });
      socket.broadcast(
        code,
        SOCKET_EVENTS.QUIZ_STARTED,
        { roomCode: code, room: { ...room, isHostInstance: false } },
        true
      );
    } else {
      socket.broadcast(code, SOCKET_EVENTS.QUIZ_STARTED, { roomCode: code }, true);
    }
    scheduleRoundClose(code);
  },

  pauseQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    clearRoomTimer(code);
    const room = liveRooms.get(code);
    if (room) {
      room.status = 'paused';
      void persistKahootRoomSnapshot(room);
    }
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_PAUSED, { roomCode: code }, true);
  },

  resumeQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    const room = liveRooms.get(code);
    if (room) {
      room.status = 'live';
      room.questionStartedAt = Date.now();
      void persistKahootRoomSnapshot(room);
    }
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_RESUMED, { roomCode: code, remainingTime: 15 }, true);
    scheduleRoundClose(code);
  },

  endQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    clearRoomTimer(code);
    const room = liveRooms.get(code);
    const finalLb = buildLeaderboard(code);
    useMultiplayerStore.getState().setFinalResults(finalLb);
    if (room) {
      room.status = 'ended';
      void persistKahootRoomSnapshot(room);
    }
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_FINISHED, { leaderboard: finalLb }, true);
  },
};
