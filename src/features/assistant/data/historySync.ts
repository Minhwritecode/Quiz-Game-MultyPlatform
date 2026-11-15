import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/core/network/supabase';
import { loadHistory, saveHistory, type Conversation } from './history';
type Baseline = Record<string, { revision: number; content: string }>;
export async function markChatDeleted(owner:string,id:string) {
 const storageKey=`papybot:deleted:v1:${owner}`;
 const ids:string[]=JSON.parse(await AsyncStorage.getItem(storageKey)||'[]');
 await AsyncStorage.setItem(storageKey,JSON.stringify([...new Set([...ids,id])]));
}
const key=(owner:string)=>`papybot:sync:v1:${owner}`;
export async function clearChatSync(owner:string) {await AsyncStorage.multiRemove([key(owner),`papybot:deleted:v1:${owner}`]);}
export async function syncHistory(owner:string, current:Conversation[]):Promise<Conversation[]> {
  if(!supabase) throw new Error('Chưa cấu hình đồng bộ.');
  const session=await supabase.auth.getUser();
  if(session.error || session.data.user?.id!==owner) throw new Error('Đăng nhập lại để đồng bộ.');
  const baseline:Baseline=JSON.parse(await AsyncStorage.getItem(key(owner)) || '{}');
  // Persist acknowledgements after each mutation so retries cannot repeat a successful write.
  for(const conversation of current) {
    const content=JSON.stringify(conversation.messages), previous=baseline[conversation.id];
    if(previous?.content===content) continue;
    const result=await supabase.rpc('save_papybot_conversation',{p_id:conversation.id,p_messages:conversation.messages,p_revision:previous?.revision ?? 0,p_deleted:false});
    if(result.error) throw new Error('Có thay đổi trên thiết bị khác hoặc lỗi mạng. Hội thoại local vẫn được giữ; hãy lưu nội dung quan trọng trước khi tải lại.');
    baseline[conversation.id]={revision:result.data,content};await AsyncStorage.setItem(key(owner),JSON.stringify(baseline));
  }
  const deleted:string[]=JSON.parse(await AsyncStorage.getItem(`papybot:deleted:v1:${owner}`)||'[]');
  for(const id of deleted) {
    if(!baseline[id]) continue;
    const result=await supabase.rpc('save_papybot_conversation',{p_id:id,p_messages:[],p_revision:baseline[id]!.revision,p_deleted:true});
    if(result.error) throw new Error('Không đồng bộ được thao tác xóa. Hãy thử lại sau.');
    delete baseline[id];await AsyncStorage.setItem(key(owner),JSON.stringify(baseline));
  }
  await AsyncStorage.removeItem(`papybot:deleted:v1:${owner}`);
  const result=await supabase.from('papybot_conversations').select('id,messages,revision,updated_at').eq('owner_id',owner).eq('deleted',false).order('updated_at',{ascending:false}).limit(20);
  if(result.error) throw new Error('Không tải được lịch sử cloud.');
  const merged:Conversation[]=(result.data ?? []).map(row=>({id:row.id,messages:row.messages,updatedAt:Date.parse(row.updated_at)}));
  const next:Baseline={};
  for(const row of result.data ?? []) next[row.id]={revision:row.revision,content:JSON.stringify(row.messages)};
  await saveHistory(owner,merged);await AsyncStorage.setItem(key(owner),JSON.stringify(next));
  return loadHistory(owner);
}
