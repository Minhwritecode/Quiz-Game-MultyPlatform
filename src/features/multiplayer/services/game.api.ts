import type { CurrentQuestionData } from '../domain/models';
import { socket, SOCKET_EVENTS } from './socket';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export const gameApi = {
  async getCurrentQuestion(roomCode: string): Promise<CurrentQuestionData> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/game/${roomCode}/question`);
      if (res.ok) {
        const json = await res.json();
        if (json?.data) return json.data;
      }
    } catch {
      // Fallback
    }

    return {
      index: 0,
      totalQuestions: 3,
      question: 'Trong thần thoại Hy Lạp, vị thần nào gắn liền với cây đàn Lia và ánh sáng?',
      options: ['Ares', 'Hermes', 'Apollo', 'Dionysus'],
      remainingTime: 15,
    };
  },

  submitAnswer(roomCode: string, answer: number) {
    socket.emit(SOCKET_EVENTS.SUBMIT_ANSWER, { roomCode, answer });
  },

  startQuiz(roomCode: string) {
    socket.emit(SOCKET_EVENTS.START_QUIZ, roomCode);
  },

  pauseQuiz(roomCode: string) {
    socket.emit(SOCKET_EVENTS.PAUSE_QUIZ, roomCode);
  },

  resumeQuiz(roomCode: string) {
    socket.emit(SOCKET_EVENTS.RESUME_QUIZ, roomCode);
  },

  endQuiz(roomCode: string) {
    socket.emit(SOCKET_EVENTS.END_QUIZ, roomCode);
  },
};
