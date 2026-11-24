import type { CurrentQuestionData, LeaderboardPlayer } from '../domain/models';
import { calculateSpeedPoints } from '../domain/shapes';
import { useMultiplayerStore } from '../state/useMultiplayerStore';
import { liveRooms } from './room.api';
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
  const q = room.quizId.questions?.[room.currentQuestionIndex] as
    | { question: string; options: string[]; correctAnswer: number; explanation?: string }
    | undefined;
  if (!q) return;

  const lb = buildLeaderboard(code);
  socket.broadcast(code, SOCKET_EVENTS.QUESTION_ENDED, {
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  });
  socket.broadcast(code, SOCKET_EVENTS.LEADERBOARD_UPDATED, { leaderboard: lb });

  // Automatically advance after 4.2s reveal pause so multi-player Kahoot flows smoothly!
  const nextIdx = room.currentQuestionIndex + 1;
  const total = room.quizId.questions?.length ?? 0;
  const advanceTimer = setTimeout(() => {
    if (nextIdx >= total) {
      room.status = 'ended';
      socket.broadcast(code, SOCKET_EVENTS.QUIZ_FINISHED, { leaderboard: buildLeaderboard(code) });
    } else {
      room.currentQuestionIndex = nextIdx;
      room.questionStartedAt = Date.now();
      room.answersByPlayer = {};
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, { room: { ...room, isHostInstance: false } });
      socket.broadcast(code, SOCKET_EVENTS.NEXT_QUESTION, { index: nextIdx });
      scheduleRoundClose(code);
    }
  }, 4200);
  activeTimers.set(code, advanceTimer);
}

// Listen for remote player answers on Host instance
let answerListenerWired = false;
function ensureHostAnswerListener() {
  if (answerListenerWired) return;
  answerListenerWired = true;

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
      const isRight = q ? payload.answer === q.correctAnswer : false;
      const pts = calculateSpeedPoints(isRight, elapsedSec, room.secondsPerQuestion);

      room.players = room.players.map((p) =>
        p.nickname === nick ? { ...p, score: p.score + pts } : p
      );

      // Early-close round when all non-host players (or all players) have answered!
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
    const room = liveRooms.get(code);
    const questions = room?.quizId.questions ?? [];
    const idx = room?.currentQuestionIndex ?? 0;
    const item = questions[idx];

    if (room && item) {
      const elapsed = Math.floor((Date.now() - room.questionStartedAt) / 1000);
      return {
        index: idx,
        totalQuestions: questions.length,
        question: item.question,
        options: item.options,
        remainingTime: Math.max(3, room.secondsPerQuestion - elapsed),
      };
    }

    return {
      index: 0,
      totalQuestions: 1,
      question: 'Đang đồng bộ câu hỏi trực tiếp từ Chủ phòng...',
      options: ['Sẵn sàng A', 'Sẵn sàng B', 'Sẵn sàng C', 'Sẵn sàng D'],
      remainingTime: 20,
    };
  },

  submitAnswer(roomCode: string, answer: number) {
    ensureHostAnswerListener();
    const code = roomCode.trim().toUpperCase();
    const nickname = useMultiplayerStore.getState().nickname || 'Chủ phòng (Host)';
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
      socket.broadcast(code, SOCKET_EVENTS.ROOM_SYNC_STATE, { room: { ...room, isHostInstance: false } });
    }
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_STARTED, { roomCode: code }, true);
    scheduleRoundClose(code);
  },

  pauseQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    clearRoomTimer(code);
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_PAUSED, { roomCode: code }, true);
  },

  resumeQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_RESUMED, { roomCode: code, remainingTime: 15 }, true);
    scheduleRoundClose(code);
  },

  endQuiz(roomCode: string) {
    const code = roomCode.trim().toUpperCase();
    clearRoomTimer(code);
    socket.broadcast(code, SOCKET_EVENTS.QUIZ_FINISHED, { leaderboard: buildLeaderboard(code) }, true);
  },
};
