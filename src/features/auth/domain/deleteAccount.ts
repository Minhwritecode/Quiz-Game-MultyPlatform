export interface AccountDeletionPorts {
  removeRemote(): Promise<void>;
  clearSession(): Promise<void>;
  eraseDevice(): Promise<void>;
}
export async function deleteAccount(ports: AccountDeletionPorts):Promise<{cleanupRequired:boolean}> {
  await ports.removeRemote(); // Never erase recoverable device data on network failure.
  let cleanupRequired=false;
  try {await ports.clearSession();} catch {cleanupRequired=true;}
  try {await ports.eraseDevice();} catch {cleanupRequired=true;}
  return {cleanupRequired};
}
