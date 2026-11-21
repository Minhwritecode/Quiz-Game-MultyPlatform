import { normalizeInviteCode, parseBattleInviteParams } from './pendingInvite';

describe('pendingInvite deep-link parsing', () => {
  it('parses 6-character room PIN invites cleanly', () => {
    expect(parseBattleInviteParams({ code: ' ab-12cd ' })).toEqual({ kind: 'room', code: 'AB12CD' });
    expect(parseBattleInviteParams({ code: '123' })).toBeNull();
  });

  it('parses 1v1 friend duel invite codes with priority', () => {
    expect(parseBattleInviteParams({ invite: 'duel99', code: 'ABCDEF' })).toEqual({
      kind: 'duel',
      code: 'DUEL99',
    });
    expect(normalizeInviteCode('  x9-k2!  ')).toBe('X9K2');
  });
});
