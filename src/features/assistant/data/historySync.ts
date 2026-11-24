import { AppError } from '@/core/domain/failure';
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
  if(!supabase) throw new AppError('unavailable', 'Chưa cấu hình đồng bộ.');
  const session=await supabase.auth.getUser();
  if(session.error || session.data.user?.id!==owner) throw new AppError('unavailable', 'Đăng nhập lại để đồng bộ.');
  const baseline:Baseline=JSON.parse(await AsyncStorage.getItem(key(owner)) || '{}');
  // Persist acknowledgements after each mutation so retries cannot repeat a successful write.
  for(const conversation of current) {
    const content=JSON.stringify(conversation.messages), previous=baseline[conversation.id];
    if(previous?.content===content) continue;
    const result=await supabase.rpc('save_papybot_conversation',{p_id:conversation.id,p_messages:conversation.messages,p_revision:previous?.revision ?? 0,p_deleted:false});
    if(result.error) throw new AppError('unavailable', 'Có thay đổi trên thiết bị khác hoặc lỗi mạng. Hội thoại local vẫn được giữ; hãy lưu nội dung quan trọng trước khi tải lại.');
    baseline[conversation.id]={revision:result.data,content};await AsyncStorage.setItem(key(owner),JSON.stringify(baseline));
  }
  const deleted:string[]=JSON.parse(await AsyncStorage.getItem(`papybot:deleted:v1:${owner}`)||'[]');
  for(const id of deleted) {
    if(!baseline[id]) continue;
    const result=await supabase.rpc('save_papybot_conversation',{p_id:id,p_messages:[],p_revision:baseline[id]!.revision,p_deleted:true});
    if(result.error) throw new AppError('unavailable', 'Không đồng bộ được thao tác xóa. Hãy thử lại sau.');
    delete baseline[id];await AsyncStorage.setItem(key(owner),JSON.stringify(baseline));
  }
  await AsyncStorage.removeItem(`papybot:deleted:v1:${owner}`);
  const result=await supabase.from('papybot_conversations').select('id,messages,revision,updated_at').eq('owner_id',owner).eq('deleted',false).order('updated_at',{ascending:false}).limit(20);
  if(result.error) throw new AppError('unavailable', 'Không tải được lịch sử cloud.');
  const merged:Conversation[]=(result.data ?? []).map(row=>({id:row.id,messages:row.messages,updatedAt:Date.parse(row.updated_at)}));
  const next:Baseline={};
  for(const row of result.data ?? []) next[row.id]={revision:row.revision,content:JSON.stringify(row.messages)};
  await saveHistory(owner,merged);await AsyncStorage.setItem(key(owner),JSON.stringify(next));
  return loadHistory(owner);
}

export type ChatConflictResolution = 'keep_cloud' | 'keep_local' | 'keep_both';

export async function resolveHistoryConflict(
  owner: string,
  localConversations: Conversation[],
  resolution: ChatConflictResolution
): Promise<Conversation[]> {
  if (!supabase) return localConversations;
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user || sessionData.user.id !== owner) {
    throw new AppError('unavailable', 'Đăng nhập lại để xử lý xung đột lịch sử.');
  }

  const cloudRes = await supabase
    .from('papybot_conversations')
    .select('id,messages,revision,updated_at')
    .eq('owner_id', owner)
    .eq('deleted', false)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (cloudRes.error) {
    throw new AppError('unavailable', 'Không tải được bản Cloud lúc này.');
  }

  const cloudRows = cloudRes.data ?? [];
  const cloudConvs: Conversation[] = cloudRows.map((row) => ({
    id: row.id,
    messages: row.messages,
    updatedAt: Date.parse(row.updated_at),
  }));

  if (resolution === 'keep_cloud') {
    const nextBase: Baseline = {};
    for (const row of cloudRows) {
      nextBase[row.id] = { revision: row.revision, content: JSON.stringify(row.messages) };
    }
    await saveHistory(owner, cloudConvs);
    await AsyncStorage.setItem(key(owner), JSON.stringify(nextBase));
    return loadHistory(owner);
  }

  if (resolution === 'keep_local') {
    const nextBase: Baseline = {};
    for (const row of cloudRows) {
      nextBase[row.id] = { revision: row.revision, content: '' };
    }
    await AsyncStorage.setItem(key(owner), JSON.stringify(nextBase));
    return syncHistory(owner, localConversations);
  }

  // keep_both: clone conflicting local conversations under fresh IDs so zero messages are lost
  const cloudIds = new Set(cloudConvs.map((c) => c.id));
  const combined: Conversation[] = [...cloudConvs];
  for (const loc of localConversations) {
    if (!cloudIds.has(loc.id)) {
      combined.push(loc);
    } else {
      const cloudMatch = cloudConvs.find((c) => c.id === loc.id);
      if (JSON.stringify(cloudMatch?.messages) !== JSON.stringify(loc.messages)) {
        combined.push({
          id: `${loc.id}-local-${Date.now().toString(36)}`,
          messages: loc.messages,
          updatedAt: Date.now(),
        });
      }
    }
  }
  const trimmed = combined.slice(0, 20);
  await saveHistory(owner, trimmed);
  const nextBase: Baseline = {};
  for (const row of cloudRows) {
    nextBase[row.id] = { revision: row.revision, content: JSON.stringify(row.messages) };
  }
  await AsyncStorage.setItem(key(owner), JSON.stringify(nextBase));
  return syncHistory(owner, trimmed);
}
