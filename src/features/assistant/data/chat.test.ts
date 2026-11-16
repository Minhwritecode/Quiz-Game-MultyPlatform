jest.mock('expo/fetch',()=>({fetch:jest.fn()}));
import { askPapybot } from './chat';
import { supabase } from '@/core/network/supabase';
jest.mock('@/core/network/supabase',()=>({supabase:{auth:{getSession:jest.fn()},functions:{invoke:jest.fn()}}}));
const session=supabase!.auth.getSession as jest.Mock;
const invoke=supabase!.functions.invoke as jest.Mock;
beforeEach(()=>{jest.clearAllMocks();session.mockResolvedValue({data:{session:{access_token:'test'}}});});
it('rejects guests before invoking AI',async()=>{
 session.mockResolvedValue({data:{session:null}});
 await expect(askPapybot([{role:'user',content:'Hi'}],'/sets',undefined,new AbortController().signal)).rejects.toThrow('Đăng nhập');
 expect(invoke).not.toHaveBeenCalled();
});
it('sends conversation and extracted document together',async()=>{
 invoke.mockResolvedValue({data:{answer:'Answer'},error:null});
 const messages=[{role:'user' as const,content:'Question'}];
 await expect(askPapybot(messages,'/sets','Document text',new AbortController().signal)).resolves.toBe('Answer');
 expect(invoke).toHaveBeenCalledWith('papybot',expect.objectContaining({body:{messages,context:'/sets',document:'Document text'}}));
});
it('preserves server quota error for the UI',async()=>{
 invoke.mockResolvedValue({error:{context:{status:429,json:async()=>({error:'secret server internals'})}}});
 await expect(askPapybot([{role:'user',content:'Hi'}],'/',undefined,new AbortController().signal)).rejects.toThrow('hết lượt');
});
