import { create } from 'zustand';
import type { LeaderboardPlayer, RoomData } from '../domain/models';

interface MultiplayerState {
  currentRoom: RoomData | null;
  nickname: string;
  roomCode: string;
  leaderboard: LeaderboardPlayer[];
  finalResults: LeaderboardPlayer[];
  autoAdvance: boolean;
  autoAdvanceDelaySec: 3 | 5 | 8;
  setCurrentRoom: (room: RoomData | null) => void;
  setPlayerInfo: (roomCode: string, nickname: string) => void;
  setLeaderboard: (list: LeaderboardPlayer[]) => void;
  setFinalResults: (list: LeaderboardPlayer[]) => void;
  setAutoAdvance: (enabled: boolean) => void;
  setAutoAdvanceDelaySec: (sec: 3 | 5 | 8) => void;
  reset: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  currentRoom: null,
  nickname: 'Người chơi',
  roomCode: '',
  leaderboard: [],
  finalResults: [],
  autoAdvance: true,
  autoAdvanceDelaySec: 5,

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setPlayerInfo: (roomCode, nickname) => set({ roomCode, nickname }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setFinalResults: (finalResults) => set({ finalResults }),
  setAutoAdvance: (autoAdvance) => set({ autoAdvance }),
  setAutoAdvanceDelaySec: (autoAdvanceDelaySec) => set({ autoAdvanceDelaySec }),
  reset: () => set({ currentRoom: null, leaderboard: [], finalResults: [] }),
}));
