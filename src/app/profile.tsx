import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { useAuthStore } from '@/core/state/useAuthStore';
import { dependencies } from '@/composition/dependencies';

export default function ProfileScreen(){
  const user=useAuthStore(s=>s.user),palette=usePalette(),router=useRouter();
  const [name,setName]=useState(user?.displayName??'');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function save(){
    if(busy)return;setBusy(true);setMessage('');
    try {const updated=await dependencies.updateDisplayName(name);useAuthStore.getState().setUser(updated);setMessage('Đã lưu hồ sơ.');}
    catch(error){setMessage(error instanceof Error?error.message:'Không lưu được hồ sơ.');}
    finally{setBusy(false);}
  }
  return <Screen><TopBar title="Hồ sơ cá nhân"/>
    <Card><Text style={{fontSize:24,fontWeight:'700',color:palette.ink}}>{user?.displayName??'Người học khách'}</Text>
      <Text selectable style={{color:palette.inkMuted,marginTop:8}}>{user?.email??'Đăng nhập để quản lý hồ sơ và đồng bộ bộ câu hỏi.'}</Text>
    </Card>
    {user?<Card style={{marginTop:24}}><Text style={{color:palette.ink,fontWeight:'600'}}>Tên hiển thị</Text>
      <TextInput accessibilityLabel="Tên hiển thị" value={name} onChangeText={setName} maxLength={60} editable={!busy} autoComplete="name" style={{minHeight:52,padding:12,borderWidth:1,borderColor:palette.inkMuted,borderRadius:12,color:palette.ink,marginVertical:12}}/>
      <Text style={{color:palette.inkMuted}}>Tên hiển thị được lưu trong tài khoản. Email và thông tin đăng nhập không thay đổi.</Text>
      <View style={{marginTop:16}}><Button disabled={busy||name.trim().length<2||name.trim()===user.displayName} onPress={()=>void save()}>{busy?'Đang lưu…':'Lưu hồ sơ'}</Button></View>
    </Card>:<Button onPress={()=>router.push('/auth')}>Đăng nhập</Button>}
    {message?<Text accessibilityRole="alert" style={{color:palette.ink,marginTop:16}}>{message}</Text>:null}
  </Screen>;
}
