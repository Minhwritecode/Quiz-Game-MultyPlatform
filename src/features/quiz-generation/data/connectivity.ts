import { AppState } from 'react-native';
import * as Network from 'expo-network';

export async function generationNetworkAvailable(): Promise<boolean> {
  if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return false;
  const state = await Network.getNetworkStateAsync();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function observeGenerationWake(wake: () => void): () => void {
  const app = AppState.addEventListener('change', state => { if (state === 'active') wake(); });
  const network = Network.addNetworkStateListener(state => {
    if (state.isConnected !== false && state.isInternetReachable !== false) wake();
  });
  return () => { app.remove(); network.remove(); };
}
