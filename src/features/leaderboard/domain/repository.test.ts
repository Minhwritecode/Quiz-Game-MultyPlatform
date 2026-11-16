import { createLeaderboardUseCases } from './repository';
it('rejects invalid pagination before querying and preserves domain rankings', async () => {
  const ranking = { rank: 1, displayName: 'Minh', points: 10, matches: 1, isMe: true };
  const list = jest.fn().mockResolvedValue([ranking]);
  const service = createLeaderboardUseCases({ list });
  for (const offset of [-1, NaN, 1.5, 10001]) expect(() => service.list(offset)).toThrow();
  expect(list).not.toHaveBeenCalled();
  await expect(service.list(25)).resolves.toEqual([ranking]);
  expect(list).toHaveBeenCalledWith(25);
});
