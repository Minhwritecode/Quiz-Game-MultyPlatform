import { Platform, Text, View } from 'react-native';
import { Screen, TopBar, usePalette } from '@/shared/ui';
import ChatBrowser from '@/features/pdf-chat/presentation/ChatBrowser';

export default function PdfChatScreen() {
  const palette = usePalette();
  const configured = process.env.EXPO_PUBLIC_PDF_CHAT_URL;
  const uri = configured || (__DEV__ ? `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:3005` : '');
  let valid = false;
  try { const url = new URL(uri); valid = url.protocol === 'https:' || (__DEV__ && url.protocol === 'http:'); } catch {}
  return <Screen scroll={false} contentStyle={{ flex: 1 }}>
    <TopBar title="Chat với PDF" />
    {valid ? <View style={{ flex: 1, overflow: 'hidden', borderRadius: 16 }}><ChatBrowser uri={uri} /></View>
      : <Text style={{ color: palette.ink }}>Chatbot chưa được cấu hình cho bản ứng dụng này.</Text>}
  </Screen>;
}
