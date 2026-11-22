import { AppState } from 'react-native';
import * as Network from 'expo-network';
export function observeSyncWake(wake: () => void): () => void {
  const app = AppState.addEventListener('change', state => { if (state === 'active') wake(); });
  const network = Network.addNetworkStateListener(state => { if (state.isConnected !== false && state.isInternetReachable !== false) wake(); });
  return () => { app.remove(); network.remove(); };
}
export async function canSync(): Promise<boolean> {
  if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return false;
  const state = await Network.getNetworkStateAsync();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
