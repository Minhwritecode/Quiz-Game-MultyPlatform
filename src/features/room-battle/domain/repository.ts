import type { RoomPhase } from './roomState';

export type RoomRecord = {
  id: string;
  code: string;
  hostId: string;
  setId: string;
  mode: 'speed' | 'survival';
  status: RoomPhase;
  questionCount: number;
  secondsPerQuestion: number;
  startedAt: string | null;
  createdAt: string;
};

export type RoomRepository = {
  create(input: { setId: string; questionCount: number; secondsPerQuestion: number; mode: RoomRecord['mode'] }): Promise<RoomRecord>;
  join(code: string): Promise<RoomRecord>;
  subscribe(roomId: string, onRoomChanged: (room: RoomRecord) => void): () => void;
};
