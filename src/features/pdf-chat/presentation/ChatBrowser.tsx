import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button, usePalette } from '@/shared/ui';

export default function ChatBrowser({ uri }: { uri: string }) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <View style={{ padding: 24, gap: 16 }}>
    <Text style={{ color: palette.ink }}>Không kết nối được chatbot. Kiểm tra máy chủ đang chạy và địa chỉ mạng của máy tính.</Text>
    <Button onPress={() => { setFailed(false); setAttempt(value => value + 1); }}>Thử lại</Button>
  </View>;
  const origin = new URL(uri).origin;
  return <WebView key={attempt} source={{ uri }} style={{ flex: 1 }}
    originWhitelist={[origin]} startInLoadingState
    renderLoading={() => <ActivityIndicator accessibilityLabel="Đang mở chatbot" />}
    onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith(`${origin}/`)}
    allowFileAccess={false} javaScriptCanOpenWindowsAutomatically={false} />;
}
