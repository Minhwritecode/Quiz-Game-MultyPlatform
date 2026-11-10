import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AppState, Share, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, PageHeader, Screen, usePalette } from '@/shared/ui';
import { dependencies } from './composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import type { Battle } from '@/features/room-battle/domain/battle';

export default function BattleScreen() {
  const palette=usePalette();
  const user=useAuthStore(s=>s.user);
  const params=useLocalSearchParams<{code?:string}>();
  const [code,setCode]=useState(params.code??'');
  const [roomId,setRoomId]=useState<string|null>(null);
  const [battle,setBattle]=useState<Battle|null>(null);
  const [sets,setSets]=useState<{id:string;title:string}[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const roomKey=`papyrus.battle.${user?.id??'guest'}`;

  useEffect(()=>{
    let active=true;
    setRoomId(null); setBattle(null); setSets([]);
    if(user) {
      void AsyncStorage.getItem(roomKey).then(id=>{if(active)setRoomId(id);});
      void dependencies.battle.sets().then(value=>{if(active)setSets(value);}).catch(e=>{if(active)setError(String(e.message));});
    }
    return ()=>{active=false;};
  },[user?.id,roomKey]);

  useEffect(()=>{
    if(!roomId) return;
    let active=true, fetching=false;
    const refresh=async()=>{
      if(fetching || AppState.currentState==='background')return;
      fetching=true;
      try {const next=await dependencies.battle.snapshot(roomId); if(active){setBattle(next);setError('');}}
      catch(e){if(active)setError(e instanceof Error?e.message:'Connection interrupted. Reconnecting…');}
      finally {fetching=false;}
    };
    const heartbeat=()=>{void dependencies.battle.heartbeat(roomId).then(refresh).catch(()=>{if(active)setError('Connection interrupted. Reconnecting…');});};
    heartbeat();
    const unsubscribe=dependencies.battle.subscribe(roomId,()=>void refresh());
    const poll=setInterval(()=>void refresh(),1500);
    const lease=setInterval(heartbeat,10000);
    const appState=AppState.addEventListener('change',state=>{if(state==='active')heartbeat();});
    return ()=>{active=false;clearInterval(poll);clearInterval(lease);unsubscribe();appState.remove();};
  },[roomId]);

  const run=async(action:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('');
    try {await action();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
  };
  const enter=async(id:string)=>{await AsyncStorage.setItem(roomKey,id);setRoomId(id);};
  const leave=async()=>{if(roomId)await dependencies.battle.leave(roomId);await AsyncStorage.removeItem(roomKey);setRoomId(null);setBattle(null);};
  const me=battle?.players.find(p=>p.userId===user?.id);
  const question=battle?.question;
  return <Screen bottomNav><PageHeader title="Study circle" subtitle="Invite classmates for a 2–4 player quiz." />
    {!!error&&<Text accessibilityRole="alert" style={{color:palette.danger,marginBottom:16}}>{error}</Text>}
    {!user&&<Card><Text style={{color:palette.ink}}>Sign in to create or join an online room. Offline study remains available in your library.</Text></Card>}
    {user&&!roomId&&<View style={{gap:16}}>
      <Card><Text style={{color:palette.ink}}>Create from a synced question set</Text>
        {sets.length===0&&<Text style={{color:palette.inkMuted}}>No cloud question sets yet. Sync a set before hosting.</Text>}
        {sets.map(set=><Button key={set.id} disabled={busy} onPress={()=>void run(async()=>{const room=await dependencies.rooms.create({setId:set.id,questionCount:10,secondsPerQuestion:15,mode:'speed'});await enter(room.id);})}>{set.title}</Button>)}
      </Card>
      <Card><TextInput accessibilityLabel="Room code" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={6} placeholder="ABC123" style={{color:palette.ink,minHeight:48}} />
        <Button disabled={busy||!/^[a-z0-9]{6}$/i.test(code.trim())} onPress={()=>void run(async()=>{await enter((await dependencies.rooms.join(code.trim().toUpperCase())).id);})}>Join room</Button></Card>
    </View>}
    {roomId&&!battle&&<Text style={{color:palette.ink}}>Restoring your room…</Text>}
    {battle&&<View style={{gap:16}}>
      <Card><Text style={{color:palette.ink,fontSize:24}}>{battle.code}</Text><Text style={{color:palette.inkMuted}}>{battle.phase.replaceAll('_',' ')}</Text>
        <Button variant="secondary" onPress={()=>void Share.share({message:`Join Papyrus: papyrus://battle?code=${battle.code}\nRoom code: ${battle.code}`})}>Share invitation</Button>
        {battle.phase==='waiting'&&<Button disabled={busy} onPress={()=>void run(()=>dependencies.battle.heartbeat(roomId!,!me?.ready))}>{me?.ready?'Not ready':'Ready'}</Button>}
        {battle.phase==='waiting'&&battle.hostId===user?.id&&<Button disabled={busy||battle.players.length<2||battle.players.some(p=>!p.ready||!p.connected)} onPress={()=>void run(()=>dependencies.battle.start(roomId!))}>Start quiz</Button>}
      </Card>
      {question&&battle.phase!=='finished'&&<Card>
        <Text style={{color:palette.ink,fontSize:20}}>{question.position+1}. {question.content}</Text>
        {question.options.map((option,index)=><Button key={index} variant={question.correctIndex===index?'primary':'secondary'} disabled={busy||battle.answered||battle.phase!=='question_open'} onPress={()=>void run(async()=>{await dependencies.battle.answer(roomId!,question.position,index);setBattle(await dependencies.battle.snapshot(roomId!));})}>{option}</Button>)}
        {battle.answered&&<Text style={{color:palette.inkMuted}}>Answer received.</Text>}
        {question.explanation&&<Text style={{color:palette.ink}}>{question.explanation}</Text>}
      </Card>}
      <Card><Text style={{color:palette.ink,fontSize:20}}>{battle.phase==='finished'?'Final ranking':'Live scores'}</Text>
        {battle.players.map((p,i)=><Text key={p.userId} style={{color:palette.ink,marginVertical:8}}>{i+1}. {p.name} · {p.score} points · {p.connected?(p.ready?'ready':'online'):'reconnecting'}{p.userId===battle.hostId?' · host':''}</Text>)}
      </Card>
    </View>}
    {roomId&&<Button disabled={busy} variant="secondary" onPress={()=>void run(leave)}>Leave room</Button>}
  </Screen>;
}
