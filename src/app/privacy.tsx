import { useState } from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

export default function PrivacyScreen() {
  const palette=usePalette(), router=useRouter();
  const user=useAuthStore(s=>s.user);
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [finished,setFinished]=useState(false);
  const open=async(url:string|undefined)=>{
    if(!url){setMessage('Trang hỗ trợ chưa được cấu hình cho bản thử nghiệm này.');return;}
    try {if(new URL(url).protocol !== 'https:')throw new Error();await Linking.openURL(url);}
    catch {setMessage('Không mở được trang. Vui lòng thử lại sau.');}
  };
  const remove=async()=>{
    if(busy || confirmation !== 'DELETE')return;
    setBusy(true);setMessage('');
    try {
      const result=await dependencies.deleteCurrentAccount();
      useAuthStore.getState().clear();
      usePapyrusStore.setState({questionSets:[],sourceDocument:null,hydrated:true});
      setFinished(true);
      setMessage(result.cleanupRequired ? 'Tài khoản trên máy chủ đã được xóa. Chưa dọn hết dữ liệu trên thiết bị; hãy xóa dữ liệu ứng dụng trong cài đặt hệ điều hành trước khi dùng lại.' : 'Đã xóa tài khoản, dữ liệu cloud và dữ liệu học trên thiết bị này.');
    } catch(error){setMessage(error instanceof Error ? error.message : 'Không thể xóa tài khoản.');}
    finally {setBusy(false);}
  };
  return <Screen><TopBar title="Quyền riêng tư & dữ liệu" />
    <Card><Text style={{color:palette.ink}}>Ảnh tài liệu được OCR trên thiết bị. Khi chọn tạo câu hỏi AI, văn bản đã duyệt được gửi tới dịch vụ AI. Bộ câu hỏi chỉ lên cloud khi bạn chủ động đồng bộ. Báo cáo lỗi đã lọc không chứa nội dung ghi chú, mật khẩu hoặc phiên đăng nhập.</Text>
      <Button variant="secondary" onPress={()=>void open(process.env.EXPO_PUBLIC_PRIVACY_URL)}>Chính sách quyền riêng tư</Button>
      <Button variant="secondary" onPress={()=>void open(process.env.EXPO_PUBLIC_SUPPORT_URL)}>Hỗ trợ / Gửi phản hồi</Button>
    </Card>
    {message ? <Text accessibilityRole="alert" style={{color:palette.ink,marginVertical:16}}>{message}</Text> : null}
    {user && !finished ? <Card><Text style={{color:palette.ink}}>Xóa vĩnh viễn tài khoản, bộ câu hỏi cloud, lịch sử cloud và phòng liên quan. Tất cả dữ liệu học cục bộ trên thiết bị này, kể cả chưa đồng bộ, cũng sẽ bị xóa. Dữ liệu lưu trên thiết bị khác phải được xóa trên từng thiết bị. Không thể hoàn tác.</Text>
      <View style={{marginVertical:16}}><TextInput accessibilityLabel="Type DELETE to confirm" placeholder="Nhập DELETE để xác nhận" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!busy} style={{minHeight:48,borderWidth:1,borderColor:palette.inkMuted,borderRadius:12,padding:12,color:palette.ink}} /></View>
      <Button variant="danger" disabled={busy || confirmation !== 'DELETE'} onPress={()=>void remove()}>{busy ? 'Đang xóa…' : 'Xóa tài khoản và dữ liệu'}</Button>
    </Card> : <Button onPress={()=>router.replace('/auth')}>Về đăng nhập</Button>}
  </Screen>;
}
