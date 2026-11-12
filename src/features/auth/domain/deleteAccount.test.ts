import { deleteAccount } from './deleteAccount';
test('preserves device data if cloud deletion fails',async()=>{
  const eraseDevice=jest.fn(),clearSession=jest.fn();
  await expect(deleteAccount({removeRemote:async()=>{throw new Error('offline');},eraseDevice,clearSession})).rejects.toThrow('offline');
  expect(eraseDevice).not.toHaveBeenCalled();expect(clearSession).not.toHaveBeenCalled();
});
test('reports cleanup failure without pretending the deleted account still exists',async()=>{
  const calls:string[]=[];
  expect(await deleteAccount({removeRemote:async()=>{calls.push('remote');},clearSession:async()=>{calls.push('session');},eraseDevice:async()=>{calls.push('device');throw new Error('disk');}})).toEqual({cleanupRequired:true});
  expect(calls).toEqual(['remote','session','device']);
});
