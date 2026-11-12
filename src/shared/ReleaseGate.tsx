import { useEffect, useState, type PropsWithChildren } from 'react';
import { Linking, Text } from 'react-native';
import { dependencies } from '@/composition/dependencies';
import type { ReleasePolicy } from '@/features/release/domain/policy';
import { Button, Card, Screen } from './ui';

export function ReleaseGate({children}:PropsWithChildren) {
  const [policy,setPolicy]=useState<ReleasePolicy|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let active=true;
    void dependencies.release.requiredUpgrade().then(value=>{if(active)setPolicy(value);});
    void dependencies.release.initializeReview().catch(()=>undefined);
    return ()=>{active=false;};
  },[]);
  if(!policy)return children;
  return <Screen><Card><Text accessibilityRole="header">Cần cập nhật Papyrus / Update required</Text>
    <Text>Phiên bản này không còn tương thích với dịch vụ. Dữ liệu trên máy vẫn được giữ lại.</Text>
    {error && <Text accessibilityRole="alert">Không mở được cửa hàng. Hãy mở App Store hoặc Google Play để cập nhật Papyrus.</Text>}
    <Button onPress={()=>{void Linking.openURL(policy.storeUrl).catch(()=>setError(true));}}>Mở cửa hàng / Open store</Button>
  </Card></Screen>;
}
