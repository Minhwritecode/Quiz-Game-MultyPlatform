import { clearChatSync } from '@/features/assistant/data/historySync';
import { saveHistory } from '@/features/assistant/data/history';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDatabase } from '@/core/database/sqlite.native';
export async function eraseLocalData(owner:string) {
  await AsyncStorage.multiRemove([`learning-sync:v1:${encodeURIComponent(owner)}`,`papyrus.progress.v2:${owner}`]);
  await saveHistory(owner, []);
  await clearChatSync(owner);
  const db=getLocalDatabase();
  db.withTransactionSync(()=>{
    db.execSync('DELETE FROM study_progress; DELETE FROM attempt_answers; DELETE FROM attempts; DELETE FROM questions; DELETE FROM question_sets; DELETE FROM sync_queue;');
    db.execSync('CREATE TABLE IF NOT EXISTS account_sync_state (owner TEXT PRIMARY KEY NOT NULL, state TEXT NOT NULL)');
    db.runSync('DELETE FROM account_sync_state WHERE owner=?',owner);
  });
  await AsyncStorage.removeItem(`papyrus.battle.${owner}`);
}
