import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { socket, SOCKET_EVENTS } from '../services/socket';
import type { LeaderboardPlayer } from '../domain/models';

interface UseGameEventsProps {
  roomCode: string;
  refreshQuestion?: () => void;
  revealAnswer?: (correctAnswer: number) => void;
  onPause?: () => void;
  onResume?: (remainingTime: number) => void;
  onLeaderboard?: (players: LeaderboardPlayer[]) => void;
}

export function useGameEvents({
  roomCode,
  refreshQuestion,
  revealAnswer,
  onPause,
  onResume,
  onLeaderboard,
}: UseGameEventsProps) {
  const router = useRouter();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomCode);

    const onQuestionEnded = (payload: { correctAnswer: number }) => {
      revealAnswer?.(payload.correctAnswer);
    };

    const onLeaderboardUpdated = (payload: { leaderboard: LeaderboardPlayer[] }) => {
      onLeaderboard?.(payload.leaderboard || []);
    };

    const onShowLeaderboard = () => {
      router.push({
        pathname: '/multiplayer/leaderboard/[roomCode]',
        params: { roomCode },
      });
    };

    const handlePause = () => {
      onPause?.();
    };

    const handleResume = (payload: { remainingTime: number }) => {
      onResume?.(payload.remainingTime);
    };

    const onNextQuestion = () => {
      refreshQuestion?.();
      router.push({
        pathname: '/multiplayer/question/[roomCode]',
        params: { roomCode },
      });
    };

    const onQuizFinished = () => {
      router.push({
        pathname: '/multiplayer/results/[roomCode]',
        params: { roomCode },
      });
    };

    socket.on(SOCKET_EVENTS.QUESTION_ENDED, onQuestionEnded);
    socket.on(SOCKET_EVENTS.LEADERBOARD_UPDATED, onLeaderboardUpdated);
    socket.on(SOCKET_EVENTS.SHOW_LEADERBOARD, onShowLeaderboard);
    socket.on(SOCKET_EVENTS.QUIZ_PAUSED, handlePause);
    socket.on(SOCKET_EVENTS.QUIZ_RESUMED, handleResume);
    socket.on(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
    socket.on(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);

    return () => {
      socket.off(SOCKET_EVENTS.QUESTION_ENDED, onQuestionEnded);
      socket.off(SOCKET_EVENTS.LEADERBOARD_UPDATED, onLeaderboardUpdated);
      socket.off(SOCKET_EVENTS.SHOW_LEADERBOARD, onShowLeaderboard);
      socket.off(SOCKET_EVENTS.QUIZ_PAUSED, handlePause);
      socket.off(SOCKET_EVENTS.QUIZ_RESUMED, handleResume);
      socket.off(SOCKET_EVENTS.NEXT_QUESTION, onNextQuestion);
      socket.off(SOCKET_EVENTS.QUIZ_FINISHED, onQuizFinished);
    };
  }, [roomCode, router, refreshQuestion, revealAnswer, onPause, onResume, onLeaderboard]);
}
