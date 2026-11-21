import { io, Socket } from 'socket.io-client';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';

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

  // Error
  QUIZ_ERROR: 'quiz-error',
} as const;

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(BACKEND_URL, {
      autoConnect: false,
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
}

export const socket = getSocket();
