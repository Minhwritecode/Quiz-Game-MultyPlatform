import { errorMessage } from '@/core/domain/failure';
import { dependencies } from '@/composition/dependencies';
import type { ChatMessage, Conversation, PdfAttachment } from '../domain/repository';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useEffect, useRef, useState, type ElementRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  const userId = useAuthStore(s => s.user?.id);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(() => Crypto.randomUUID());
  const [historyVisible, setHistoryVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const owner = useRef(userId); owner.current = userId;
  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pdf, setPdf] = useState<PdfAttachment | null>(null);
  const [partial, setPartial] = useState('');
  const [documentText, setDocumentText] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    request.current?.abort(); request.current = null;
    setBusy(false); setMessages([]); setConversations([]); setDraft(''); setDocumentText(undefined);setPdf(null);setPartial(''); setNotice(''); setHelp(null); setHydrated(false); setHistoryVisible(false); setConversationId(Crypto.randomUUID());
    if (!userId) setHydrated(true);
    else void dependencies.assistant.load(userId).then(saved => {
      if (!active) return;
      setConversations(saved);
      if (saved[0]) { setMessages(saved[0].messages); setConversationId(saved[0].id); }
      setHydrated(true);
    }).catch(() => {if(active) {setNotice('Không đọc được lịch sử trên thiết bị.');setHydrated(true);}});
    return () => {active = false; request.current?.abort();};
  }, [userId]);
  const persist = (next: Conversation[]) => {
    setConversations(next);
    const account = userId;
    if(account) void dependencies.assistant.save(account,next).catch(() => {if(owner.current === account) setNotice('Không lưu được lịch sử. Hội thoại hiện tại vẫn đang mở.');});
  };
  const resetConversation = () => {setConversationId(Crypto.randomUUID());setMessages([]);setDraft('');setDocumentText(undefined);setPdf(null);setPartial('');setNotice('');setHistoryVisible(false);setHelp(null);};

  const send = async () => {
    if (syncing || request.current || !hydrated || picking || !draft.trim()) return;
    const history: ChatMessage[] = [...messages, {role:'user',content:draft.trim()}];
    const controller = new AbortController(); request.current=controller; setBusy(true); setPartial(''); setNotice('');
    let lastUpdate=0;
    try { const answer=await dependencies.assistant.ask(history,path,documentText,controller.signal, text => {if(!controller.signal.aborted && Date.now()-lastUpdate>80){lastUpdate=Date.now();setPartial(text);}},pdf ?? undefined); if(!controller.signal.aborted) {const completed: ChatMessage[] = [...history,{role:'assistant',content:answer}];setMessages(completed);setDraft('');persist([{id:conversationId,updatedAt:Date.now(),messages:completed},...conversations.filter(c=>c.id!==conversationId)].slice(0,20));} }
    catch(error) {if(!controller.signal.aborted) setNotice(errorMessage(error, 'Không gửi được.'));}
    finally {if(request.current===controller) {request.current=null;setBusy(false);setPartial('');}}
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [help, setHelp] = useState<(typeof guides)[number] | null>(null);
  const [picking, setPicking] = useState(false);
  const context = guides.find(guide => path.startsWith(guide.match));
  const close = () => setOpen(false);
  const pick = async () => {
    const account = userId;
    setPicking(true);
    try {
      const text = await dependencies.assistant.pickDocument();
      if(owner.current !== account) return;
      if(text) {setPdf(null);setDocumentText(text); setNotice(`Đã đọc ${text.length} ký tự (không lưu nội dung tệp vào lịch sử). Nội dung sẽ gửi kèm câu hỏi đến dịch vụ AI khi bạn bấm Gửi.`);}
    } catch(error) { if(owner.current===account) setNotice(errorMessage(error, 'Không chọn được tài liệu. Hãy thử lại.')); }
    finally { setPicking(false); }
  };
  const attachPdf = async () => {
    const account=userId; setPicking(true);
    try {const file=await dependencies.assistant.pickPdf();if(file && owner.current===account) {setDocumentText(undefined);setPdf(file);setNotice('PDF sẽ gửi đến AI khi bạn bấm Gửi; không lưu tệp vào lịch sử.');}}
    catch(error){if(owner.current===account)setNotice(errorMessage(error, 'Không đọc được PDF.'));}
    finally {setPicking(false);}
  };
  const sync = async () => {
    if(!userId || syncing) return;
    const account=userId;setSyncing(true);
    try {const saved=await dependencies.assistant.sync(account,conversations);if(owner.current!==account)return;setConversations(saved);const active=saved.find(c=>c.id===conversationId);if(active)setMessages(active.messages);else resetConversation();setNotice('Đã đồng bộ lịch sử với tài khoản.');}
    catch(error){if(owner.current===account)setNotice(errorMessage(error, 'Đồng bộ thất bại.'));}
    finally {setSyncing(false);}
  };
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || syncing} onPress={onPress} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}><Ionicons name={name} size={23} color={palette.indigo} /></Pressable>;
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
          <ScrollView ref={scroll} onContentSizeChange={() => {if(!historyVisible) scroll.current?.scrollToEnd({animated:false});}} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
            <Text style={{ color: palette.inkMuted }}>Bạn đang ở: {context?.title ?? (path === '/' ? 'Trang chủ' : 'Papyrus')}. Tên màn hình được dùng làm ngữ cảnh khi bạn gửi câu hỏi.</Text>
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: palette.indigoTint }}><Text style={{ color: palette.indigoDeep }}>Câu hỏi, lịch sử trong phiên và nội dung đính kèm sẽ được gửi tới AI. Hướng dẫn có sẵn dùng được khi chưa đăng nhập.</Text></View>
            {!messages.length && !historyVisible && [...(context ? [context] : []), ...guides.filter(item => item !== context)].map(item => <Pressable key={item.match} accessibilityRole="button" onPress={() => setHelp(item)} style={{ padding: 14, borderWidth: 1, borderColor: palette.paperMuted, borderRadius: 14 }}><Text style={{ color: palette.ink }}>{item.title}</Text></Pressable>)}
            {help && <View style={{ padding: 16, backgroundColor: palette.paperRaised, borderRadius: 16 }}><Text style={{ color: palette.ink, fontWeight: '700' }}>Hướng dẫn có sẵn · {help.title}</Text><Text selectable style={{ color: palette.ink, lineHeight: 23, marginTop: 8 }}>{help.text}</Text></View>}
            {historyVisible && <View style={{gap:8}}><Text style={{color:palette.ink}}>Lịch sử trên thiết bị · tối đa 20 hội thoại</Text>{conversations.length===0 && <Text style={{color:palette.inkMuted}}>Chưa có hội thoại đã lưu.</Text>}{conversations.map(c=><View key={c.id} style={{flexDirection:'row',alignItems:'center'}}><Pressable accessibilityRole="button" disabled={busy || picking || syncing} onPress={()=>{setConversationId(c.id);setMessages(c.messages);setDraft('');setDocumentText(undefined);setPdf(null);setPartial('');setNotice('');setHistoryVisible(false);}} style={{flex:1,padding:12}}><Text numberOfLines={2} style={{color:palette.ink}}>{c.messages[0]?.content || 'Hội thoại'}</Text></Pressable>{icon('trash-outline','Xóa hội thoại',()=>{void (async()=>{try {const account=userId;if(account)await dependencies.assistant.markDeleted(account,c.id);if(owner.current!==account)return;persist(conversations.filter(item=>item.id!==c.id));if(conversationId===c.id) resetConversation();}catch{setNotice('Không xóa được hội thoại. Hãy thử lại.');}})();},busy || picking)}</View>)}</View>}
            {messages.map((m,i)=><View key={i} style={{padding:12,borderRadius:12,backgroundColor:palette.paperRaised}}><Text style={{color:palette.indigo,fontWeight:'700'}}>{m.role==='user'?'Bạn':'Papybot'}</Text><Text selectable style={{color:palette.ink,lineHeight:23}}>{m.content}</Text></View>)}
            {busy && !!partial && <Text selectable style={{color:palette.ink,lineHeight:23}}>{partial}</Text>}
            {busy && <Text accessibilityLiveRegion="polite" style={{color:palette.ink}}>Papybot đang trả lời…</Text>}
            {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: palette.inkMuted }}>{notice}</Text>}
          </ScrollView>
          {pdf && <View style={{flexDirection:'row',alignItems:'center',paddingLeft:16}}><Text numberOfLines={1} style={{flex:1,color:palette.ink}}>{pdf.name}</Text>{icon('close','Bỏ PDF',()=>setPdf(null),busy || picking)}</View>}
          <View style={{flexDirection:'row'}}>
            {icon('cloud-outline',syncing?'Đang đồng bộ':'Đồng bộ lịch sử',()=>void sync(),busy || picking || !hydrated || !userId)}
            {icon('time-outline','Lịch sử hội thoại',()=>setHistoryVisible(v=>!v),busy || picking || !hydrated)}
            {busy && icon('stop-circle', 'Hủy trả lời', () => {request.current?.abort();request.current=null;setBusy(false);setPartial('');setNotice('Đã hủy chờ phản hồi. Lượt gọi có thể vẫn được tính.');})}
            {!busy && icon('refresh', 'Cuộc trò chuyện mới', resetConversation, picking || !hydrated)}
            {documentText && icon('document-text', 'Bỏ tài liệu đã đọc', () => setDocumentText(undefined), busy)}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderColor: palette.paperMuted, padding: 8 }}>
            {icon('document-outline','Đính kèm PDF',()=>void attachPdf(),picking || busy)}
            {icon('attach', 'Đọc tài liệu TXT hoặc DOCX', () => void pick(), picking || busy)}
            <TextInput accessibilityLabel="Câu hỏi cho Papybot" placeholder="Hỏi về app hoặc bài học…" placeholderTextColor={palette.inkMuted} editable={!busy && !syncing && hydrated} value={draft} onChangeText={setDraft} multiline maxLength={4000} style={{ flex: 1, minHeight: 48, maxHeight: 120, padding: 12, color: palette.ink }} />
            {icon('send', notice ? 'Thử gửi lại câu hỏi' : 'Gửi câu hỏi', () => void send(), !draft.trim() || busy || picking || !hydrated)}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
