import AsyncStorage from '@react-native-async-storage/async-storage';
export const readCloudState=(key:string)=>AsyncStorage.getItem(`papyrus.cloud.${key}`);
export const writeCloudState=(key:string,value:string)=>AsyncStorage.setItem(`papyrus.cloud.${key}`,value);
