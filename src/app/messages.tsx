import { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import { AppIcon } from '@/shared/AppIcon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { pickMultipleMediaImages, pickVideoWithAutoCover } from '@/composition/social';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import { matchesVietnameseSearch } from '@/features/social/domain/rankingAndPermissions';
import type {
  DirectOrGroupMessage,
  SocialMediaItem,
  UnifiedPoll,
} from '@/features/social/domain/models';
import { UnifiedZaloPollCard } from '@/features/social/presentation/UnifiedZaloPollCard';
import { SharedPostCard } from '@/features/social/presentation/SharedPostCard';
import { GifStickerEmojiPickerModal } from '@/features/social/presentation/GifStickerEmojiPickerModal';
import { VideoCoverEditorModal } from '@/features/social/presentation/VideoCoverEditorModal';

type InboxTab = 'inbox' | 'requests' | 'live' | 'archived';

export default function DedicatedMessagesScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isSplitDesktop = width >= 768;

  const params = useLocalSearchParams<{
    convId?: string;
    peerId?: string;
    peerName?: string;
    initialText?: string;
  }>();

  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const isGuest = !user || viewerId === 'guest';
  const viewerName = user?.displayName?.trim() || 'Khách';
  const viewerAvatar = user?.avatarUrl ?? null;

  const profilesById = useSocialStore((s) => s.profilesById);
  const conversations = useSocialStore((s) => s.conversations);
  const chatMessages = useSocialStore((s) => s.chatMessages);

  const openOrCreateDirectConversation = useSocialStore((s) => s.openOrCreateDirectConversation);
  const createGroupConversation = useSocialStore((s) => s.createGroupConversation);
  const acceptOrArchiveConversation = useSocialStore((s) => s.acceptOrArchiveConversation);
  const togglePinOrMuteConversation = useSocialStore((s) => s.togglePinOrMuteConversation);
  const markConversationRead = useSocialStore((s) => s.markConversationRead);
  const sendChatMessage = useSocialStore((s) => s.sendChatMessage);
  const editOrRecallChatMessage = useSocialStore((s) => s.editOrRecallChatMessage);
  const toggleChatMessageReaction = useSocialStore((s) => s.toggleChatMessageReaction);
  const pinChatMessage = useSocialStore((s) => s.pinChatMessage);
  const voteUnifiedPoll = useSocialStore((s) => s.voteUnifiedPoll);
  const addUnifiedPollOption = useSocialStore((s) => s.addUnifiedPollOption);
  const toggleCloseUnifiedPoll = useSocialStore((s) => s.toggleCloseUnifiedPoll);
  const submitModerationReport = useSocialStore((s) => s.submitModerationReport);

  const [inboxTab, setInboxTab] = useState<InboxTab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string>(
    params.convId || conversations[0]?.id || ''
  );
  const [mobileRoomOpen, setMobileRoomOpen] = useState<boolean>(
    Boolean(params.convId || params.peerId)
  );

  // Composer & Message Actions
  const [draftText, setDraftText] = useState<string>(params.initialText || '');
  const [pendingAttachments, setPendingAttachments] = useState<SocialMediaItem[]>([]);
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    senderName: string;
    preview: string;
  } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [forwardingMessage, setForwardingMessage] = useState<DirectOrGroupMessage | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<DirectOrGroupMessage | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);

  // Modals
  const [stickerOpen, setStickerOpen] = useState(false);
  const [editingVideoCover, setEditingVideoCover] = useState<SocialMediaItem | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupTopic, setGroupTopic] = useState('Nhóm học tập & thảo luận');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Unified Zalo Poll Builder Modal
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(true);
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollAllowAddOptions, setPollAllowAddOptions] = useState(true);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  // Handle deep-linked `?peerId=...&peerName=...` or `?convId=...`
  useEffect(() => {
    if (params.peerId && params.peerName && !isGuest) {
      const conv = openOrCreateDirectConversation(
        { id: viewerId, name: viewerName, avatar: viewerAvatar },
        { id: params.peerId, name: params.peerName }
      );
      if (!conv) return undefined;
      const t = setTimeout(() => {
        setSelectedConvId(conv.id);
        setInboxTab(conv.requestState === 'pending' ? 'requests' : 'inbox');
        setMobileRoomOpen(true);
      }, 0);
      return () => clearTimeout(t);
    }
    if (params.convId) {
      const t = setTimeout(() => {
        setSelectedConvId(params.convId!);
        setMobileRoomOpen(true);
      }, 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [
    isGuest,
    openOrCreateDirectConversation,
    params.convId,
    params.peerId,
    params.peerName,
    viewerAvatar,
    viewerId,
    viewerName,
  ]);

  // Mark active conversation as read
  useEffect(() => {
    if (!selectedConvId || !viewerId) return;
    markConversationRead(selectedConvId, viewerId);
  }, [markConversationRead, selectedConvId, viewerId]);

  const requestCount = useMemo(
    () => conversations.filter((c) => c.requestState === 'pending').length,
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim();
    return conversations
      .filter((c) => {
        if (inboxTab === 'requests') return c.requestState === 'pending';
        if (inboxTab === 'archived') return c.requestState === 'archived';
        if (inboxTab === 'live') return c.kind === 'live_room' && c.requestState !== 'archived';
        return c.requestState === 'accepted' && c.kind !== 'live_room';
      })
      .filter((c) => {
        if (!q) return true;
        if (matchesVietnameseSearch(`${c.title} ${c.subtitle} ${c.lastMessagePreview}`, q)) {
          return true;
        }
        return chatMessages.some(
          (m) => m.conversationId === c.id && !m.isRecalled && matchesVietnameseSearch(m.text, q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt);
      });
  }, [chatMessages, conversations, inboxTab, searchQuery]);

  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.id === selectedConvId) ??
      filteredConversations[0] ??
      conversations[0] ??
      null,
    [conversations, filteredConversations, selectedConvId]
  );

  const activeMessages = useMemo(
    () =>
      activeConversation
        ? chatMessages.filter((m) => m.conversationId === activeConversation.id)
        : [],
    [activeConversation, chatMessages]
  );

  const pinnedMsg = useMemo(
    () =>
      activeConversation?.pinnedMessageId
        ? activeMessages.find((m) => m.id === activeConversation.pinnedMessageId) ?? null
        : null,
    [activeConversation, activeMessages]
  );

  const peerProfile = activeConversation?.peerUserId
    ? profilesById[activeConversation.peerUserId]
    : undefined;

  const handlePickPhotos = async () => {
    const imgs = await pickMultipleMediaImages(4);
    if (imgs.length > 0) {
      setPendingAttachments((prev) => [...prev, ...imgs].slice(0, 6));
    }
  };

  const handlePickVideo = async () => {
    const vid = await pickVideoWithAutoCover('16:9');
    if (vid) {
      setPendingAttachments((prev) => [...prev, vid].slice(0, 6));
      setEditingVideoCover(vid);
    }
  };

  const handleToggleVoiceNote = () => {
    if (isGuest) {
      showToast('Vui lòng đăng nhập để gửi tin nhắn.');
      return;
    }
    if (!recordingVoice) {
      setRecordingVoice(true);
      return;
    }
    setRecordingVoice(false);
    if (!activeConversation) return;
    sendChatMessage({
      conversationId: activeConversation.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: viewerAvatar,
      text: 'Tin nhắn thoại (0:08)',
      mediaAttachments: [
        {
          id: `voice-${Date.now()}`,
          kind: 'audio',
          uri: 'voice-note://08s',
          durationSec: 8,
          fileName: 'tin-nhan-thoai.m4a',
        },
      ],
      replyTo: replyTarget,
    });
    setReplyTarget(null);
  };

  const handleSend = () => {
    if (isGuest) {
      showToast('Vui lòng đăng nhập để gửi tin nhắn.');
      return;
    }
    if (!activeConversation) return;
    if (!draftText.trim() && pendingAttachments.length === 0) return;

    sendChatMessage({
      conversationId: activeConversation.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: viewerAvatar,
      text: draftText.trim(),
      mediaAttachments: pendingAttachments,
      replyTo: replyTarget,
    });
    setDraftText('');
    setPendingAttachments([]);
    setReplyTarget(null);
  };

  const handlePublishPollInChat = () => {
    if (isGuest) {
      showToast('Vui lòng đăng nhập để tạo khảo sát.');
      return;
    }
    if (!activeConversation || !pollQuestion.trim()) return;
    const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (validOpts.length < 2) return;

    const newPoll: UnifiedPoll = {
      id: `cpoll-${Date.now()}`,
      scopeType: activeConversation.kind === 'live_room' ? 'live' : 'chat',
      question: pollQuestion.trim(),
      options: validOpts.map((text, idx) => ({
        id: `copt-${Date.now()}-${idx}`,
        text,
        voterIds: [],
      })),
      allowMultiple: pollAllowMultiple,
      isAnonymous: pollIsAnonymous,
      allowAddOptions: pollAllowAddOptions,
      allowChangeVote: true,
      isClosed: false,
      createdBy: viewerId,
      createdAt: new Date().toISOString(),
    };

    sendChatMessage({
      conversationId: activeConversation.id,
      senderId: viewerId,
      senderName: viewerName,
      senderAvatar: viewerAvatar,
      text: `Khảo sát: ${newPoll.question}`,
      poll: newPoll,
    });

    setPollQuestion('');
    setPollOptions(['', '']);
    setPollModalOpen(false);
  };

  const candidateProfiles = useMemo(
    () => Object.values(profilesById).filter((p) => p.id !== viewerId),
    [profilesById, viewerId]
  );

  const showConversationList = isSplitDesktop || !mobileRoomOpen;
  const showActiveChatPane = isSplitDesktop || mobileRoomOpen;

  return (
    <Screen scroll={false}>
      <View style={styles.rootWrap}>
        <TopBar
          title="Tin nhắn"
          subtitle="Trò chuyện cá nhân & nhóm học tập"
          onBack={() => {
            if (!isSplitDesktop && mobileRoomOpen) {
              setMobileRoomOpen(false);
            } else if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/community');
            }
          }}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tạo nhóm trò chuyện mới"
              onPress={() => {
                if (isGuest) {
                  showToast('Vui lòng đăng nhập để tạo nhóm trò chuyện.');
                  return;
                }
                setCreateGroupOpen(true);
              }}
              style={[styles.newGroupBtn, { backgroundColor: palette.indigo }]}
            >
              <AppIcon name="people" size={15} color={palette.onPrimary} />
              <Text style={{ color: palette.onPrimary, fontSize: 12, fontWeight: '800' }}>
                Tạo nhóm
              </Text>
            </Pressable>
          }
        />

        {toastMsg ? (
          <View style={[styles.toastBanner, { backgroundColor: palette.indigo }]}>
            <AppIcon name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', flexShrink: 1 }}>
              {toastMsg}
            </Text>
          </View>
        ) : null}

        <View style={[styles.mainBody, isSplitDesktop && styles.mainBodySplit]}>
          {/* LEFT PANE: CONVERSATION DIRECTORY */}
          {showConversationList ? (
            <View
              style={[
                styles.leftPane,
                isSplitDesktop && {
                  width: 340,
                  borderRightWidth: 1,
                  borderRightColor: palette.paperMuted,
                },
              ]}
            >
              {/* Search Bar */}
              <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, gap: 8 }}>
                <View
                  style={[
                    styles.searchBox,
                    { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                  ]}
                >
                  <AppIcon name="search" size={16} color={palette.inkMuted} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Tìm hội thoại, tên bạn bè hoặc nội dung tin nhắn..."
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.searchInput, { color: palette.ink }]}
                  />
                  {searchQuery.length > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setSearchQuery('')}>
                      <AppIcon name="close-circle" size={17} color={palette.inkMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Inbox Category Tabs */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                >
                  {(
                    [
                      { id: 'inbox', label: 'Hộp thư' },
                      {
                        id: 'requests',
                        label: `Tin nhắn chờ${requestCount > 0 ? ` (${requestCount})` : ''}`,
                      },
                      { id: 'live', label: 'Phòng thảo luận' },
                      { id: 'archived', label: 'Đã lưu trữ' },
                    ] as const
                  ).map((tb) => {
                    const active = inboxTab === tb.id;
                    return (
                      <Pressable
                        key={tb.id}
                        onPress={() => setInboxTab(tb.id)}
                        style={[
                          styles.tabChip,
                          {
                            backgroundColor: active ? palette.indigo : palette.paperRaised,
                            borderColor: active ? palette.indigo : palette.paperMuted,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: active ? '#FFFFFF' : palette.ink,
                          }}
                        >
                          {tb.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Conversation Rows */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing.sm, gap: 6 }}
              >
                {filteredConversations.length === 0 ? (
                  <Card style={{ alignItems: 'center', gap: 8, paddingVertical: spacing.lg }}>
                    <AppIcon name="chatbubbles-outline" size={28} color={palette.inkMuted} />
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                      Chưa có cuộc trò chuyện nào trong mục này
                    </Text>
                    <Text
                      style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}
                    >
                      Bắt đầu nhắn tin với bạn bè hoặc tạo nhóm học tập mới ngay.
                    </Text>
                  </Card>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = activeConversation?.id === conv.id && isSplitDesktop;
                    const unread = conv.unreadByUserIds[viewerId] ?? 0;
                    const convPeer = conv.peerUserId ? profilesById[conv.peerUserId] : undefined;
                    return (
                      <Pressable
                        key={conv.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedConvId(conv.id);
                          setMobileRoomOpen(true);
                          markConversationRead(conv.id, viewerId);
                        }}
                        style={[
                          styles.convItem,
                          {
                            backgroundColor: isSelected ? palette.indigoTint : palette.paper,
                            borderColor: isSelected ? palette.indigo : palette.paperMuted,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.convAvatar,
                            { backgroundColor: conv.accentColor || palette.indigo },
                          ]}
                        >
                          {conv.avatarUrl ? (
                            <Image source={{ uri: conv.avatarUrl }} style={styles.convAvatarImg} />
                          ) : (
                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>
                              {conv.kind === 'group'
                                ? '👥'
                                : conv.kind === 'live_room'
                                ? '🔴'
                                : (conv.title[0] || 'P').toUpperCase()}
                            </Text>
                          )}
                          {convPeer?.isOnline && convPeer.privacy.showOnlineStatus ? (
                            <View style={styles.onlineDot} />
                          ) : null}
                        </View>

                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            {conv.isPinned ? (
                              <AppIcon name="pin" size={12} color={palette.gold} />
                            ) : null}
                            <Text
                              style={{
                                fontSize: 13.5,
                                fontWeight: unread > 0 ? '900' : '800',
                                color: palette.ink,
                                flex: 1,
                              }}
                              numberOfLines={1}
                            >
                              {conv.title}
                            </Text>
                            {conv.isMuted ? (
                              <AppIcon name="volume-mute" size={13} color={palette.inkMuted} />
                            ) : null}
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: unread > 0 ? palette.ink : palette.inkMuted,
                              fontWeight: unread > 0 ? '700' : '500',
                            }}
                            numberOfLines={1}
                          >
                            {conv.lastMessagePreview || conv.subtitle}
                          </Text>
                        </View>

                        {unread > 0 ? (
                          <View style={[styles.unreadBadge, { backgroundColor: palette.danger }]}>
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                              {unread}
                            </Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : null}

          {/* RIGHT PANE: ACTIVE CONVERSATION ROOM */}
          {showActiveChatPane && activeConversation ? (
            <View style={styles.rightPane}>
              {/* Room Header */}
              <View
                style={[
                  styles.roomHeader,
                  { backgroundColor: palette.paper, borderBottomColor: palette.paperMuted },
                ]}
              >
                {!isSplitDesktop ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Quay lại danh sách hội thoại"
                    onPress={() => setMobileRoomOpen(false)}
                    style={{ padding: 4 }}
                  >
                    <AppIcon name="arrow-back" size={20} color={palette.ink} />
                  </Pressable>
                ) : null}

                <Pressable
                  disabled={!activeConversation.peerUserId}
                  onPress={() => {
                    if (activeConversation.peerUserId) {
                      router.push({
                        pathname: '/user/[userId]',
                        params: { userId: activeConversation.peerUserId },
                      });
                    }
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Text style={{ fontSize: 14.5, fontWeight: '900', color: palette.ink }} numberOfLines={1}>
                    {activeConversation.title}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: palette.inkMuted }} numberOfLines={1}>
                    {peerProfile
                      ? peerProfile.isOnline && peerProfile.privacy.showOnlineStatus
                        ? '🟢 Đang hoạt động · Chạm để xem hồ sơ'
                        : `${peerProfile.major || 'Thành viên Papyrus'} · Chạm để xem hồ sơ`
                      : activeConversation.subtitle}
                  </Text>
                </Pressable>

                {/* Conversation Quick Controls: Pin, Mute, Archive */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ghim hội thoại"
                    onPress={() => {
                      togglePinOrMuteConversation(activeConversation.id, 'isPinned');
                      showToast(
                        activeConversation.isPinned ? 'Đã bỏ ghim hội thoại' : 'Đã ghim hội thoại lên đầu'
                      );
                    }}
                    style={[styles.iconCircle, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon
                      name={activeConversation.isPinned ? 'pin' : 'pin-outline'}
                      size={16}
                      color={activeConversation.isPinned ? palette.gold : palette.inkMuted}
                    />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tắt thông báo hội thoại"
                    onPress={() => {
                      togglePinOrMuteConversation(activeConversation.id, 'isMuted');
                      showToast(
                        activeConversation.isMuted
                          ? 'Đã bật lại thông báo hội thoại'
                          : 'Đã tắt tiếng thông báo hội thoại'
                      );
                    }}
                    style={[styles.iconCircle, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon
                      name={activeConversation.isMuted ? 'notifications-off' : 'notifications-outline'}
                      size={16}
                      color={palette.inkMuted}
                    />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lưu trữ hội thoại"
                    onPress={() => {
                      acceptOrArchiveConversation(
                        activeConversation.id,
                        activeConversation.requestState === 'archived' ? 'accepted' : 'archived'
                      );
                      showToast(
                        activeConversation.requestState === 'archived'
                          ? 'Đã đưa hội thoại về Hộp thư chính'
                          : 'Đã chuyển hội thoại vào Lưu trữ'
                      );
                    }}
                    style={[styles.iconCircle, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon name="archive-outline" size={16} color={palette.inkMuted} />
                  </Pressable>
                </View>
              </View>

              {/* Message Request Banner */}
              {activeConversation.requestState === 'pending' ? (
                <View
                  style={[
                    styles.requestBanner,
                    { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.ink }}>
                      📩 Tin nhắn chờ từ người chưa kết bạn
                    </Text>
                    <Text style={{ fontSize: 11.5, color: palette.inkMuted }}>
                      Chấp nhận để chuyển vào Hộp thư chính và bật trạng thái Đã xem.
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    onPress={() => {
                      acceptOrArchiveConversation(activeConversation.id, 'accepted');
                      setInboxTab('inbox');
                      showToast('Đã chấp nhận tin nhắn chờ!');
                    }}
                  >
                    Chấp nhận
                  </Button>
                </View>
              ) : null}

              {/* Announcement / Pinned Message Strip */}
              {pinnedMsg || activeConversation.announcement ? (
                <View
                  style={[
                    styles.pinnedStrip,
                    { backgroundColor: palette.paperRaised, borderBottomColor: palette.paperMuted },
                  ]}
                >
                  <AppIcon name="megaphone-outline" size={15} color={palette.indigo} />
                  <Text
                    style={{ fontSize: 12, color: palette.ink, fontWeight: '700', flex: 1 }}
                    numberOfLines={1}
                  >
                    {pinnedMsg
                      ? `📌 Tin ghim (${pinnedMsg.senderName}): ${pinnedMsg.text}`
                      : activeConversation.announcement}
                  </Text>
                  {pinnedMsg ? (
                    <Pressable onPress={() => pinChatMessage(activeConversation.id, null)}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>
                        Bỏ ghim
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Messages Stream */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing.md, gap: 12 }}
              >
                {activeMessages.map((msg) => {
                  const isMine = msg.senderId === viewerId;
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgRow,
                        { justifyContent: isMine ? 'flex-end' : 'flex-start' },
                      ]}
                    >
                      {!isMine ? (
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: '/user/[userId]',
                              params: { userId: msg.senderId },
                            })
                          }
                          style={[styles.msgAvatar, { backgroundColor: palette.indigo }]}
                        >
                          {msg.senderAvatar ? (
                            <Image source={{ uri: msg.senderAvatar }} style={styles.msgAvatarImg} />
                          ) : (
                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>
                              {(msg.senderName[0] || 'P').toUpperCase()}
                            </Text>
                          )}
                        </Pressable>
                      ) : null}

                      <View
                        style={[
                          styles.msgBubble,
                          {
                            backgroundColor: isMine ? palette.indigoTint : palette.paper,
                            borderColor: isMine ? palette.indigoBorder : palette.paperMuted,
                          },
                        ]}
                      >
                        {/* Sender Name */}
                        <View style={styles.msgMetaTop}>
                          <Pressable
                            onPress={() =>
                              router.push({
                                pathname: '/user/[userId]',
                                params: { userId: msg.senderId },
                              })
                            }
                          >
                            <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                              {msg.senderName}
                            </Text>
                          </Pressable>
                          {msg.forwardedFromName ? (
                            <Badge tone="neutral">↪ Chuyển tiếp</Badge>
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Tùy chọn tin nhắn"
                            hitSlop={8}
                            onPress={() => setActiveMessageMenu(msg)}
                            style={{ marginLeft: 'auto' }}
                          >
                            <AppIcon name="ellipsis-horizontal" size={16} color={palette.inkMuted} />
                          </Pressable>
                        </View>

                        {/* Reply Quote Context */}
                        {msg.replyTo ? (
                          <View
                            style={[
                              styles.replyQuoteBox,
                              { borderLeftColor: palette.indigo, backgroundColor: palette.paperRaised },
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: palette.indigo }}>
                              Trả lời {msg.replyTo.senderName}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: palette.inkMuted }} numberOfLines={1}>
                              {msg.replyTo.preview}
                            </Text>
                          </View>
                        ) : null}

                        {/* Inline Edit Mode vs Message Content */}
                        {editingMessageId === msg.id ? (
                          <View style={{ gap: 6, marginTop: 4 }}>
                            <TextInput
                              value={editingText}
                              onChangeText={setEditingText}
                              multiline
                              style={[
                                styles.editInput,
                                {
                                  color: palette.ink,
                                  borderColor: palette.indigo,
                                  backgroundColor: palette.paperRaised,
                                },
                              ]}
                            />
                            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
                              <Button
                                size="sm"
                                variant="secondary"
                                onPress={() => setEditingMessageId(null)}
                              >
                                Hủy
                              </Button>
                              <Button
                                size="sm"
                                onPress={() => {
                                  if (editingText.trim()) {
                                    editOrRecallChatMessage(msg.id, viewerId, 'edit', editingText);
                                    setEditingMessageId(null);
                                  }
                                }}
                              >
                                Lưu
                              </Button>
                            </View>
                          </View>
                        ) : (
                          <>
                            {msg.text ? (
                              <Text
                                style={[
                                  typography.body,
                                  {
                                    color: msg.isRecalled ? palette.inkMuted : palette.ink,
                                    fontStyle: msg.isRecalled ? 'italic' : 'normal',
                                    fontSize: 13.5,
                                    lineHeight: 20,
                                  },
                                ]}
                              >
                                {msg.text}
                              </Text>
                            ) : null}

                            {/* Media Attachments (Photos, Video with Cover, GIF/Sticker, Voice) */}
                            {!msg.isRecalled && msg.mediaAttachments.length > 0 ? (
                              <View style={styles.mediaGrid}>
                                {msg.mediaAttachments.map((att) =>
                                  att.kind === 'audio' ? (
                                    <View
                                      key={att.id}
                                      style={[
                                        styles.audioPill,
                                        { backgroundColor: palette.paperRaised },
                                      ]}
                                    >
                                      <AppIcon name="mic" size={16} color={palette.indigo} />
                                      <Text
                                        style={{
                                          fontSize: 12,
                                          fontWeight: '700',
                                          color: palette.ink,
                                        }}
                                      >
                                        Tin nhắn thoại ({att.durationSec ?? 8}s)
                                      </Text>
                                    </View>
                                  ) : (
                                    <View key={att.id} style={styles.chatImgWrap}>
                                      <Image
                                        source={{ uri: att.thumbnailUri || att.uri }}
                                        style={
                                          att.kind === 'sticker'
                                            ? styles.chatStickerImg
                                            : styles.chatPhotoImg
                                        }
                                        resizeMode={att.kind === 'sticker' ? 'contain' : 'cover'}
                                      />
                                      {att.kind === 'video' ? (
                                        <View style={styles.vidOverlayBadge}>
                                          <AppIcon name="play" size={13} color="#FFF" />
                                          <Text
                                            style={{ color: '#FFF', fontSize: 10.5, fontWeight: '800' }}
                                          >
                                            Video
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  )
                                )}
                              </View>
                            ) : null}

                            {/* Permission-Aware Embedded SharedPostCard (Section 8.5 & 9.2) */}
                            {!msg.isRecalled && msg.sharedPost ? (
                              <SharedPostCard reference={msg.sharedPost} viewerId={viewerId} />
                            ) : null}

                            {/* Unified Zalo-Style Poll (Section 9.4) */}
                            {!msg.isRecalled && msg.poll ? (
                              <UnifiedZaloPollCard
                                poll={msg.poll}
                                viewerId={viewerId}
                                viewerName={viewerName}
                                profilesById={profilesById}
                                onVote={(optionId) =>
                                  voteUnifiedPoll('message', msg.id, optionId, viewerId)
                                }
                                onAddOption={(text) =>
                                  addUnifiedPollOption('message', msg.id, text, {
                                    id: viewerId,
                                    name: viewerName,
                                  })
                                }
                                onToggleClose={() =>
                                  toggleCloseUnifiedPoll('message', msg.id, viewerId)
                                }
                              />
                            ) : null}
                          </>
                        )}

                        {/* Quick Emoji Reactions & Read Receipt Footer */}
                        {!msg.isRecalled ? (
                          <View style={styles.msgBottomBar}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                              {(['❤️', '🔥', '👍', '😂'] as const).map((emo) => {
                                const reactors = msg.reactions[emo] ?? [];
                                const active = reactors.includes(viewerId);
                                return (
                                  <Pressable
                                    key={emo}
                                    onPress={() =>
                                      toggleChatMessageReaction(msg.id, emo, viewerId)
                                    }
                                    style={[
                                      styles.reactChip,
                                      {
                                        backgroundColor: active
                                          ? palette.indigo
                                          : palette.paperRaised,
                                      },
                                    ]}
                                  >
                                    <Text style={{ fontSize: 11.5 }}>{emo}</Text>
                                    {reactors.length > 0 ? (
                                      <Text
                                        style={{
                                          fontSize: 10.5,
                                          fontWeight: '800',
                                          color: active ? '#FFF' : palette.inkMuted,
                                        }}
                                      >
                                        {reactors.length}
                                      </Text>
                                    ) : null}
                                  </Pressable>
                                );
                              })}
                            </View>

                            <Text style={{ fontSize: 10.5, color: palette.inkMuted }}>
                              {msg.isEdited ? 'Đã sửa · ' : ''}
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {isMine
                                ? msg.readByIds.length > 1 || msg.deliveryStatus === 'read'
                                  ? ' · ✓✓ Đã xem'
                                  : ' · ✓ Đã gửi'
                                : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Composer Area */}
              <View
                style={[
                  styles.composerWrap,
                  { backgroundColor: palette.paper, borderTopColor: palette.paperMuted },
                ]}
              >
                {replyTarget ? (
                  <View
                    style={[
                      styles.replyBanner,
                      { backgroundColor: palette.paperRaised, borderColor: palette.indigoBorder },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>
                        Đang trả lời {replyTarget.senderName}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: palette.inkMuted }} numberOfLines={1}>
                        {replyTarget.preview}
                      </Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="Hủy trả lời tin nhắn" onPress={() => setReplyTarget(null)}>
                      <AppIcon name="close-circle" size={18} color={palette.inkMuted} />
                    </Pressable>
                  </View>
                ) : null}

                {pendingAttachments.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
                  >
                    {pendingAttachments.map((att) => (
                      <View key={att.id} style={styles.pendingThumbWrap}>
                        <Image
                          source={{ uri: att.thumbnailUri || att.uri }}
                          style={styles.pendingThumb}
                        />
                        {att.kind === 'video' ? (
                          <Pressable
                            onPress={() => setEditingVideoCover(att)}
                            style={styles.editVidCoverChip}
                          >
                            <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '800' }}>
                              Ảnh bìa
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Đóng"
                          onPress={() =>
                            setPendingAttachments((prev) => prev.filter((x) => x.id !== att.id))
                          }
                          style={styles.removePendingBtn}
                        >
                          <AppIcon name="close" size={12} color="#FFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                {/* Rich Attachment Toolbar */}
                <View style={styles.attachToolbar}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gửi ảnh"
                    onPress={() => void handlePickPhotos()}
                    style={[styles.toolChip, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon name="images-outline" size={16} color={palette.indigo} />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                      Ảnh
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gửi video kèm ảnh bìa"
                    onPress={() => void handlePickVideo()}
                    style={[styles.toolChip, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon name="videocam-outline" size={16} color="#E11D48" />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                      Video
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mở thư viện Sticker GIF Emoji"
                    onPress={() => setStickerOpen(true)}
                    style={[styles.toolChip, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon name="happy-outline" size={16} color={palette.gold} />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                      Sticker · GIF
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tạo bình chọn Zalo"
                    onPress={() => setPollModalOpen(true)}
                    style={[styles.toolChip, { backgroundColor: palette.paperRaised }]}
                  >
                    <AppIcon name="stats-chart-outline" size={15} color={palette.mint} />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>
                      Bình chọn
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ghi âm tin nhắn thoại"
                    onPress={handleToggleVoiceNote}
                    style={[
                      styles.toolChip,
                      {
                        backgroundColor: recordingVoice ? palette.danger : palette.paperRaised,
                      },
                    ]}
                  >
                    <AppIcon
                      name={recordingVoice ? 'stop-circle' : 'mic-outline'}
                      size={16}
                      color={recordingVoice ? '#FFFFFF' : palette.indigo}
                    />
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '700',
                        color: recordingVoice ? '#FFFFFF' : palette.ink,
                      }}
                    >
                      {recordingVoice ? 'Bấm để gửi (0:08)' : 'Thoại'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    value={draftText}
                    onChangeText={setDraftText}
                    placeholder={`Nhắn tin tới ${activeConversation.title}...`}
                    placeholderTextColor={palette.inkMuted}
                    multiline
                    style={[
                      styles.msgInput,
                      {
                        color: palette.ink,
                        backgroundColor: palette.paperRaised,
                        borderColor: palette.paperMuted,
                      },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gửi tin nhắn"
                    onPress={handleSend}
                    style={[
                      styles.sendBtn,
                      {
                        backgroundColor:
                          draftText.trim() || pendingAttachments.length > 0
                            ? palette.indigo
                            : palette.paperMuted,
                      },
                    ]}
                  >
                    <AppIcon name="send" size={17} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* Message Context Menu Modal (Reply, Forward, Copy, Pin, Edit, Recall/Unsend, Report) */}
      {activeMessageMenu ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMessageMenu(null)}
        >
          <Pressable
            onPress={() => setActiveMessageMenu(null)}
            style={styles.modalBackdrop}
          >
            <Card style={[styles.menuSheet, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>Tùy chọn tin nhắn</Text>

              <Pressable
                onPress={() => {
                  setReplyTarget({
                    id: activeMessageMenu.id,
                    senderName: activeMessageMenu.senderName,
                    preview: activeMessageMenu.text || 'Đính kèm phương tiện',
                  });
                  setActiveMessageMenu(null);
                }}
                style={styles.menuRow}
              >
                <AppIcon name="arrow-undo-outline" size={18} color={palette.indigo} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.ink }}>
                  Trả lời tin nhắn này
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setForwardingMessage(activeMessageMenu);
                  setActiveMessageMenu(null);
                }}
                style={styles.menuRow}
              >
                <AppIcon name="arrow-redo-outline" size={18} color={palette.indigo} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.ink }}>
                  Chuyển tiếp tới hội thoại khác
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (Platform.OS === 'web' && navigator?.clipboard) {
                    void navigator.clipboard.writeText(activeMessageMenu.text);
                  }
                  showToast('Đã sao chép nội dung tin nhắn!');
                  setActiveMessageMenu(null);
                }}
                style={styles.menuRow}
              >
                <AppIcon name="copy-outline" size={18} color={palette.ink} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.ink }}>
                  Sao chép văn bản
                </Text>
              </Pressable>

              {activeConversation ? (
                <Pressable
                  onPress={() => {
                    pinChatMessage(activeConversation.id, activeMessageMenu.id);
                    showToast('Đã ghim tin nhắn lên đầu phòng chat!');
                    setActiveMessageMenu(null);
                  }}
                  style={styles.menuRow}
                >
                  <AppIcon name="pin-outline" size={18} color={palette.gold} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.ink }}>
                    Ghim tin nhắn trong hội thoại
                  </Text>
                </Pressable>
              ) : null}

              {activeMessageMenu.senderId === viewerId && !activeMessageMenu.isRecalled ? (
                <>
                  <Pressable
                    onPress={() => {
                      setEditingMessageId(activeMessageMenu.id);
                      setEditingText(activeMessageMenu.text);
                      setActiveMessageMenu(null);
                    }}
                    style={styles.menuRow}
                  >
                    <AppIcon name="create-outline" size={18} color={palette.indigo} />
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: palette.ink }}>
                      Chỉnh sửa tin nhắn
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      editOrRecallChatMessage(activeMessageMenu.id, viewerId, 'recall');
                      showToast('Đã thu hồi tin nhắn với mọi thành viên!');
                      setActiveMessageMenu(null);
                    }}
                    style={styles.menuRow}
                  >
                    <AppIcon name="refresh-circle-outline" size={18} color={palette.danger} />
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.danger }}>
                      Thu hồi tin nhắn (Unsend)
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => {
                    submitModerationReport({
                      reporterId: viewerId,
                      reporterName: viewerName,
                      targetType: 'message',
                      targetId: activeMessageMenu.id,
                      targetPreview: activeMessageMenu.text.slice(0, 180),
                      targetOwnerId: activeMessageMenu.senderId,
                      reason: 'Tin nhắn vi phạm tiêu chuẩn cộng đồng',
                      details: `Báo cáo từ hội thoại ${activeConversation?.title || ''}`,
                    });
                    showToast('Đã gửi báo cáo tin nhắn tới bộ phận Kiểm duyệt!');
                    setActiveMessageMenu(null);
                  }}
                  style={styles.menuRow}
                >
                  <AppIcon name="flag-outline" size={18} color={palette.danger} />
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: palette.danger }}>
                    Báo cáo tin nhắn vi phạm
                  </Text>
                </Pressable>
              )}
            </Card>
          </Pressable>
        </Modal>
      ) : null}

      {/* Forward Message Sheet */}
      {forwardingMessage ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setForwardingMessage(null)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.menuSheet, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                ↪ Chuyển tiếp tin nhắn tới
              </Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {conversations.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      sendChatMessage({
                        conversationId: c.id,
                        senderId: viewerId,
                        senderName: viewerName,
                        senderAvatar: viewerAvatar,
                        text: forwardingMessage.text,
                        mediaAttachments: forwardingMessage.mediaAttachments,
                        sharedPost: forwardingMessage.sharedPost,
                        forwardedFromName: forwardingMessage.senderName,
                      });
                      setForwardingMessage(null);
                      showToast(`Đã chuyển tiếp tới «${c.title}»!`);
                    }}
                    style={styles.menuRow}
                  >
                    <AppIcon name="chatbubble-ellipses-outline" size={17} color={palette.indigo} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>
                      {c.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Button variant="secondary" onPress={() => setForwardingMessage(null)}>
                Đóng
              </Button>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Create Group Conversation Modal */}
      {createGroupOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setCreateGroupOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.menuSheet, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                Tạo nhóm trò chuyện
              </Text>
              <TextInput
                value={groupTitle}
                onChangeText={setGroupTitle}
                placeholder="Tên nhóm..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.modalInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <TextInput
                value={groupTopic}
                onChangeText={setGroupTopic}
                placeholder="Mô tả nhóm..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.modalInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              <Text style={{ fontSize: 12, fontWeight: '800', color: palette.ink }}>
                Mời thành viên vào nhóm:
              </Text>
              <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 6 }}>
                {candidateProfiles.map((prof) => {
                  const picked = selectedMemberIds.includes(prof.id);
                  return (
                    <Pressable
                      key={prof.id}
                      onPress={() =>
                        setSelectedMemberIds((prev) =>
                          prev.includes(prof.id)
                            ? prev.filter((x) => x !== prof.id)
                            : [...prev, prof.id]
                        )
                      }
                      style={[
                        styles.memberPickRow,
                        {
                          borderColor: picked ? palette.indigo : palette.paperMuted,
                          backgroundColor: picked ? palette.indigoTint : palette.paperRaised,
                        },
                      ]}
                    >
                      <AppIcon
                        name={picked ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={picked ? palette.indigo : palette.inkMuted}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }}>
                          {prof.displayName}
                        </Text>
                        <Text style={{ fontSize: 11, color: palette.inkMuted }} numberOfLines={1}>
                          {[prof.major, prof.university, prof.locationArea]
                            .filter(Boolean)
                            .join(' · ') || prof.bio}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setCreateGroupOpen(false)}>
                  Hủy
                </Button>
                <Button
                  disabled={!groupTitle.trim()}
                  onPress={() => {
                    const created = createGroupConversation({
                      creatorId: viewerId,
                      title: groupTitle.trim(),
                      topic: groupTopic.trim(),
                      memberIds: selectedMemberIds,
                    });
                    if (!created) return;
                    setGroupTitle('');
                    setSelectedMemberIds([]);
                    setCreateGroupOpen(false);
                    setInboxTab('inbox');
                    setSelectedConvId(created.id);
                    setMobileRoomOpen(true);
                    showToast(`Đã tạo nhóm ${created.title}.`);
                  }}
                >
                  Tạo nhóm
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Poll Builder Modal */}
      {pollModalOpen ? (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setPollModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={[styles.menuSheet, { backgroundColor: palette.paper }]}>
              <Text style={[typography.title, { color: palette.ink }]}>
                Tạo khảo sát
              </Text>
              <TextInput
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="Đặt câu hỏi bình chọn cho cả phòng..."
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.modalInput,
                  {
                    color: palette.ink,
                    borderColor: palette.paperMuted,
                    backgroundColor: palette.paperRaised,
                  },
                ]}
              />
              {pollOptions.map((opt, idx) => (
                <TextInput
                  key={idx}
                  value={opt}
                  onChangeText={(txt) =>
                    setPollOptions((prev) => prev.map((v, i) => (i === idx ? txt : v)))
                  }
                  placeholder={`Phương án ${idx + 1}...`}
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.modalInput,
                    {
                      color: palette.ink,
                      borderColor: palette.paperMuted,
                      backgroundColor: palette.paperRaised,
                    },
                  ]}
                />
              ))}
              {pollOptions.length < 6 ? (
                <Pressable
                  onPress={() => setPollOptions((prev) => [...prev, ''])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <AppIcon name="add-circle-outline" size={16} color={palette.indigo} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                    + Thêm phương án
                  </Text>
                </Pressable>
              ) : null}

              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => setPollAllowMultiple((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <AppIcon
                    name={pollAllowMultiple ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={palette.indigo}
                  />
                  <Text style={{ fontSize: 12.5, color: palette.ink, fontWeight: '700' }}>
                    Cho phép chọn nhiều phương án
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPollIsAnonymous((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <AppIcon
                    name={pollIsAnonymous ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={palette.indigo}
                  />
                  <Text style={{ fontSize: 12.5, color: palette.ink, fontWeight: '700' }}>
                    Bình chọn ẩn danh
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPollAllowAddOptions((v) => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <AppIcon
                    name={pollAllowAddOptions ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={palette.indigo}
                  />
                  <Text style={{ fontSize: 12.5, color: palette.ink, fontWeight: '700' }}>
                    Cho phép thành viên thêm phương án mới
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setPollModalOpen(false)}>
                  Hủy
                </Button>
                <Button onPress={handlePublishPollInChat}>Đăng bình chọn</Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      <GifStickerEmojiPickerModal
        visible={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onSelectEmoji={(emo) => setDraftText((prev) => `${prev}${emo}`)}
        onSelectMedia={(media) => {
          if (!activeConversation) return;
          sendChatMessage({
            conversationId: activeConversation.id,
            senderId: viewerId,
            senderName: viewerName,
            senderAvatar: viewerAvatar,
            text: '',
            mediaAttachments: [media],
            replyTo: replyTarget,
          });
          setReplyTarget(null);
        }}
      />

      <VideoCoverEditorModal
        visible={Boolean(editingVideoCover)}
        videoUri={editingVideoCover?.uri ?? null}
        initialThumbnailUri={editingVideoCover?.thumbnailUri}
        defaultAspect="16:9"
        onClose={() => setEditingVideoCover(null)}
        onApplyCover={(res) => {
          if (!editingVideoCover) return;
          setPendingAttachments((prev) =>
            prev.map((att) =>
              att.id === editingVideoCover.id
                ? {
                    ...att,
                    thumbnailUri: res.thumbnailUri,
                    coverTimestampSec: res.coverTimestampSec,
                    aspectRatio: res.aspectRatio,
                  }
                : att
            )
          );
          setEditingVideoCover(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  mainBody: { flex: 1 },
  mainBodySplit: { flexDirection: 'row' },
  leftPane: { flex: 1 },
  rightPane: { flex: 1, minWidth: 0 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 6 },
  tabChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  convAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  pinnedStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  msgAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  msgBubble: {
    maxWidth: '84%',
    minWidth: 180,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  msgMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 2,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 8,
    fontSize: 13,
    minHeight: 54,
  },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chatImgWrap: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  chatPhotoImg: { width: 190, height: 136, borderRadius: radii.sm },
  chatStickerImg: { width: 108, height: 108 },
  vidOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  msgBottomBar: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pendingThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  pendingThumb: { width: '100%', height: '100%' },
  editVidCoverChip: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: 4,
  },
  removePendingBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13.5,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  menuSheet: { width: '100%', maxWidth: 460, gap: 10 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  modalInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  memberPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
});
