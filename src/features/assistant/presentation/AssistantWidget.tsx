import { errorMessage } from '@/core/domain/failure';
import { dependencies } from '@/composition/dependencies';
import {
  encodeImageUriToJpegBase64,
  extractTextFromPdfBase64,
  resolveHistoryConflict,
  type ChatConflictResolution,
} from '@/composition/platform';
import { sanitizeOcrAndDocumentText } from '@/features/scan-ocr/domain/ocrCleaner';
import type { ChatMessage, Conversation, ImageAttachment, PdfAttachment } from '../domain/repository';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { memo, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

const QUICK_PROMPTS = [
  {
    id: 'explain',
    icon: 'bulb-outline' as const,
    label: 'Giải thích khái niệm khó',
    prompt: 'Hãy giải thích ngắn gọn và dễ hiểu khái niệm trọng tâm của bài học này kèm ví dụ thực tế.',
  },
  {
    id: 'quiz',
    icon: 'help-circle-outline' as const,
    label: 'Tạo 3 câu hỏi ôn nhanh',
    prompt: 'Tạo giúp tôi 3 câu hỏi trắc nghiệm ôn tập nhanh kèm đáp án và giải thích ngắn.',
  },
  {
    id: 'summary',
    icon: 'document-text-outline' as const,
    label: 'Tóm tắt tài liệu / ảnh đính kèm',
    prompt: 'Hãy tóm tắt các ý chính quan trọng nhất trong tài liệu hoặc ảnh tôi vừa đính kèm kèm trích dẫn nguồn.',
  },
];

const guides = [
  { match: '/create', title: 'Tạo bộ đề', text: 'Quét nhiều trang OCR, nhập PDF/DOCX/TXT hoặc tạo câu hỏi 6 định dạng.' },
  { match: '/study', title: 'Ôn tập 3D', text: 'Trả lời đúng để tung phép tại Thánh địa Học giả, xuất báo cáo PDF cuối buổi.' },
  { match: '/sets', title: 'Thư viện', text: '20 bộ câu hỏi chuẩn Đại học + bộ đề riêng của bạn, nhập/xuất CSV.' },
  { match: '/battle', title: 'Đấu trường', text: 'Phòng Kahoot Live không cần đăng nhập, phòng PIN Colosseum & 1v1 ELO.' },
  { match: '/sync', title: 'Đồng bộ', text: 'Đồng bộ đa thiết bị kèm xử lý xung đột an toàn.' },
  { match: '/settings', title: 'Cài đặt', text: 'Giao diện sáng/tối, nhắc học 20h thông minh và quyền riêng tư.' },
];

const getNow = () => Date.now();

const ActionIcon = memo(function ActionIcon({
  name,
  label,
  onPress,
  disabled = false,
  syncing = false,
  color,
  active = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  syncing?: boolean;
  color: string;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || syncing}
      onPress={onPress}
      style={{
        minWidth: 40,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: active ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
});

export function AssistantWidget() {
  const palette = usePalette();
  const path = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;
  const userId = useAuthStore((s) => s.user?.id);

  const open = useAssistantUiStore((s) => s.open);
  const initialPrompt = useAssistantUiStore((s) => s.initialPrompt);
  const openAssistant = useAssistantUiStore((s) => s.openAssistant);
  const closeAssistant = useAssistantUiStore((s) => s.closeAssistant);
  const consumeInitialPrompt = useAssistantUiStore((s) => s.consumeInitialPrompt);

  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [picking, setPicking] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(() => Crypto.randomUUID() || `conv-${getNow()}`);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [syncConflictOpen, setSyncConflictOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const owner = useRef(userId);
  useEffect(() => {
    owner.current = userId;
  }, [userId]);

  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pdf, setPdf] = useState<PdfAttachment | null>(null);
  const [attachedImagePayload, setAttachedImagePayload] = useState<ImageAttachment | null>(null);
  const [documentText, setDocumentText] = useState<string>();
  const [attachedLabel, setAttachedLabel] = useState<string>('');
  const [attachedImageUri, setAttachedImageUri] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [partial, setPartial] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const speechRecRef = useRef<any>(null);

  useEffect(() => {
    if (!open || !initialPrompt) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setDraft(initialPrompt);
      consumeInitialPrompt();
    });
    return () => {
      active = false;
    };
  }, [open, initialPrompt, consumeInitialPrompt]);

  useEffect(() => {
    let active = true;
    request.current?.abort();
    request.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false);
    setMessages([]);
    setConversations([]);
    setDraft('');
    setDocumentText(undefined);
    setPdf(null);
    setAttachedLabel('');
    setAttachedImageUri(null);
    setPartial('');
    setNotice('');
    setHydrated(false);
    setHistoryVisible(false);
    setSyncConflictOpen(false);
    setConversationId(Crypto.randomUUID() || `conv-${getNow()}`);
    if (!userId) {
      setHydrated(true);
    } else {
      void dependencies.assistant
        .load(userId)
        .then((saved) => {
          if (!active) return;
          setConversations(saved);
          if (saved[0]) {
            setMessages(saved[0].messages);
            setConversationId(saved[0].id);
          }
          setHydrated(true);
        })
        .catch(() => {
          if (active) {
            setNotice('Không đọc được lịch sử trên thiết bị.');
            setHydrated(true);
          }
        });
    }
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [userId]);

  const persist = (next: Conversation[]) => {
    setConversations(next);
    const account = userId;
    if (account) {
      void dependencies.assistant.save(account, next).catch(() => {
        if (owner.current === account) {
          setNotice('Không lưu được lịch sử. Hội thoại hiện tại vẫn đang mở.');
        }
      });
    }
  };

  const clearAttachments = () => {
    setPdf(null);
    setAttachedImagePayload(null);
    setDocumentText(undefined);
    setAttachedLabel('');
    setAttachedImageUri(null);
  };

  const resetConversation = () => {
    setConversationId(Crypto.randomUUID() || `conv-${getNow()}`);
    setMessages([]);
    setDraft('');
    clearAttachments();
    setPartial('');
    setNotice('');
    setHistoryVisible(false);
  };

  const hasAttachment = Boolean(pdf || (documentText && documentText.trim().length > 0) || attachedImageUri);
  const canSendNow = Boolean((draft.trim().length > 0 || hasAttachment) && !busy && !picking && hydrated);

  const send = async (overrideText?: string) => {
    const rawTyped = (overrideText ?? draft).trim();
    const textToSend =
      rawTyped ||
      (hasAttachment
        ? `Hãy phân tích, giải thích chi tiết và tóm tắt nội dung đính kèm (${attachedLabel || pdf?.name || 'tài liệu/ảnh'}).`
        : '');

    if (syncing || request.current || !hydrated || picking || !textToSend) return;
    if (!userId) {
      setNotice('Vui lòng đăng nhập tài khoản để trò chuyện cùng Gia sư AI Papybot.');
      return;
    }

    const displayUserContent =
      attachedLabel && !rawTyped.includes(attachedLabel)
        ? `📎 [${attachedLabel}]\n${textToSend}`
        : textToSend;

    const historyForUi: ChatMessage[] = [...messages, { role: 'user', content: displayUserContent }];
    const historyForApi: ChatMessage[] = [...messages, { role: 'user', content: textToSend }];
    const controller = new AbortController();
    request.current = controller;
    setMessages(historyForUi);
    setDraft('');
    setBusy(true);
    setPartial('');
    setNotice('');
    setHistoryVisible(false);
    let lastUpdate = 0;
    try {
      const answer = await dependencies.assistant.ask(
        historyForApi,
        path,
        documentText,
        controller.signal,
        (text) => {
          const now = getNow();
          if (!controller.signal.aborted && now - lastUpdate > 80) {
            lastUpdate = now;
            setPartial(text);
          }
        },
        pdf ?? undefined,
        attachedImagePayload ?? undefined
      );
      if (!controller.signal.aborted) {
        const completed: ChatMessage[] = [...historyForUi, { role: 'assistant', content: answer }];
        setMessages(completed);
        clearAttachments();
        persist(
          [
            { id: conversationId, updatedAt: getNow(), messages: completed },
            ...conversations.filter((c) => c.id !== conversationId),
          ].slice(0, 20)
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages(messages);
        setDraft(rawTyped);
        setNotice(errorMessage(error, 'Không thể kết nối Papybot AI lúc này. Hãy thử lại.'));
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
        setPartial('');
      }
    }
  };

  const context = useMemo(() => guides.find((guide) => path.startsWith(guide.match)), [path]);
  const close = () => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setListening(false);
    closeAssistant();
  };

  // 1. Rich Document Intake (PDF / DOCX / MD / TXT) — extracts text locally AND keeps PDF base64!
  const attachDocumentOrPdf = async () => {
    const account = userId;
    setPicking(true);
    setNotice('');
    try {
      const picked = await dependencies.intake.pickRichSourceDocument();
      if (!picked || owner.current !== account) return;
      if (picked.kind === 'pdf') {
        const extracted = picked.extractedText || extractTextFromPdfBase64(picked.fileBase64);
        setPdf(picked.fileBase64 ? { name: picked.name, data: picked.fileBase64 } : null);
        setDocumentText(extracted || `Tệp PDF đính kèm: ${picked.name}`);
        setAttachedImageUri(null);
        setAttachedLabel(`PDF: ${picked.name}`);
        setNotice(
          extracted.length > 20
            ? `Đã đọc xong PDF "${picked.name}" (${extracted.length.toLocaleString('vi-VN')} ký tự). Bấm Gửi hoặc nhập câu hỏi!`
            : `Đã đính kèm PDF "${picked.name}". Bấm Gửi để phân tích!`
        );
      } else {
        setPdf(null);
        setAttachedImageUri(null);
        setDocumentText(picked.extractedText || `Tệp đính kèm: ${picked.name}`);
        setAttachedLabel(`${picked.kind.toUpperCase()}: ${picked.name}`);
        setNotice(`Đã nạp "${picked.name}" (${picked.extractedText.length.toLocaleString('vi-VN')} ký tự). Bấm Gửi ngay hoặc gõ câu hỏi!`);
      }
    } catch (error) {
      if (owner.current === account) setNotice(errorMessage(error, 'Không đọc được tệp đính kèm.'));
    } finally {
      setPicking(false);
    }
  };

  // 2. Photo Library or Camera Capture -> Live Thumbnail + Instant Multilingual OCR into Papybot!
  const attachImage = async (fromCamera: boolean) => {
    const account = userId;
    setPicking(true);
    setNotice(fromCamera ? 'Đang mở máy ảnh…' : 'Đang mở thư viện ảnh…');
    try {
      const uris = await (fromCamera
        ? dependencies.intake.captureSourceImage()
        : dependencies.intake.pickSourceImages());
      const uri = uris[0];
      if (!uri || owner.current !== account) {
        setNotice('');
        return;
      }
      setPdf(null);
      setAttachedImageUri(uri);
      setAttachedLabel(fromCamera ? 'Ảnh chụp Camera' : 'Ảnh từ Thư viện');
      setNotice('🔍 Đang phân tích hình ảnh & nhận diện chữ độ nét cao…');

      const [jpegBase64, rawOcr] = await Promise.all([
        encodeImageUriToJpegBase64(uri),
        dependencies.intake.recognizeLocalImage(uri, {
          language: 'vie+eng',
        }),
      ]);
      const ocrText = sanitizeOcrAndDocumentText(rawOcr);

      if (owner.current !== account) return;
      if (jpegBase64) {
        setAttachedImagePayload({ mimeType: 'image/jpeg', data: jpegBase64 });
      }
      setDocumentText(
        ocrText.length > 0
          ? ocrText
          : undefined
      );
      setNotice(
        ocrText.length > 0
          ? `✅ Đã đọc sạch ${ocrText.length.toLocaleString('vi-VN')} ký tự từ ảnh! Nhập câu hỏi hoặc bấm Gửi ngay.`
          : '✅ Đã nạp ảnh chất lượng cao vào Papybot Vision. Hãy nhập yêu cầu hoặc bấm Gửi ngay!'
      );
    } catch (error) {
      if (owner.current === account) {
        setNotice(errorMessage(error, 'Không mở được ảnh hoặc camera.'));
      }
    } finally {
      setPicking(false);
    }
  };

  // 3. Voice Input (Speech-to-Text via Web Speech API)
  const toggleVoiceInput = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setNotice('Tính năng nhập giọng nói dùng trực tiếp bàn phím đọc chính tả (🎤) trên bàn phím điện thoại của bạn.');
      return;
    }
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRec) {
      setNotice('Trình duyệt này chưa hỗ trợ Web Speech API — hãy dùng nút 🎤 trên bàn phím.');
      return;
    }
    if (listening && speechRecRef.current) {
      speechRecRef.current.stop();
      setListening(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'vi-VN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setDraft(transcript.trim());
        }
      };
      rec.onerror = () => {
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
      };
      speechRecRef.current = rec;
      setListening(true);
      setNotice('🎙️ Đang lắng nghe giọng nói tiếng Việt… Hãy nói câu hỏi của bạn!');
      rec.start();
    } catch {
      setListening(false);
    }
  };

  // 4. Voice Output (Text-to-Speech Read-Aloud)
  const toggleSpeakMessage = (idx: number, content: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setNotice('Thiết bị hiện tại chưa hỗ trợ đọc giọng nói trực tiếp.');
      return;
    }
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = content.replace(/[*#`_~[\]]/g, '');
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'vi-VN';
    utter.rate = 1.04;
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  // 5. Sync with Interactive Conflict Resolution (Keep Cloud / Keep Local / Keep Both)
  const sync = async () => {
    if (!userId || syncing) return;
    const account = userId;
    setSyncing(true);
    setSyncConflictOpen(false);
    try {
      const saved = await dependencies.assistant.sync(account, conversations);
      if (owner.current !== account) return;
      setConversations(saved);
      const active = saved.find((c) => c.id === conversationId);
      if (active) setMessages(active.messages);
      else if (saved[0]) {
        setConversationId(saved[0].id);
        setMessages(saved[0].messages);
      }
      setNotice('✅ Đã đồng bộ lịch sử trò chuyện đa thiết bị.');
    } catch (error) {
      if (owner.current === account) {
        const msg = errorMessage(error, 'Đồng bộ gặp xung đột phiên bản.');
        setNotice(msg);
        if (msg.includes('thiết bị khác') || msg.includes('xung đột')) {
          setSyncConflictOpen(true);
        }
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveConflict = async (choice: ChatConflictResolution) => {
    if (!userId || syncing) return;
    setSyncing(true);
    try {
      const resolved = await resolveHistoryConflict(userId, conversations, choice);
      setConversations(resolved);
      if (resolved[0]) {
        setConversationId(resolved[0].id);
        setMessages(resolved[0].messages);
      }
      setSyncConflictOpen(false);
      setNotice('✅ Đã giải quyết xung đột và đồng bộ thành công!');
    } catch (err) {
      setNotice(errorMessage(err, 'Không thể hoàn tất giải quyết xung đột.'));
    } finally {
      setSyncing(false);
    }
  };

  const cancelReply = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setPartial('');
    setNotice('Đã dừng tạo phản hồi.');
  };

  const deleteConversation = (targetId: string) => {
    void (async () => {
      try {
        const account = userId;
        if (account) await dependencies.assistant.markDeleted(account, targetId);
        if (owner.current !== account) return;
        persist(conversations.filter((item) => item.id !== targetId));
        if (conversationId === targetId) resetConversation();
      } catch {
        setNotice('Không xóa được hội thoại. Hãy thử lại.');
      }
    })();
  };

  const showFloatingFab = path.startsWith('/study/');

  return (
    <>
      {!open && showFloatingFab && (
        <Pressable
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Mở Papybot"
          onPress={() => openAssistant()}
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: Math.max(20, insets.bottom + 18),
              backgroundColor: palette.indigo,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </Pressable>
      )}

      {open ? (
        <Modal visible transparent animationType="fade" onRequestClose={close} onDismiss={close}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalRoot, { alignItems: desktop ? 'flex-end' : 'stretch' }]}
          >
            <Pressable
              accessibilityLabel="Đóng Papybot"
              accessibilityRole="button"
              onPress={close}
              style={styles.backdrop}
            />

            <View
              accessibilityViewIsModal
              style={[
                styles.sheet,
                {
                  width: desktop ? 460 : '100%',
                  height: desktop ? Math.min(height - 48, 720) : Math.round((height - insets.top) * 0.89),
                  marginRight: desktop ? 24 : 0,
                  marginBottom: desktop ? 24 : 0,
                  paddingBottom: desktop ? 0 : Math.max(8, insets.bottom),
                  backgroundColor: palette.paper,
                  borderColor: palette.paperMuted,
                },
              ]}
            >
              {/* Multimodal AI Tutor Header */}
              <View style={[styles.header, { borderBottomColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
                <View style={[styles.botAvatar, { backgroundColor: palette.indigoTint }]}>
                  <Ionicons name="sparkles" size={20} color={palette.indigo} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text accessibilityRole="header" style={[typography.title, { color: palette.ink }]}>
                    Gia sư Papybot AI
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11.5 }]} numberOfLines={1}>
                    Giải bài · Đọc tài liệu · {context?.title ?? 'Papyrus'}
                  </Text>
                </View>
                <ActionIcon
                  name="time-outline"
                  label="Lịch sử hội thoại"
                  onPress={() => setHistoryVisible((v) => !v)}
                  disabled={busy || picking || !hydrated}
                  syncing={syncing}
                  active={historyVisible}
                  color={historyVisible ? palette.indigo : palette.inkMuted}
                />
                <ActionIcon
                  name="create-outline"
                  label="Cuộc trò chuyện mới"
                  onPress={resetConversation}
                  disabled={picking || !hydrated || busy}
                  syncing={syncing}
                  color={palette.inkMuted}
                />
                <ActionIcon name="close" label="Đóng Papybot" onPress={close} syncing={syncing} color={palette.ink} />
              </View>

              {/* Conversation Body */}
              <ScrollView
                ref={scroll}
                onContentSizeChange={() => {
                  if (!historyVisible) scroll.current?.scrollToEnd({ animated: false });
                }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollBody}
              >
                {historyVisible ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={styles.historyTopRow}>
                      <Text style={[typography.label, { color: palette.inkMuted }]}>
                        HỘI THOẠI ĐA THIẾT BỊ ({conversations.length}/20)
                      </Text>
                      {userId ? (
                        <Pressable onPress={() => void sync()} disabled={syncing} accessibilityRole="button">
                          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                            {syncing ? 'Đang đồng bộ...' : '☁️ Đồng bộ Cloud'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {syncConflictOpen && (
                      <View style={[styles.conflictBox, { backgroundColor: palette.goldTint, borderColor: palette.gold }]}>
                        <Text style={[typography.caption, { color: palette.ink, fontWeight: '800' }]}>
                          ⚠️ Phát hiện khác biệt phiên bản giữa Thiết bị này và Đám mây:
                        </Text>
                        <View style={styles.conflictBtns}>
                          <Pressable
                            onPress={() => void handleResolveConflict('keep_both')}
                            style={[styles.conflictChip, { backgroundColor: palette.indigo }]}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>Giữ cả hai</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void handleResolveConflict('keep_local')}
                            style={[styles.conflictChip, { backgroundColor: palette.paperRaised, borderColor: palette.indigo, borderWidth: 1 }]}
                          >
                            <Text style={{ color: palette.indigo, fontSize: 11.5, fontWeight: '800' }}>Giữ bản Trên máy</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void handleResolveConflict('keep_cloud')}
                            style={[styles.conflictChip, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted, borderWidth: 1 }]}
                          >
                            <Text style={{ color: palette.ink, fontSize: 11.5, fontWeight: '700' }}>Giữ bản Cloud</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {conversations.length === 0 ? (
                      <Text style={[typography.caption, { color: palette.inkMuted }]}>
                        Chưa có hội thoại nào được lưu.
                      </Text>
                    ) : (
                      conversations.map((c) => (
                        <View
                          key={c.id}
                          style={[
                            styles.historyRow,
                            { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                          ]}
                        >
                          <Pressable
                            accessibilityRole="button"
                            disabled={busy || picking || syncing}
                            onPress={() => {
                              setConversationId(c.id);
                              setMessages(c.messages);
                              setDraft('');
                              clearAttachments();
                              setPartial('');
                              setNotice('');
                              setHistoryVisible(false);
                            }}
                            style={{ flex: 1, paddingVertical: 10, paddingLeft: 12 }}
                          >
                            <Text numberOfLines={2} style={[typography.body, { color: palette.ink, fontSize: 14 }]}>
                              {c.messages[0]?.content || 'Hội thoại'}
                            </Text>
                          </Pressable>
                          <ActionIcon
                            name="trash-outline"
                            label="Xóa hội thoại"
                            onPress={() => deleteConversation(c.id)}
                            disabled={busy || picking}
                            syncing={syncing}
                            color={palette.danger}
                          />
                        </View>
                      ))
                    )}
                  </View>
                ) : (
                  <>
                    {messages.length === 0 && (
                      <View style={styles.welcomeWrap}>
                        <View style={[styles.welcomeIcon, { backgroundColor: palette.indigoTint }]}>
                          <Ionicons name="sparkles" size={28} color={palette.indigo} />
                        </View>
                        <Text style={[typography.title, { color: palette.ink, textAlign: 'center', marginTop: spacing.sm }]}>
                          Gia sư Papybot AI
                        </Text>
                        <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                          Chụp ảnh đề bài, chọn ảnh từ thư viện, đính kèm PDF/DOCX, nhập giọng nói 🎤 hoặc giải toán tức thì!
                        </Text>

                        {!userId ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              close();
                              router.push('/auth');
                            }}
                            style={[styles.signInBanner, { backgroundColor: palette.indigo }]}
                          >
                            <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                            <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '800' }]}>
                              Đăng nhập để chat với Papybot AI
                            </Text>
                          </Pressable>
                        ) : (
                          <View style={styles.promptList}>
                            {QUICK_PROMPTS.map((item) => (
                              <Pressable
                                key={item.id}
                                accessibilityRole="button"
                                onPress={() => void send(item.prompt)}
                                style={({ pressed }) => [
                                  styles.promptChip,
                                  {
                                    backgroundColor: palette.paperRaised,
                                    borderColor: palette.paperMuted,
                                    opacity: pressed ? 0.78 : 1,
                                  },
                                ]}
                              >
                                <Ionicons name={item.icon} size={17} color={palette.indigo} />
                                <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                                  {item.label}
                                </Text>
                                <Ionicons name="arrow-up-circle-outline" size={18} color={palette.inkMuted} />
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Chat Bubbles + Voice Read-Aloud Button */}
                    {messages.map((m, i) => {
                      const isUser = m.role === 'user';
                      return (
                        <View
                          key={i}
                          style={[
                            styles.bubble,
                            isUser
                              ? [styles.userBubble, { backgroundColor: palette.indigo }]
                              : [styles.botBubble, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }],
                          ]}
                        >
                          <View style={styles.bubbleMetaRow}>
                            <Text
                              style={[
                                typography.label,
                                {
                                  fontSize: 10.5,
                                  color: isUser ? 'rgba(255,255,255,0.82)' : palette.indigo,
                                },
                              ]}
                            >
                              {isUser ? 'BẠN' : 'PAPYBOT AI'}
                            </Text>
                            {!isUser && (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Nghe câu trả lời"
                                onPress={() => toggleSpeakMessage(i, m.content)}
                                hitSlop={8}
                                style={styles.ttsBtn}
                              >
                                <Ionicons
                                  name={speakingIdx === i ? 'stop-circle-outline' : 'volume-high-outline'}
                                  size={15}
                                  color={speakingIdx === i ? palette.danger : palette.indigo}
                                />
                                <Text style={{ fontSize: 10.5, fontWeight: '700', color: palette.indigo }}>
                                  {speakingIdx === i ? 'Dừng' : 'Nghe'}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                          <Text
                            selectable
                            style={[
                              typography.body,
                              { color: isUser ? '#FFFFFF' : palette.ink, lineHeight: 22 },
                            ]}
                          >
                            {m.content}
                          </Text>
                        </View>
                      );
                    })}

                    {busy && (
                      <View
                        style={[
                          styles.bubble,
                          styles.botBubble,
                          { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                        ]}
                      >
                        <Text style={[typography.label, { fontSize: 10.5, color: palette.indigo, marginBottom: 4 }]}>
                          PAPYBOT AI
                        </Text>
                        <Text selectable accessibilityLiveRegion="polite" style={[typography.body, { color: palette.ink }]}>
                          {partial || 'Đang phân tích và tổng hợp câu trả lời…'}
                        </Text>
                      </View>
                    )}

                    {!!notice && (
                      <View style={[styles.noticeBox, { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder }]}>
                        <Ionicons name="information-circle-outline" size={16} color={palette.indigoDeep} />
                        <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: palette.indigoDeep, flex: 1 }]}>
                          {notice}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              {/* Attached Image Thumbnail / Document Preview Strip */}
              {hasAttachment && (
                <View style={[styles.attachStrip, { backgroundColor: palette.paperRaised, borderTopColor: palette.paperMuted }]}>
                  {attachedImageUri ? (
                    <Image source={{ uri: attachedImageUri }} style={styles.attachThumb} />
                  ) : (
                    <Ionicons name="document-attach" size={18} color={palette.indigo} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[typography.caption, { color: palette.ink, fontWeight: '800' }]}>
                      {attachedLabel || pdf?.name || 'Tài liệu đã nạp'}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: palette.inkMuted }}>
                      {documentText
                        ? `Sẵn sàng gửi cùng câu hỏi (${documentText.length.toLocaleString('vi-VN')} ký tự)`
                        : 'Sẵn sàng gửi cho AI'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bỏ đính kèm"
                    onPress={clearAttachments}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={20} color={palette.inkMuted} />
                  </Pressable>
                </View>
              )}

              {/* Multimodal Attachment & Voice Quick Toolbar */}
              <View style={[styles.mediaToolbar, { backgroundColor: palette.paperRaised, borderTopColor: palette.paperMuted }]}>
                <Pressable
                  disabled={picking || busy}
                  onPress={() => void attachImage(true)}
                  style={[styles.mediaChip, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
                >
                  <Ionicons name="camera-outline" size={15} color={palette.indigo} />
                  <Text style={[styles.mediaChipText, { color: palette.ink }]}>Chụp ảnh</Text>
                </Pressable>
                <Pressable
                  disabled={picking || busy}
                  onPress={() => void attachImage(false)}
                  style={[styles.mediaChip, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
                >
                  <Ionicons name="images-outline" size={15} color={palette.mint} />
                  <Text style={[styles.mediaChipText, { color: palette.ink }]}>Thư viện</Text>
                </Pressable>
                <Pressable
                  disabled={picking || busy}
                  onPress={() => void attachDocumentOrPdf()}
                  style={[styles.mediaChip, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
                >
                  <Ionicons name="document-attach-outline" size={15} color={palette.gold} />
                  <Text style={[styles.mediaChipText, { color: palette.ink }]}>PDF/DOCX</Text>
                </Pressable>
                <Pressable
                  disabled={picking || busy}
                  onPress={toggleVoiceInput}
                  style={[
                    styles.mediaChip,
                    {
                      borderColor: listening ? palette.danger : palette.paperMuted,
                      backgroundColor: listening ? palette.dangerTint : palette.paper,
                    },
                  ]}
                >
                  <Ionicons name={listening ? 'mic' : 'mic-outline'} size={15} color={listening ? palette.danger : palette.indigo} />
                  <Text style={[styles.mediaChipText, { color: listening ? palette.danger : palette.ink }]}>
                    {listening ? 'Đang nghe…' : 'Giọng nói'}
                  </Text>
                </Pressable>
              </View>

              {/* Composer Bar */}
              <View style={[styles.composer, { borderTopColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
                <TextInput
                  accessibilityLabel="Câu hỏi cho Papybot"
                  placeholder={
                    hasAttachment
                      ? 'Nhập yêu cầu cho tệp/ảnh đính kèm (hoặc bấm Gửi luôn)…'
                      : userId
                      ? 'Hỏi bài, tính toán (vd: 2x+6=14), dịch thuật…'
                      : 'Đăng nhập để nhắn cho Papybot…'
                  }
                  placeholderTextColor={palette.inkMuted}
                  editable={!busy && !syncing && hydrated}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => void send()}
                  multiline
                  maxLength={4000}
                  style={[
                    styles.input,
                    { color: palette.ink, backgroundColor: palette.paper, borderColor: palette.paperMuted },
                  ]}
                />
                {busy ? (
                  <ActionIcon
                    name="stop-circle"
                    label="Hủy trả lời"
                    onPress={cancelReply}
                    syncing={syncing}
                    color={palette.danger}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gửi câu hỏi"
                    disabled={!canSendNow}
                    onPress={() => void send()}
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor: canSendNow ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Ionicons name="send" size={17} color={canSendNow ? '#FFFFFF' : palette.inkMuted} />
                  </Pressable>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    zIndex: 50,
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6, 10, 36, 0.58)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  botAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  welcomeWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBanner: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  promptList: { width: '100%', gap: spacing.xs, marginTop: spacing.md },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  bubble: {
    maxWidth: '90%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  ttsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  conflictBox: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 8,
  },
  conflictBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  conflictChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  attachStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  mediaToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderTopWidth: 1,
  },
  mediaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  mediaChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 14.5,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
