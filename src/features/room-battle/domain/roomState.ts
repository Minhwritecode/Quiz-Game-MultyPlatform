export type RoomPhase = 'waiting' | 'countdown' | 'question_open' | 'question_result' | 'finished';

export type RoomSnapshot = {
  roomId: string;
  phase: RoomPhase;
  questionPosition: number | null;
  questionClosesAt: string | null;
  playerIds: string[];
};

export type RoomEvent =
  | { type: 'room_received'; snapshot: RoomSnapshot }
  | { type: 'countdown_started' }
  | { type: 'question_opened'; position: number; closesAt: string }
  | { type: 'question_closed' }
  | { type: 'room_finished' }
  | { type: 'player_joined'; playerId: string }
  | { type: 'player_left'; playerId: string };

export function reduceRoomState(state: RoomSnapshot | null, event: RoomEvent): RoomSnapshot | null {
  if (event.type === 'room_received') return event.snapshot;
  if (!state) return null;

  switch (event.type) {
    case 'countdown_started':
      return state.phase === 'waiting' ? { ...state, phase: 'countdown' } : state;
    case 'question_opened':
      return state.phase === 'countdown' || state.phase === 'question_result'
        ? { ...state, phase: 'question_open', questionPosition: event.position, questionClosesAt: event.closesAt }
        : state;
    case 'question_closed':
      return state.phase === 'question_open' ? { ...state, phase: 'question_result', questionClosesAt: null } : state;
    case 'room_finished':
      return { ...state, phase: 'finished', questionClosesAt: null };
    case 'player_joined':
      return state.playerIds.includes(event.playerId) ? state : { ...state, playerIds: [...state.playerIds, event.playerId] };
    case 'player_left':
      return { ...state, playerIds: state.playerIds.filter((playerId) => playerId !== event.playerId) };
    default:
      return state;
  }
}
