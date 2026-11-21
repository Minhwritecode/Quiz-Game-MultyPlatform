// Pure deep-link invite parser for Room & 1v1 Duel invites (Group G — FR-15)
// Works consistently when app is cold-started, foregrounded, or awaiting authentication.

export interface ParsedBattleInvite {
  kind: 'room' | 'duel';
  code: string;
}

export function normalizeInviteCode(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

export function parseBattleInviteParams(params: {
  code?: string | null;
  invite?: string | null;
}): ParsedBattleInvite | null {
  const duelCode = normalizeInviteCode(params.invite);
  if (duelCode.length >= 4) {
    return { kind: 'duel', code: duelCode };
  }
  const roomCode = normalizeInviteCode(params.code);
  if (roomCode.length === 6) {
    return { kind: 'room', code: roomCode };
  }
  return null;
}
