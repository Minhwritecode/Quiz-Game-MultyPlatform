import { clearChatSync } from '@/features/assistant/data/historySync';
import { saveHistory } from '@/features/assistant/data/history';
import AsyncStorage from '@react-native-async-storage/async-storage';
export async function eraseLocalData(owner:string) {
  await AsyncStorage.multiRemove([`learning-sync:v1:${encodeURIComponent(owner)}`,`papyrus.progress.v2:${owner}`]);
  await saveHistory(owner, []);
  await clearChatSync(owner);
  await AsyncStorage.multiRemove(['papyrus.local.question-sets','papyrus.local.attempts','papyrus.local.study-progress','papyrus.local.sync-queue',`papyrus.cloud.${owner}`,`papyrus.battle.${owner}`]);
}
