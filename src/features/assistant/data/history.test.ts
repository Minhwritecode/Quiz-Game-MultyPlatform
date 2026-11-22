import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadHistory, saveHistory } from './history';
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(),setItem:jest.fn().mockResolvedValue(undefined)}));
const conversation={id:'one',updatedAt:1,messages:[{role:'user' as const,content:'Question'},{role:'assistant' as const,content:'Answer'}]};
beforeEach(()=>jest.clearAllMocks());
it('separates accounts and bounds saved histories',async()=>{
 await saveHistory('alice',Array.from({length:25},(_,i)=>({...conversation,id:String(i)})));
 expect(AsyncStorage.setItem).toHaveBeenCalledWith('papybot:history:v1:alice',expect.any(String));
 expect(JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1])).toHaveLength(20);
 (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
 expect(await loadHistory('bob')).toEqual([]);
 expect(AsyncStorage.getItem).toHaveBeenCalledWith('papybot:history:v1:bob');
});
it('rejects corrupt history and invalid roles',async()=>{
 (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{');expect(await loadHistory('a')).toEqual([]);
 (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([{...conversation,messages:[{role:'system',content:'x'},{role:'assistant',content:'y'}]}]));
 expect(await loadHistory('a')).toEqual([]);
});
it('continues saving after a storage failure',async()=>{
 (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));
 await expect(saveHistory('a',[conversation])).rejects.toThrow('full');
 await expect(saveHistory('a',[])).resolves.toBeUndefined();
});
