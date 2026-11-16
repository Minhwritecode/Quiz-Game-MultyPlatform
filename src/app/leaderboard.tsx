import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Text, View } from 'react-native';
import { dependencies } from '@/composition/dependencies';
import type { Ranking } from '@/features/leaderboard/domain/repository';
import { useAuthStore } from '@/core/state/useAuthStore';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';

export default function LeaderboardScreen(){
 const palette=usePalette(),user=useAuthStore(s=>s.user);
 const [rows,setRows]=useState<Ranking[]>([]),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef(0);
 useFocusEffect(useCallback(()=>{
  let active=true;let running=false;setRows([]);setError('');
  const load=async()=>{
   if(running || !active || AppState.currentState==='background')return;
   if(!user){setError('Đăng nhập để xem bảng xếp hạng.');return;}
   running=true;const id=++request.current;setBusy(true);
   try{const result=await dependencies.leaderboard.list(offset);if(!active||id!==request.current)return;setRows(result);setError('');}
   catch{if(active)setError('Không tải được bảng xếp hạng. Hãy thử lại.');}
   finally{running=false;if(active)setBusy(false);}
  };
  void load();const timer=setInterval(()=>void load(),30000);const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});
  return()=>{active=false;request.current++;clearInterval(timer);listener.remove();};
 },[user?.id,offset]));
 return <Screen bottomNav><TopBar title="Bảng xếp hạng"/><Text style={{color:palette.inkMuted}}>Tổng điểm các trận đã kết thúc · làm mới mỗi 30 giây khi đang xem.</Text>
 {!!error && <Text accessibilityLiveRegion="polite" style={{color:palette.danger}}>{error}</Text>}
 {busy && <Text style={{color:palette.inkMuted}}>Đang cập nhật…</Text>}
 {!busy&&!error&&!rows.length&&<Text style={{color:palette.ink}}>Chưa có kết quả trận đấu.</Text>}
 {rows.map(row=><Card key={row.rank}><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Text style={{color:palette.indigo,fontWeight:'800'}}>#{row.rank}</Text><View style={{flex:1}}><Text style={{color:palette.ink,fontWeight:'700'}}>{row.displayName}{row.isMe?' · Bạn':''}</Text><Text style={{color:palette.inkMuted}}>{row.matches} trận</Text></View><Text style={{color:palette.indigo}}>{row.points} điểm</Text></View></Card>)}
 <View style={{flexDirection:'row',gap:12}}><Button disabled={offset===0||busy} onPress={()=>setOffset(v=>Math.max(0,v-25))}>Trước</Button><Button disabled={rows.length<25||busy||offset>=10000} onPress={()=>setOffset(v=>v+25)}>Tiếp</Button></View>
 </Screen>;
}
