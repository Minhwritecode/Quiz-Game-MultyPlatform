import AsyncStorage from '@react-native-async-storage/async-storage';
export async function eraseLocalData(owner:string) {
  await AsyncStorage.multiRemove(['papyrus.local.question-sets','papyrus.local.attempts','papyrus.local.study-progress','papyrus.local.sync-queue',`papyrus.cloud.${owner}`,`papyrus.battle.${owner}`]);
}
