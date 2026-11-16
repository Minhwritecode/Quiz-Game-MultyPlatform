import type { PreferenceStorage } from '../domain/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const preferenceStorage: PreferenceStorage = {
 getItem:(key:string)=>AsyncStorage.getItem(key),
 setItem:(key:string,value:string)=>AsyncStorage.setItem(key,value),
 removeItem:(key:string)=>AsyncStorage.removeItem(key),
};
