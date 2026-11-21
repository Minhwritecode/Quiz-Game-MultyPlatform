import { create } from 'zustand';
import type { LeaderboardPlayer, RoomData } from '../domain/models';

interface MultiplayerState {
  currentRoom: RoomData | null;
  nickname: string;
  roomCode: string;
  leaderboard: LeaderboardPlayer[];
  finalResults: LeaderboardPlayer[];
  setCurrentRoom: (room: RoomData | null) => void;
  setPlayerInfo: (roomCode: string, nickname: string) => void;
  setLeaderboard: (list: LeaderboardPlayer[]) => void;
  setFinalResults: (list: LeaderboardPlayer[]) => void;
  reset: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  currentRoom: null,
  nickname: 'Người chơi',
  roomCode: '',
  leaderboard: [],
  finalResults: [],

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setPlayerInfo: (roomCode, nickname) => set({ roomCode, nickname }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setFinalResults: (finalResults) => set({ finalResults }),
  reset: () => set({ currentRoom: null, leaderboard: [], finalResults: [] }),
}));
