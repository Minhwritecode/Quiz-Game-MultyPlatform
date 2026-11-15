import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/core/network/supabase';
import { syncHistory } from './historySync';
jest.mock('@/core/network/supabase',()=>({supabase:{auth:{getUser:jest.fn()},rpc:jest.fn(),from:jest.fn()}}));
jest.mock('./history',()=>({saveHistory:jest.fn(),loadHistory:jest.fn().mockResolvedValue([])}));
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn().mockResolvedValue(null),setItem:jest.fn().mockResolvedValue(undefined),removeItem:jest.fn().mockResolvedValue(undefined)}));
beforeEach(()=>jest.clearAllMocks());
it('does not upload to a different signed-in account',async()=>{
 (supabase!.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{id:'other'}}});
 await expect(syncHistory('owner',[])).rejects.toThrow('Đăng nhập');expect(supabase!.rpc).not.toHaveBeenCalled();
});
it('preserves local data and stops on concurrent revision conflict',async()=>{
 (supabase!.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{id:'owner'}}});
 (supabase!.rpc as jest.Mock).mockResolvedValue({error:{message:'CHAT_CONFLICT'}});
 await expect(syncHistory('owner',[{id:'chat',updatedAt:1,messages:[{role:'user',content:'Q'},{role:'assistant',content:'A'}]}])).rejects.toThrow('thiết bị khác');
 expect(AsyncStorage.setItem).not.toHaveBeenCalled();expect(supabase!.from).not.toHaveBeenCalled();
});
