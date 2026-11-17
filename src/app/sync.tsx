import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { errorMessage } from '@/core/domain/failure';
import type { QuestionSet } from '@/core/domain/models';
import { emptyCloudState, type CloudState } from '@/features/sync/domain/cloudSets';
import { emptyLearningState, type LearningState } from '@/features/sync/domain/learningSync';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';

export default function SyncScreen() {
  const user = useAuthStore(state => state.user), router = useRouter();
  return user ? <AccountLibrary key={user.id} owner={user.id} /> : <Screen><TopBar title="Đồng bộ" />
    <Card><Text>Đăng nhập để đồng bộ dữ liệu học tập. Dữ liệu khách vẫn nằm riêng trên thiết bị.</Text>
      <Button onPress={() => router.push('/auth')}>Đăng nhập</Button></Card></Screen>;
}
function AccountLibrary({owner}: {owner: string}) {
  const router = useRouter(), palette = usePalette();
  const [sets, setSets] = useState<CloudState>(emptyCloudState);
  const [learning, setLearning] = useState<LearningState>(emptyLearningState);
  const [guest, setGuest] = useState<QuestionSet[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    const [a,b,c] = await Promise.all([dependencies.cloudSets.list(owner), dependencies.learning.cloud.list(owner), dependencies.learning.guestSets.list()]);
    if(useAuthStore.getState().user?.id !== owner)return;
    setSets(a);setLearning(b);setGuest(c);
  },[owner]);
  useEffect(() => {
    let active=true;
    const read=()=>{void refresh().catch(error=>{if(active)setMessage(errorMessage(error));});};
    read(); const timer=setInterval(read,5000);return()=>{active=false;clearInterval(timer);};
  },[refresh]);
  const run = async (action:()=>Promise<unknown>) => {
    if(busy)return;setBusy(true);setMessage('');
    try {await action();await dependencies.learning.refresh();await refresh();}
    catch(error){setMessage(errorMessage(error,'Chưa đồng bộ được. Dữ liệu vẫn được giữ trên máy.'));}
    finally{setBusy(false);}
  };
  const text={color:palette.ink};
  return <Screen><TopBar title="Đồng bộ học tập" onBack={()=>router.back()}/><View style={{gap:16}}>
    <Card><Text style={text}>Tự đồng bộ khi đăng nhập, mở lại app hoặc có mạng. Bộ đề tải xuống xuất hiện trực tiếp trong thư viện với cùng ID.</Text>
      <Text style={text}>{sets.pending.length+learning.pending.length} thay đổi đang chờ</Text>
      <Button disabled={busy} onPress={()=>void run(()=>dependencies.learning.syncNow())}>{busy?'Đang xử lý…':'Đồng bộ ngay'}</Button>
      <Text style={text}>Xung đột dùng revision trên server; giờ thiết bị chỉ dùng để hiển thị. Chọn giữ bản trên máy hoặc server khi hai thiết bị cùng sửa.</Text>
    </Card>
    {!!message&&<Text accessibilityLiveRegion="polite" style={text}>{message}</Text>}
    {sets.documents.filter(d=>!d.deleted||sets.pending.some(p=>p.document.id===d.id)).map(d=>{
      const p=sets.pending.find(p=>p.document.id===d.id);
      return <Card key={d.id}><Text style={text}>{d.title}</Text><Badge tone={p?.conflict?'danger':p?'neutral':'success'}>{p?.conflict?'Xung đột':p?.failures?'Chờ thử lại':p?d.deleted?'Chờ xóa':'Chờ tải lên':'Đã đồng bộ'}</Badge>
        {!d.deleted&&<Button variant="secondary" onPress={()=>router.push({pathname:'/study/[setId]',params:{setId:d.id}})}>Ôn tập</Button>}
        {p?.conflict&&<><Button disabled={busy} onPress={()=>void run(()=>dependencies.cloudSets.resolve(owner,d.id,'server'))}>Giữ bản server</Button><Button disabled={busy} onPress={()=>void run(()=>dependencies.cloudSets.resolve(owner,d.id,'local'))}>Giữ bản trên máy</Button></>}
      </Card>;
    })}
    <Card><Text style={text}>{learning.documents.filter(d=>d.entity==='attempts'&&!d.deleted).length} lượt học · {learning.documents.filter(d=>d.entity==='source_documents'&&!d.deleted).length} tài liệu</Text><Button onPress={()=>router.push('/study/history')}>Lịch sử học</Button></Card>
    {learning.documents.filter(d=>!d.deleted||learning.pending.some(p=>p.document.id===d.id)).map(d=>{
      const pending=learning.pending.find(p=>p.document.entity===d.entity&&p.document.id===d.id);
      if(d.entity==='attempts'&&!pending)return null;
      return <Card key={`${d.entity}:${d.id}`}><Text style={text}>{d.entity==='source_documents'?d.payload.title:`Lượt học ${d.payload.finishedAt}`}</Text>
        <Badge tone={pending?.conflict?'danger':pending?'neutral':'success'}>{pending?.conflict?'Xung đột':pending?.failures?'Chờ thử lại':pending?'Chờ đồng bộ':'Đã đồng bộ'}</Badge>
        {d.entity==='source_documents'&&!d.deleted&&<Button onPress={()=>{usePapyrusStore.getState().saveSourceDocument(d.payload);router.push('/create/generate');}}>Dùng tạo câu hỏi</Button>}
        {pending?.conflict&&<><Button disabled={busy} onPress={()=>void run(()=>dependencies.learning.cloud.resolve(owner,d.entity,d.id,'server'))}>Giữ bản server</Button><Button disabled={busy} onPress={()=>void run(()=>dependencies.learning.cloud.resolve(owner,d.entity,d.id,'local'))}>Giữ bản trên máy</Button></>}
      </Card>;
    })}
    {!!guest.length&&<Text style={text}>Bộ đề khách cũ trên thiết bị (chỉ nhập khi bạn chọn):</Text>}
    {guest.map(set=><Card key={set.id}><Text style={text}>{set.title}</Text><Button disabled={busy||!!sets.imports[set.id]} onPress={()=>void run(()=>dependencies.cloudSets.import(owner,set))}>{sets.imports[set.id]?'Đã nhập':'Nhập vào tài khoản này'}</Button></Card>)}
  </View></Screen>;
}
