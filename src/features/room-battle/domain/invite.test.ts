import { parseRoomInvite, roomInvite } from './invite';
it('accepts room codes and Papyrus invites',()=>{expect(parseRoomInvite(' abc123 ')).toBe('ABC123');expect(parseRoomInvite('papyrus://battle?code=AB12CD')).toBe('AB12CD');});
it('rejects other apps, hosts and malformed codes',()=>{for(const input of ['https://evil.test?code=ABC123','papyrus://settings?code=ABC123','papyrus://battle?code=TOOLONG','javascript:alert(1)'])expect(parseRoomInvite(input)).toBeNull();});

it('supports development and preview scheme round trips',()=>{for(const scheme of ['papyrus','papyrus-dev','papyrus-preview'])expect(parseRoomInvite(roomInvite('ABC123',scheme))).toBe('ABC123');});
