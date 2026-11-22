import { createBattleSessionUseCases } from './session';
it('isolates restored sessions by owner and rejects invalid writes', async () => {
  const sessions = new Map<string, string>();
  const service = createBattleSessionUseCases({
    load: async owner => sessions.get(owner) ?? null,
    save: async (owner, room) => { sessions.set(owner, room); },
    clear: async owner => { sessions.delete(owner); },
  });
  await service.save('alice', 'room-a');
  await expect(service.load('bob')).resolves.toBeNull();
  await expect(service.load('alice')).resolves.toBe('room-a');
  expect(() => service.save('', 'room-a')).toThrow();
  expect(() => service.save('alice', '')).toThrow();
  await service.clear('alice');
  await expect(service.load('alice')).resolves.toBeNull();
});
