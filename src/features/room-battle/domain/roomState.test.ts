import { reduceRoomState, type RoomSnapshot } from './roomState';

const waiting: RoomSnapshot = { roomId: 'room-1', phase: 'waiting', questionPosition: null, questionClosesAt: null, playerIds: ['host'] };

describe('reduceRoomState', () => {
  it('allows only valid server event transitions', () => {
    const countdown = reduceRoomState(waiting, { type: 'countdown_started' });
    const open = reduceRoomState(countdown, { type: 'question_opened', position: 0, closesAt: '2026-11-10T00:00:15.000Z' });
    const closed = reduceRoomState(open, { type: 'question_closed' });
    expect(countdown?.phase).toBe('countdown');
    expect(open?.phase).toBe('question_open');
    expect(closed?.phase).toBe('question_result');
    expect(reduceRoomState(waiting, { type: 'question_opened', position: 0, closesAt: 'invalid' })?.phase).toBe('waiting');
  });

  it('keeps player membership idempotent', () => {
    const joined = reduceRoomState(waiting, { type: 'player_joined', playerId: 'guest' });
    const duplicate = reduceRoomState(joined, { type: 'player_joined', playerId: 'guest' });
    expect(duplicate?.playerIds).toEqual(['host', 'guest']);
  });
});
