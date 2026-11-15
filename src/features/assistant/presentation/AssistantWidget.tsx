import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { usePalette } from '@/shared/ui';

const guides = [
  { match: '/create', title: 'Tạo bộ đề', text: 'Từ trang chủ, chọn tạo thủ công hoặc tạo bằng AI. Nhập nội dung, kiểm tra câu hỏi và đáp án trước khi lưu vào thư viện.' },
  { match: '/study', title: 'Ôn tập', text: 'Mở một bộ đề trong thư viện để bắt đầu học. Mục lịch sử cho phép xem kết quả và các phiên học đang dở.' },
  { match: '/sets', title: 'Thư viện', text: 'Tìm bộ đề, mở để ôn tập hoặc dùng thao tác sửa và xóa. Kiểm tra lại đáp án sau khi chỉnh sửa câu hỏi.' },
  { match: '/battle', title: 'Phòng đấu', text: 'Chủ phòng chọn bộ đề và tạo phòng. Người chơi nhập mã phòng, chọn sẵn sàng rồi chờ chủ phòng bắt đầu. Cần kết nối mạng để chơi cùng nhau.' },
  { match: '/sync', title: 'Đồng bộ', text: 'Đăng nhập trước khi đồng bộ. Trong màn đồng bộ, kiểm tra trạng thái tải lên/tải xuống; bộ đề trên cloud có thể được lưu thành bản sao trong thư viện.' },
  { match: '/settings', title: 'Cài đặt', text: 'Mở Cài đặt để điều chỉnh giao diện, phản hồi và các tùy chọn của app. Quyền thông báo và camera còn phụ thuộc cài đặt hệ thống điện thoại.' },
];

export function AssistantWidget() {
  const palette = usePalette();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState<(typeof guides)[number] | null>(null);
  const [picking, setPicking] = useState(false);
  const context = guides.find(guide => path.startsWith(guide.match));
  const close = () => setOpen(false);
  const pick = async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: false });
      if (!result.canceled) {
        const file = result.assets[0];
        if (!file || !file.size || file.size > 10 * 1024 * 1024) { setNotice('Chọn tài liệu có kích thước xác định, tối đa 10 MB.'); return; }
        setAttachment(file); setNotice('Tệp chỉ được chọn trên thiết bị; chưa được tải lên hoặc phân tích.');
      }
    } catch { setNotice('Không chọn được tài liệu. Hãy thử lại.'); }
    finally { setPicking(false); }
  };
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={23} color={palette.indigo} /></Pressable>;
  return <>
    {!open && <Pressable accessibilityRole="button" accessibilityLabel="Mở Papybot" onPress={() => setOpen(true)} style={{ position: 'absolute', right: 20, bottom: insets.bottom + 88, width: 56, height: 56, borderRadius: 28, backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center', elevation: 6 }}><Ionicons name="chatbubbles" size={27} color="#fff" /></Pressable>}
    <Modal visible={open} transparent animationType="none" onRequestClose={close} onDismiss={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', alignItems: desktop ? 'flex-end' : 'stretch' }}>
        <Pressable accessibilityLabel="Đóng Papybot" accessibilityRole="button" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000033' }} />
        <View accessibilityViewIsModal style={{ width: desktop ? 420 : '100%', height: Math.min(height - insets.top - 20, 680), marginRight: desktop ? 24 : 0, marginBottom: desktop ? 24 : 0, paddingBottom: desktop ? 0 : insets.bottom, backgroundColor: palette.paper, borderRadius: 24, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, borderBottomWidth: 1, borderColor: palette.paperMuted }}>
            <View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: palette.ink, fontSize: 19, fontWeight: '700' }}>Papybot</Text><Text style={{ color: palette.inkMuted, fontSize: 12 }}>Học tập · Hướng dẫn · Tài liệu</Text></View>
            {icon('close', 'Đóng Papybot', close)}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={{ color: palette.inkMuted }}>Bạn đang ở: {context?.title ?? (path === '/' ? 'Trang chủ' : 'Papyrus')}. Chỉ tên màn hình được dùng làm ngữ cảnh, chưa gửi dữ liệu lên AI.</Text>
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.indigoTint }}><Text style={{ color: palette.indigoDeep }}>AI chưa kết nối. Bạn có thể xem hướng dẫn có sẵn hoặc soạn câu hỏi học tập để dùng khi dịch vụ được cấu hình.</Text></View>
            {[...(context ? [context] : []), ...guides.filter(item => item !== context)].map(item => <Pressable key={item.match} accessibilityRole="button" onPress={() => setHelp(item)} style={{ padding: 14, borderWidth: 1, borderColor: palette.paperMuted, borderRadius: 14 }}><Text style={{ color: palette.ink }}>{item.title}</Text></Pressable>)}
            {help && <View style={{ padding: 16, backgroundColor: palette.paperRaised, borderRadius: 16 }}><Text style={{ color: palette.ink, fontWeight: '700' }}>Hướng dẫn có sẵn · {help.title}</Text><Text selectable style={{ color: palette.ink, lineHeight: 23, marginTop: 8 }}>{help.text}</Text></View>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: palette.inkMuted }}>{notice}</Text>}
          </ScrollView>
          {attachment && <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}><Text numberOfLines={1} style={{ flex: 1, color: palette.ink }}>{attachment.name}</Text>{icon('close-circle-outline', 'Bỏ tài liệu', () => setAttachment(null))}</View>}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderColor: palette.paperMuted, padding: 8 }}>
            {icon('attach', 'Đính kèm PDF, TXT hoặc DOCX', () => void pick(), picking)}
            <TextInput accessibilityLabel="Câu hỏi cho Papybot" placeholder="Hỏi về app hoặc bài học…" placeholderTextColor={palette.inkMuted} value={draft} onChangeText={setDraft} multiline maxLength={4000} style={{ flex: 1, minHeight: 48, maxHeight: 120, padding: 12, color: palette.ink }} />
            {icon('send', 'Gửi câu hỏi', () => setNotice('Chưa gửi: dịch vụ AI chưa được cấu hình. Câu hỏi và tài liệu vẫn ở trên thiết bị.'), !draft.trim())}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
