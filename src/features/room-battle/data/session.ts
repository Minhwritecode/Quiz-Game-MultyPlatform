import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BattleSessionRepository } from '../domain/session';
export const battleSession:BattleSessionRepository={
 load:owner=>AsyncStorage.getItem(`papyrus.battle.${owner}`),
 save:(owner,id)=>AsyncStorage.setItem(`papyrus.battle.${owner}`,id),
 clear:owner=>AsyncStorage.removeItem(`papyrus.battle.${owner}`),
};
