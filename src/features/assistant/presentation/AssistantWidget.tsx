import { errorMessage } from '@/core/domain/failure';
import { dependencies } from '@/composition/dependencies';
import type { ChatMessage, Conversation, PdfAttachment } from '../domain/repository';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { memo, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import {
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
  { id: 'explain', icon: 'bulb-outline' as const, label: 'Giải thích khái niệm khó', prompt: 'Hãy giải thích ngắn gọn và dễ hiểu khái niệm trọng tâm của bài học này kèm ví dụ thực tế.' },
  { id: 'quiz', icon: 'help-circle-outline' as const, label: 'Tạo 3 câu hỏi ôn nhanh', prompt: 'Tạo giúp tôi 3 câu hỏi trắc nghiệm ôn tập nhanh kèm đáp án và giải thích ngắn.' },
  { id: 'summary', icon: 'document-text-outline' as const, label: 'Tóm tắt tài liệu đính kèm', prompt: 'Hãy tóm tắt các ý chính quan trọng nhất trong tài liệu tôi đính kèm dưới dạng gạch đầu dòng.' },
];

const guides = [
  { match: '/create', title: 'Tạo bộ đề', text: 'Từ trang chủ, chọn tạo thủ công hoặc tạo bằng AI. Nhập nội dung, kiểm tra câu hỏi và đáp án trước khi lưu vào thư viện.' },
  { match: '/study', title: 'Ôn tập', text: 'Mở một bộ đề trong thư viện để bắt đầu học. Mục lịch sử cho phép xem kết quả và các phiên học đang dở.' },
  { match: '/sets', title: 'Thư viện', text: 'Tìm bộ đề, mở để ôn tập hoặc chạm biểu tượng ba chấm để sửa, nhân bản, xuất CSV và xóa.' },
  { match: '/battle', title: 'Phòng đấu', text: 'Chủ phòng chọn bộ đề và tạo phòng. Người chơi nhập mã phòng, chọn sẵn sàng rồi chờ chủ phòng bắt đầu.' },
  { match: '/sync', title: 'Đồng bộ', text: 'Đăng nhập trước khi đồng bộ. Bộ đề trên cloud có thể được tải về thư viện trên mọi thiết bị.' },
  { match: '/settings', title: 'Cài đặt', text: 'Điều chỉnh giao diện sáng/tối, ngôn ngữ, âm thanh và quyền riêng tư tài khoản.' },
];

const getNow = () => Date.now();

const ActionIcon = memo(function ActionIcon({
  name,
  label,
  onPress,
  disabled = false,
  syncing = false,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  syncing?: boolean;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || syncing}
      onPress={onPress}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.38 : 1,
      }}
    >
      <Ionicons name={name} size={22} color={color} />
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
  const [hydrated, setHydrated] = useState(false);
  const owner = useRef(userId);
  useEffect(() => {
    owner.current = userId;
  }, [userId]);

  const scroll = useRef<ElementRef<typeof ScrollView>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pdf, setPdf] = useState<PdfAttachment | null>(null);
  const [partial, setPartial] = useState('');
  const [documentText, setDocumentText] = useState<string>();
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

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
    // Reset user-scoped history before loading the next account.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false);
    setMessages([]);
    setConversations([]);
    setDraft('');
    setDocumentText(undefined);
    setPdf(null);
    setPartial('');
    setNotice('');
    setHydrated(false);
    setHistoryVisible(false);
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

  const resetConversation = () => {
    setConversationId(Crypto.randomUUID() || `conv-${getNow()}`);
    setMessages([]);
    setDraft('');
    setDocumentText(undefined);
    setPdf(null);
    setPartial('');
    setNotice('');
    setHistoryVisible(false);
  };

  const send = async (overrideText?: string) => {
    const textToSend = (overrideText ?? draft).trim();
    if (syncing || request.current || !hydrated || picking || !textToSend) return;
    if (!userId) {
      setNotice('Vui lòng đăng nhập tài khoản để trò chuyện cùng Gia sư AI Papybot.');
      return;
    }

    const history: ChatMessage[] = [...messages, { role: 'user', content: textToSend }];
    const controller = new AbortController();
    request.current = controller;
    setMessages(history);
    setDraft('');
    setBusy(true);
    setPartial('');
    setNotice('');
    setHistoryVisible(false);
    let lastUpdate = 0;
    try {
      const answer = await dependencies.assistant.ask(
        history,
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
        pdf ?? undefined
      );
      if (!controller.signal.aborted) {
        const completed: ChatMessage[] = [...history, { role: 'assistant', content: answer }];
        setMessages(completed);
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
        setDraft(textToSend);
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
  const close = () => closeAssistant();

  const pick = async () => {
    const account = userId;
    setPicking(true);
    try {
      const text = await dependencies.assistant.pickDocument();
      if (owner.current !== account) return;
      if (text) {
        setPdf(null);
        setDocumentText(text);
        setNotice(`Đã nạp tài liệu (${text.length.toLocaleString('vi-VN')} ký tự). Hãy đặt câu hỏi cho Papybot.`);
      }
    } catch (error) {
      if (owner.current === account) setNotice(errorMessage(error, 'Không chọn được tài liệu. Hãy thử lại.'));
    } finally {
      setPicking(false);
    }
  };

  const attachPdf = async () => {
    const account = userId;
    setPicking(true);
    try {
      const file = await dependencies.assistant.pickPdf();
      if (file && owner.current === account) {
        setDocumentText(undefined);
        setPdf(file);
        setNotice(`Đã đính kèm PDF "${file.name}". Hãy đặt câu hỏi để AI phân tích.`);
      }
    } catch (error) {
      if (owner.current === account) setNotice(errorMessage(error, 'Không đọc được PDF.'));
    } finally {
      setPicking(false);
    }
  };

  const sync = async () => {
    if (!userId || syncing) return;
    const account = userId;
    setSyncing(true);
    try {
      const saved = await dependencies.assistant.sync(account, conversations);
      if (owner.current !== account) return;
      setConversations(saved);
      const active = saved.find((c) => c.id === conversationId);
      if (active) setMessages(active.messages);
      else resetConversation();
      setNotice('Đã đồng bộ lịch sử trò chuyện.');
    } catch (error) {
      if (owner.current === account) setNotice(errorMessage(error, 'Đồng bộ thất bại.'));
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

  // Show compact floating trigger ONLY on Study screens (Home has a dedicated card & DesktopNav has an icon).
  // Never clutter Battle, Games, Library, Scan, Profile, Leaderboard, Settings, or Auth!
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
            style={[
              styles.modalRoot,
              { alignItems: desktop ? 'flex-end' : 'stretch' },
            ]}
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
                  width: desktop ? 430 : '100%',
                  height: Math.min(height - insets.top - 24, 680),
                  marginRight: desktop ? 24 : 0,
                  marginBottom: desktop ? 24 : 0,
                  paddingBottom: desktop ? 0 : Math.max(8, insets.bottom),
                  backgroundColor: palette.paper,
                  borderColor: palette.paperMuted,
                },
              ]}
            >
              {/* Clean AI Tutor Header */}
              <View style={[styles.header, { borderBottomColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
                <View style={[styles.botAvatar, { backgroundColor: palette.indigoTint }]}>
                  <Ionicons name="sparkles" size={20} color={palette.indigo} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text accessibilityRole="header" style={[typography.title, { color: palette.ink }]}>
                    Papybot AI
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 12 }]} numberOfLines={1}>
                    Gia sư thông minh · {context?.title ?? 'Papyrus'}
                  </Text>
                </View>
                <ActionIcon
                  name="time-outline"
                  label="Lịch sử hội thoại"
                  onPress={() => setHistoryVisible((v) => !v)}
                  disabled={busy || picking || !hydrated}
                  syncing={syncing}
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
                        HỘI THOẠI GẦN ĐÂY ({conversations.length}/20)
                      </Text>
                      {userId ? (
                        <Pressable onPress={() => void sync()} disabled={syncing} accessibilityRole="button">
                          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ cloud'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
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
                              setDocumentText(undefined);
                              setPdf(null);
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
                    {/* Empty Welcome State with Actionable Quick Prompts */}
                    {messages.length === 0 && (
                      <View style={styles.welcomeWrap}>
                        <View style={[styles.welcomeIcon, { backgroundColor: palette.indigoTint }]}>
                          <Ionicons name="sparkles" size={28} color={palette.indigo} />
                        </View>
                        <Text style={[typography.title, { color: palette.ink, textAlign: 'center', marginTop: spacing.sm }]}>
                          Xin chào! Mình có thể giúp gì cho buổi học?
                        </Text>
                        <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                          Đặt câu hỏi hoặc đính kèm file PDF/DOCX/TXT để Papybot giải thích bám sát tài liệu.
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

                    {/* Chat Bubbles */}
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
                          <Text
                            style={[
                              typography.label,
                              {
                                fontSize: 10.5,
                                color: isUser ? 'rgba(255,255,255,0.82)' : palette.indigo,
                                marginBottom: 4,
                              },
                            ]}
                          >
                            {isUser ? 'BẠN' : 'PAPYBOT AI'}
                          </Text>
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
                          {partial || 'Đang suy nghĩ và tổng hợp câu trả lời…'}
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

              {/* Attached File Chip */}
              {(pdf || documentText) && (
                <View style={[styles.attachStrip, { backgroundColor: palette.paperRaised, borderTopColor: palette.paperMuted }]}>
                  <Ionicons name="document-attach-outline" size={16} color={palette.indigo} />
                  <Text numberOfLines={1} style={[typography.caption, { flex: 1, color: palette.ink, fontWeight: '700' }]}>
                    {pdf ? pdf.name : `Tài liệu đã nạp (${documentText?.length.toLocaleString('vi-VN')} ký tự)`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bỏ tài liệu đính kèm"
                    onPress={() => {
                      setPdf(null);
                      setDocumentText(undefined);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
                  </Pressable>
                </View>
              )}

              {/* Composer Bar */}
              <View style={[styles.composer, { borderTopColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
                <ActionIcon
                  name="document-outline"
                  label="Đính kèm PDF"
                  onPress={() => void attachPdf()}
                  disabled={picking || busy}
                  syncing={syncing}
                  color={palette.inkMuted}
                />
                <ActionIcon
                  name="attach"
                  label="Đọc tài liệu TXT hoặc DOCX"
                  onPress={() => void pick()}
                  disabled={picking || busy}
                  syncing={syncing}
                  color={palette.inkMuted}
                />
                <TextInput
                  accessibilityLabel="Câu hỏi cho Papybot"
                  placeholder={userId ? 'Nhập câu hỏi học tập…' : 'Đăng nhập để nhắn cho Papybot…'}
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
                    disabled={!draft.trim() || busy || picking || !hydrated}
                    onPress={() => void send()}
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor: draft.trim() ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Ionicons name="send" size={17} color={draft.trim() ? '#FFFFFF' : palette.inkMuted} />
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
  welcomeWrap: { alignItems: 'center', paddingVertical: spacing.md },
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
  promptList: { width: '100%', gap: spacing.xs, marginTop: spacing.lg },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
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
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    borderTopWidth: 1,
    paddingHorizontal: spacing.xs,
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
    marginHorizontal: 4,
  },
});
