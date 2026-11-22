import Constants from 'expo-constants';
import { useRef, useState } from 'react';
import { Modal, Text, View, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Button, usePalette } from '@/shared/ui';
import { parseRoomInvite, roomInvite } from '../domain/invite';
export function InviteQr({code}:{code:string}) {
 return <View style={{alignSelf:'center',padding:12,backgroundColor:'#fff',borderRadius:12,margin:12}} accessibilityLabel={`Mã QR vào phòng ${code}`}><QRCode value={roomInvite(code,Constants.expoConfig?.scheme)} size={160} /></View>;
}
export function ScanRoomQr({onCode}:{onCode:(code:string)=>void}) {
 const [open,setOpen]=useState(false),[permission,requestPermission]=useCameraPermissions();
 const [error,setError]=useState('');const locked=useRef(false);const palette=usePalette();
 return <><Button icon="qr-code-outline" variant="secondary" onPress={()=>{locked.current=false;setError('');setOpen(true);}}>Quét mã QR</Button>
 <Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="none"><View style={{flex:1,padding:24,paddingTop:60,backgroundColor:palette.paper,gap:16}}>
 <Text style={{color:palette.ink,fontSize:20}}>Quét mã phòng Papyrus</Text>
 {permission?.granted && open ? <CameraView style={{flex:1}} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>{if(locked.current)return;const code=parseRoomInvite(data);if(!code){setError('QR này không phải lời mời phòng Papyrus.');return;}locked.current=true;setOpen(false);onCode(code);}}/> : <Button onPress={()=>{void (permission?.canAskAgain===false?Linking.openSettings():requestPermission()).catch(()=>setError('Không mở được quyền camera.'));}}>Cho phép camera / Mở cài đặt</Button>}
 {!!error && <Text accessibilityLiveRegion="polite" style={{color:palette.danger}}>{error}</Text>}
 <Button variant="secondary" onPress={()=>setOpen(false)}>Đóng</Button>
 </View></Modal></>;
}
