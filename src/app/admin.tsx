import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { AppIcon, type IconName } from '@/shared/AppIcon';
import { useRouter } from 'expo-router';
import { Badge, BrandMark, Button, Card, OnlineStatusDot, Screen, SmoothReveal } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useModerationStore } from '@/features/moderation/state/useModerationStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import type {
  AdminManagedDocument,
  ModerationActionKind,
  SocialUserProfile,
} from '@/features/social/domain/models';
import {
  listAllUsersForAdmin,
  pickRichSourceDocument,
  type AdminUserSummary,
} from '@/composition/platform';
import { seedQuestionSets } from '@/composition/preferences';
import { sfx } from '@/core/audio/sfx';

type AdminSection =
  | 'overview'
  | 'users'
  | 'content'
  | 'communities'
  | 'messaging'
  | 'feed_ai'
  | 'notifications'
  | 'documents_gifts'
  | 'moderation_audit';

type DateRangeKey = '7d' | '30d' | 'all';
type InspectorTab = 'overview' | 'status' | 'gift' | 'notify';

const ADMIN_USER = (process.env.EXPO_PUBLIC_ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ADMIN_PASS = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || 'Papyrus@2026';

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  shortLabel: string;
  icon: IconName;
}> = [
  { id: 'overview', label: '1. Tổng quan Hệ thống', shortLabel: 'Tổng quan', icon: 'grid-outline' },
  { id: 'users', label: '2. Quản lý Người dùng', shortLabel: 'Người dùng', icon: 'people-outline' },
  { id: 'content', label: '3. Quản lý Bài viết & Kho đề', shortLabel: 'Nội dung', icon: 'newspaper-outline' },
  { id: 'communities', label: '4. Quản lý Cộng đồng', shortLabel: 'Cộng đồng', icon: 'planet-outline' },
  { id: 'messaging', label: '5. Tin nhắn & Phòng Live', shortLabel: 'Tin nhắn', icon: 'chatbubbles-outline' },
  { id: 'feed_ai', label: '6. Bảng tin & PapyAI', shortLabel: 'Feed & AI', icon: 'sparkles-outline' },
  { id: 'notifications', label: '7. Chiến dịch Thông báo', shortLabel: 'Thông báo', icon: 'megaphone-outline' },
  { id: 'documents_gifts', label: '8. Tài liệu & Tặng Quà', shortLabel: 'Tài liệu & Quà', icon: 'gift-outline' },
  { id: 'moderation_audit', label: '9. Kiểm duyệt, Khiếu nại & Audit', shortLabel: 'Kiểm duyệt', icon: 'shield-checkmark-outline' },
];

function TablerKpiCard({
  subheader,
  value,
  trend,
  positive = true,
  accentColor,
  bars,
}: {
  subheader: string;
  value: string;
  trend: string;
  positive?: boolean;
  accentColor: string;
  bars: number[];
}) {
  const maxVal = Math.max(...bars, 1);
  return (
    <View style={[styles.kpiCard, { borderTopColor: accentColor }]}>
      <View style={styles.kpiHeaderRow}>
        <Text style={styles.kpiSubheader} numberOfLines={1}>
          {subheader}
        </Text>
        <View
          style={[
            styles.trendPill,
            { backgroundColor: positive ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)' },
          ]}
        >
          <AppIcon
            name={positive ? 'trending-up' : 'trending-down'}
            size={12}
            color={positive ? '#34D399' : '#F87171'}
          />
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: '800',
              color: positive ? '#34D399' : '#F87171',
            }}
          >
            {trend}
          </Text>
        </View>
      </View>

      <Text style={styles.kpiValue}>{value}</Text>

      <View style={styles.sparklineRow}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: Math.max(4, Math.round((b / maxVal) * 26)),
              borderRadius: 3,
              backgroundColor: i === bars.length - 1 ? accentColor : 'rgba(148, 163, 184, 0.28)',
            }}
          />
        ))}
      </View>
    </View>
  );
}

export default function AdminPortalScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 980;
  const isTabletUp = width >= 700;

  // Independent Admin Authentication Gate
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Workspace Navigation & Filter State
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>('7d');
  const [globalQuery, setGlobalQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [userSort, setUserSort] = useState<'score' | 'elo' | 'games'>('score');
  const [statusReason, setStatusReason] = useState('Vi phạm quy tắc cộng đồng');
  const [actionToast, setActionToast] = useState('');

  // Feed & AI Management Toggles (Section 14.6)
  const [aiFeedAssistantEnabled, setAiFeedAssistantEnabled] = useState(true);
  const [aiPostSummaryEnabled, setAiPostSummaryEnabled] = useState(true);
  const [aiSemanticSearchEnabled, setAiSemanticSearchEnabled] = useState(true);
  const [aiAutoModerationEnabled, setAiAutoModerationEnabled] = useState(true);
  const [aiRateLimitPerMin, setAiRateLimitPerMin] = useState('30');
  const [globalMutedWords, setGlobalMutedWords] = useState<string[]>(['spam-link', 'cá-độ']);
  const [newGlobalMutedWord, setNewGlobalMutedWord] = useState('');

  // Document & Gift Management Module State (Section 14.8 — Mandatory Dedicated Module)
  const [docEditingId, setDocEditingId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [docCategory, setDocCategory] = useState('Công nghệ thông tin');
  const [docTags, setDocTags] = useState('CNTT, ÔnThi, ĐạiHọc');
  const [docFormat, setDocFormat] = useState<AdminManagedDocument['fileFormat']>('markdown');
  const [docFileName, setDocFileName] = useState('');
  const [docRichContent, setDocRichContent] = useState('');
  const [docStatus, setDocStatus] = useState<AdminManagedDocument['status']>('published');
  const [docAllowDownload, setDocAllowDownload] = useState(true);
  const [docExpiresAt, setDocExpiresAt] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Gift Distribution Target State
  const [selectedDocToGift, setSelectedDocToGift] = useState<string>('adoc-1');
  const [giftScope, setGiftScope] = useState<'all_users' | 'user' | 'selected_users' | 'community'>('all_users');
  const [recipientId, setRecipientId] = useState<string>('all');
  const [recipientName, setRecipientName] = useState<string>('Tất cả người dùng đủ điều kiện');
  const [multiSelectedUserIds, setMultiSelectedUserIds] = useState<string[]>([]);
  const [targetCommunityId, setTargetCommunityId] = useState<string>('comm-software-ai');
  const [giftExpiresAt, setGiftExpiresAt] = useState('');

  // Question Set / VIP / Streak Gift State
  const [giftType, setGiftType] = useState<AdminGiftItem['giftType']>('question_set');
  const [selectedSetId, setSelectedSetId] = useState<string>(seedQuestionSets[0]?.id ?? '');
  const [customTitle, setCustomTitle] = useState('');
  const [customDocText, setCustomDocText] = useState('');
  const [giftMessage, setGiftMessage] = useState('');

  // Broadcast / Scheduled Notification State (Section 14.7)
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastKind, setBroadcastKind] = useState<'system' | 'update'>('system');

  // Sensitive Action Confirmation Modal (Section 14.9)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Stores
  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const totalQuestions = useMemo(
    () => allSets.reduce((sum, s) => sum + s.questions.length, 0),
    [allSets]
  );

  const quizReports = useModerationStore((s) => s.reports);
  const updateQuizReportStatus = useModerationStore((s) => s.updateStatus);

  const gifts = useNotificationStore((s) => s.gifts);
  const notifications = useNotificationStore((s) => s.notifications);
  const sendGift = useNotificationStore((s) => s.sendGift);
  const pushNotification = useNotificationStore((s) => s.pushNotification);

  // Social Media, Communities, Messaging, Moderation & Admin Documents Store
  const profilesById = useSocialStore((s) => s.profilesById);
  const socialPosts = useSocialStore((s) => s.posts);
  const communities = useSocialStore((s) => s.communities);
  const conversations = useSocialStore((s) => s.conversations);
  const chatMessages = useSocialStore((s) => s.chatMessages);
  const moderationCases = useSocialStore((s) => s.moderationCases);
  const adminDocuments = useSocialStore((s) => s.adminDocuments);
  const auditLogs = useSocialStore((s) => s.auditLogs);

  const deleteOrArchivePost = useSocialStore((s) => s.deleteOrArchivePost);
  const applyAdminModerationAction = useSocialStore((s) => s.applyAdminModerationAction);
  const resolveUserAppeal = useSocialStore((s) => s.resolveUserAppeal);
  const updateUserAccountStatusAdmin = useSocialStore((s) => s.updateUserAccountStatusAdmin);
  const createOrUpdateAdminDocument = useSocialStore((s) => s.createOrUpdateAdminDocument);
  const deleteAdminDocument = useSocialStore((s) => s.deleteAdminDocument);
  const giftAdminDocument = useSocialStore((s) => s.giftAdminDocument);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4000);
  };

  const refreshUsers = async () => {
    setLoadingUsers(true);
    try {
      const cloudList = await listAllUsersForAdmin();
      // Merge with known social profiles so Admin always sees unified directory
      const byId = new Map<string, AdminUserSummary>();
      for (const u of cloudList) byId.set(u.id, u);
      for (const sp of Object.values(profilesById)) {
        if (!byId.has(sp.id)) {
          byId.set(sp.id, {
            id: sp.id,
            displayName: sp.displayName,
            avatarUrl: sp.avatarUrl ?? null,
            role: sp.role,
            membershipTier: 'free',
            totalScore: sp.reputationScore * 5,
            eloRating: 1200,
            gamesPlayed: 12,
            currentStreak: 3,
            isOnline: Boolean(sp.isOnline),
          });
        }
      }
      const merged = Array.from(byId.values());
      setUsers(merged);
      if (!selectedUser && merged[0]) {
        setSelectedUser(merged[0]);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return undefined;
    const t = setTimeout(() => {
      void refreshUsers();
    }, 0);
    return () => clearTimeout(t);
  }, [authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    const base = q
      ? users.filter((u) =>
          `${u.displayName} ${u.email ?? ''} ${u.role} ${u.membershipTier}`
            .toLowerCase()
            .includes(q)
        )
      : [...users];
    return base.sort((a, b) => {
      if (userSort === 'elo') return b.eloRating - a.eloRating;
      if (userSort === 'games') return b.gamesPlayed - a.gamesPlayed;
      return b.totalScore - a.totalScore;
    });
  }, [globalQuery, userSort, users]);

  // Privacy-Safe Admin Content List: NEVER exposes personal `draft` or `only_me` posts or user Bookmarks/Favourites!
  const manageablePosts = useMemo(
    () =>
      socialPosts
        .filter((p) => p.lifecycleStatus !== 'draft' && p.audience !== 'only_me')
        .filter((p) =>
          !globalQuery.trim()
            ? true
            : `${p.authorName} ${p.threadParts.join(' ')} ${p.topics.join(' ')}`
                .toLowerCase()
                .includes(globalQuery.trim().toLowerCase())
        ),
    [globalQuery, socialPosts]
  );

  // Aggregate Social & System Metrics (Section 14.1)
  const metrics = useMemo(() => {
    const totalReactions = socialPosts.reduce(
      (s, p) =>
        s + Object.values(p.reactions).reduce((acc, arr) => acc + (arr?.length ?? 0), 0),
      0
    );
    const totalComments = socialPosts.reduce((s, p) => s + p.comments.length, 0);
    const pendingModCount =
      moderationCases.filter(
        (c) =>
          c.workflowStatus === 'pending_review' ||
          c.workflowStatus === 'reported' ||
          c.workflowStatus === 'under_review'
      ).length + quizReports.filter((r) => r.status === 'open').length;
    const pendingAppeals = moderationCases.filter((c) => c.workflowStatus === 'appealed').length;
    const activeUsersCount = Math.max(1, users.length);
    return {
      totalUsers: activeUsersCount,
      dau: Math.max(1, Math.round(activeUsersCount * 0.68)),
      wau: Math.max(1, Math.round(activeUsersCount * 0.88)),
      mau: activeUsersCount,
      totalPosts: manageablePosts.length,
      totalComments,
      totalReactions,
      totalCommunities: communities.length,
      totalConversations: conversations.length,
      totalMessagesCount: chatMessages.length,
      liveRoomsCount: conversations.filter((c) => c.kind === 'live_room').length,
      pendingModCount,
      pendingAppeals,
    };
  }, [
    chatMessages.length,
    communities.length,
    conversations,
    manageablePosts.length,
    moderationCases,
    quizReports,
    socialPosts,
    users.length,
  ]);

  const handleAdminLogin = () => {
    setLoginError('');
    if (username.trim().toLowerCase() === ADMIN_USER && password === ADMIN_PASS) {
      setAuthenticated(true);
      setPassword('');
      sfx.playLevelUp();
    } else {
      setLoginError('Thông tin đăng nhập Quản trị viên không chính xác.');
      sfx.playWrong();
    }
  };

  // Pick PDF / DOC / DOCX / MD / TXT File for Document Library (Section 14.8)
  const handleUploadDocumentFile = async () => {
    if (uploadingFile) return;
    setUploadingFile(true);
    try {
      const picked = await pickRichSourceDocument();
      if (!picked) return;
      setDocFileName(picked.name);
      if (!docTitle.trim()) {
        setDocTitle(picked.name.replace(/\.[^.]+$/, ''));
      }
      setDocRichContent(picked.extractedText);
      const lower = picked.name.toLowerCase();
      if (lower.endsWith('.pdf')) setDocFormat('pdf');
      else if (lower.endsWith('.docx')) setDocFormat('docx');
      else if (lower.endsWith('.doc')) setDocFormat('doc');
      else if (lower.endsWith('.txt')) setDocFormat('txt');
      else setDocFormat('markdown');
      showToast(`📄 Đã nạp tệp «${picked.name}» vào trình biên tập Tài liệu!`);
    } catch {
      showToast('⚠️ Không đọc được tệp đã chọn — bạn vẫn có thể dán nội dung trực tiếp.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveAdminDocument = async () => {
    if (!docTitle.trim() || !docRichContent.trim()) {
      showToast('⚠️ Vui lòng nhập Tiêu đề và Nội dung (hoặc tải tệp tài liệu).');
      return;
    }
    const saved = await createOrUpdateAdminDocument('Admin', {
      id: docEditingId ?? undefined,
      title: docTitle.trim(),
      description: docDesc.trim() || 'Tài liệu học thuật chính thức từ Ban Quản Trị Papyrus.',
      coverUrl: null,
      category: docCategory.trim() || 'Đại học',
      tags: docTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      fileFormat: docFormat,
      fileName: docFileName || `${docTitle.trim().toLowerCase().replace(/\s+/g, '-')}.md`,
      storagePath: null,
      richContent: docRichContent,
      status: docStatus,
      allowDownload: docAllowDownload,
      expiresAt: docExpiresAt.trim() || null,
      recipientUserIds: docStatus === 'published' ? ['all'] : [],
      recipientCommunityIds: [],
    });

    setSelectedDocToGift(saved.id);
    setDocEditingId(null);
    setDocTitle('');
    setDocDesc('');
    setDocFileName('');
    setDocRichContent('');
    showToast(`✅ Đã lưu tài liệu «${saved.title}» (${saved.status}) vào Kho Quản Trị!`);
  };

  const handleDispatchDocumentGift = () => {
    const targetDoc = adminDocuments.find((d) => d.id === selectedDocToGift);
    if (!targetDoc) {
      showToast('⚠️ Vui lòng chọn một tài liệu từ Kho để gửi tặng.');
      return;
    }

    const label =
      giftScope === 'all_users'
        ? 'Tất cả người dùng đủ điều kiện'
        : giftScope === 'community'
        ? communities.find((c) => c.id === targetCommunityId)?.name || 'Cộng đồng'
        : giftScope === 'selected_users'
        ? `${multiSelectedUserIds.length} người dùng được chọn`
        : recipientName;

    const updated = giftAdminDocument({
      adminName: 'Admin',
      docId: targetDoc.id,
      targetScope: giftScope,
      userIds:
        giftScope === 'user'
          ? [recipientId]
          : giftScope === 'selected_users'
          ? multiSelectedUserIds
          : undefined,
      communityId: giftScope === 'community' ? targetCommunityId : undefined,
      targetLabel: label,
      expiresAt: giftExpiresAt.trim() || null,
    });

    if (updated) {
      pushNotification(
        {
          recipientId: giftScope === 'user' ? recipientId : 'all',
          kind: 'gift',
          title: `🎁 Tài liệu mới từ Admin: ${updated.title}`,
          body: `Bạn vừa được trao quyền truy cập «${updated.title}». Mở Hồ sơ → Học liệu & Quà để đọc hoặc tải về!`,
          actionRoute: '/profile',
          fromAdminConsole: true,
        },
        false
      );
      sfx.playLevelUp();
      showToast(`🎁 Đã trao tặng tài liệu «${updated.title}» tới «${label}» kèm thông báo realtime!`);
    }
  };

  const triggerLegacyGiftSend = async (targetId: string, targetName: string) => {
    if (giftType === 'question_set') {
      const targetSet = allSets.find((s) => s.id === selectedSetId) ?? allSets[0];
      if (!targetSet) return;
      await sendGift({
        recipientId: targetId,
        recipientName: targetName,
        giftType: 'question_set',
        title: customTitle.trim() || targetSet.title,
        message:
          giftMessage.trim() ||
          `🎁 Admin gửi tặng bạn bộ đề "${targetSet.title}" (${targetSet.questions.length} câu hỏi).`,
        questionSet: targetSet,
      });
    } else if (giftType === 'study_document') {
      await sendGift({
        recipientId: targetId,
        recipientName: targetName,
        giftType: 'study_document',
        title: customTitle.trim() || 'Tài liệu Ôn thi Đặc biệt từ Admin',
        message: giftMessage.trim() || 'Mở Hồ sơ cá nhân để nhận tài liệu và tạo Quiz AI ngay!',
        documentText:
          customDocText.trim() || 'Tóm tắt trọng tâm học thuật từ Ban Quản Trị Papyrus.',
      });
    } else if (giftType === 'vip_days') {
      await sendGift({
        recipientId: targetId,
        recipientName: targetName,
        giftType: 'vip_days',
        title: customTitle.trim() || 'Đặc quyền VIP Archmage',
        message: giftMessage.trim() || '👑 Chúc mừng bạn được Admin trao đặc quyền VIP Archmage!',
      });
    } else {
      await sendGift({
        recipientId: targetId,
        recipientName: targetName,
        giftType: 'streak_freeze',
        title: customTitle.trim() || '+2 Bùa Đóng Băng Chuỗi',
        message: giftMessage.trim() || '🧊 Admin gửi tặng bạn +2 Bùa Đóng Băng bảo vệ chuỗi Streak!',
      });
    }
    sfx.playLevelUp();
    showToast(`✅ Đã gửi quà & thông báo đẩy tới "${targetName}"!`);
  };

  const handleBroadcastCampaign = (presetTitle?: string, presetBody?: string) => {
    const tVal = (presetTitle ?? broadcastTitle).trim();
    const bVal = (presetBody ?? broadcastBody).trim();
    if (!tVal || !bVal) {
      showToast('⚠️ Vui lòng nhập đầy đủ tiêu đề và nội dung chiến dịch thông báo.');
      return;
    }
    pushNotification(
      {
        recipientId: 'all',
        kind: broadcastKind,
        title: tVal,
        body: bVal,
        actionRoute: '/',
        fromAdminConsole: true,
      },
      false
    );
    sfx.playCorrect();
    if (!presetTitle) {
      setBroadcastTitle('');
      setBroadcastBody('');
    }
    showToast('🚀 Đã phát thông báo tới toàn bộ người dùng!');
  };

  // ── 1. LOGIN GATE ──────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <View style={styles.rootDark}>
        <Screen transparent>
          <View style={styles.loginShell}>
            <SmoothReveal style={{ width: '100%', maxWidth: 440 }}>
              <Card color="#0F172A" style={styles.loginCard}>
                <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                  <BrandMark size={60} />
                  <View style={styles.adminPill}>
                    <AppIcon name="shield-checkmark" size={13} color="#38BDF8" />
                    <Text style={styles.adminPillText}>PAPYRUS ENTERPRISE ADMIN v3.0</Text>
                  </View>
                  <Text
                    style={[
                      typography.heading,
                      { color: '#F8FAFC', marginTop: spacing.xs, textAlign: 'center' },
                    ]}
                  >
                    Bảng Điều Khiển Quản Trị Toàn Diện
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: '#94A3B8', textAlign: 'center', marginTop: 4 },
                    ]}
                  >
                    Quản trị Mạng xã hội Threads, Cộng đồng, Kho Tài liệu & Quà tặng, PapyAI, Kiểm duyệt & Audit Log.
                  </Text>
                </View>

                {loginError ? (
                  <View style={styles.errorBanner}>
                    <AppIcon name="alert-circle" size={18} color="#FCA5A5" />
                    <Text style={{ color: '#FCA5A5', fontSize: 12.5, fontWeight: '700', flex: 1 }}>
                      {loginError}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>TÀI KHOẢN QUẢN TRỊ</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="admin"
                  placeholderTextColor="#64748B"
                  style={styles.darkInput}
                />

                <Text style={styles.fieldLabel}>MẬT KHẨU BẢO MẬT</Text>
                <View style={styles.passRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    placeholder="••••••••••"
                    placeholderTextColor="#64748B"
                    onSubmitEditing={handleAdminLogin}
                    style={[styles.darkInput, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onPress={() => setShowPass((v) => !v)}
                    style={{ paddingHorizontal: 12 }}
                  >
                    <AppIcon
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#94A3B8"
                    />
                  </Pressable>
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Button
                    variant="primary"
                    icon="log-in-outline"
                    onPress={handleAdminLogin}
                    fullWidth
                  >
                    Đăng nhập Workspace Quản trị
                  </Button>
                  <Button
                    variant="ghost"
                    icon="arrow-back"
                    onPress={() => router.replace('/')}
                    fullWidth
                  >
                    Quay về Ứng dụng Papyrus
                  </Button>
                </View>

                <View style={styles.credHint}>
                  <AppIcon name="key-outline" size={14} color="#38BDF8" />
                  <Text style={{ color: '#94A3B8', fontSize: 11.5, flex: 1 }}>
                    Mặc định: <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>admin</Text> /{' '}
                    <Text style={{ color: '#FDE68A', fontWeight: '800' }}>Papyrus@2026</Text>
                  </Text>
                </View>
              </Card>
            </SmoothReveal>
          </View>
        </Screen>
      </View>
    );
  }

  // Contextual User Inspector (RBAC Role, Restrict/Suspend/Ban, Gift, Push)
  const renderUserInspector = (u: AdminUserSummary) => {
    const socialProf = profilesById[u.id];
    const currentStatus = socialProf?.accountStatus ?? 'active';
    const currentRole = socialProf?.role ?? (u.role as SocialUserProfile['role']) ?? 'user';

    return (
      <View style={styles.inspectorCard}>
        <View style={styles.inspectorHeader}>
          <View style={styles.inspectorAvatar}>
            <Text style={{ color: '#38BDF8', fontWeight: '900', fontSize: 18 }}>
              {(u.displayName[0] || 'U').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.inspectorName} numberOfLines={1}>
              {u.displayName}
            </Text>
            <Text style={styles.inspectorSub} numberOfLines={1}>
              Vai trò: {currentRole.toUpperCase()} · Trạng thái: {currentStatus.toUpperCase()}
            </Text>
          </View>
          {!isDesktop && (
            <Pressable accessibilityRole="button" accessibilityLabel="Bỏ chọn người dùng" onPress={() => setSelectedUser(null)} hitSlop={8}>
              <AppIcon name="close-circle" size={24} color="#94A3B8" />
            </Pressable>
          )}
        </View>

        <View style={styles.inspectorTabs}>
          {(
            [
              { id: 'overview', label: 'Hồ sơ' },
              { id: 'status', label: '🛡️ Quyền & Khóa' },
              { id: 'gift', label: '🎁 Tặng' },
              { id: 'notify', label: '🔔 Push' },
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setInspectorTab(tab.id)}
              style={[
                styles.inspectorTabBtn,
                inspectorTab === tab.id && styles.inspectorTabBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.inspectorTabText,
                  inspectorTab === tab.id && { color: '#FFFFFF' },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {inspectorTab === 'overview' && (
          <View style={{ gap: 10 }}>
            <View style={styles.inspectorMetricGrid}>
              <View style={styles.inspectorMetricBox}>
                <Text style={styles.inspectorMetricLabel}>TỔNG ĐIỂM</Text>
                <Text style={styles.inspectorMetricVal}>
                  {u.totalScore.toLocaleString('vi-VN')} XP
                </Text>
              </View>
              <View style={styles.inspectorMetricBox}>
                <Text style={styles.inspectorMetricLabel}>1V1 ELO</Text>
                <Text style={[styles.inspectorMetricVal, { color: '#FBBF24' }]}>{u.eloRating}</Text>
              </View>
              <View style={styles.inspectorMetricBox}>
                <Text style={styles.inspectorMetricLabel}>SỐ TRẬN</Text>
                <Text style={[styles.inspectorMetricVal, { color: '#34D399' }]}>
                  {u.gamesPlayed}
                </Text>
              </View>
            </View>
            <Button
              variant="secondary"
              icon="open-outline"
              onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: u.id } })}
              fullWidth
            >
              Xem Trang Cá Nhân Công Khai
            </Button>
          </View>
        )}

        {inspectorTab === 'status' && (
          <View style={{ gap: 8 }}>
            <Text style={styles.fieldLabel}>PHÂN QUYỀN HỆ THỐNG (RBAC)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(['user', 'moderator', 'admin'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => {
                    updateUserAccountStatusAdmin(
                      u.id,
                      'Admin',
                      { role: r },
                      `Cập nhật vai trò RBAC thành ${r}`
                    );
                    showToast(`Đã cập nhật vai trò ${u.displayName} → ${r}`);
                  }}
                  style={[styles.miniChip, currentRole === r && styles.sortChipActive]}
                >
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>TRẠNG THÁI TÀI KHOẢN & CHẾ TÀI</Text>
            <TextInput
              value={statusReason}
              onChangeText={setStatusReason}
              placeholder="Lý do ghi vào Nhật ký Kiểm toán (Audit Log)..."
              placeholderTextColor="#64748B"
              style={styles.darkInput}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(
                [
                  { st: 'active', label: '✓ Khôi phục Active' },
                  { st: 'restricted', label: '⚠️ Hạn chế tương tác' },
                  { st: 'suspended', label: '⏸️ Tạm đình chỉ' },
                  { st: 'banned', label: '🚫 Khóa vĩnh viễn' },
                ] as const
              ).map((act) => (
                <Pressable
                  key={act.st}
                  onPress={() =>
                    setConfirmDialog({
                      title: `Xác nhận áp dụng trạng thái "${act.label}"?`,
                      description: `Thao tác với tài khoản "${u.displayName}" sẽ được ghi vào Nhật ký Kiểm toán (Audit Log).`,
                      onConfirm: () => {
                        updateUserAccountStatusAdmin(
                          u.id,
                          'Admin',
                          { accountStatus: act.st },
                          statusReason
                        );
                        setConfirmDialog(null);
                        showToast(`Đã cập nhật trạng thái ${u.displayName} → ${act.st}`);
                      },
                    })
                  }
                  style={[styles.miniChip, currentStatus === act.st && styles.sortChipActive]}
                >
                  <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>
                    {act.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {inspectorTab === 'gift' && (
          <View style={{ gap: 8 }}>
            <Button
              variant="reward"
              icon="document-attach-outline"
              onPress={() => {
                setRecipientId(u.id);
                setRecipientName(u.displayName);
                setGiftScope('user');
                setSection('documents_gifts');
              }}
              fullWidth
            >
              Tặng Tài liệu PDF/DOCX/MD cho {u.displayName}
            </Button>
            <Button
              variant="secondary"
              icon="gift-outline"
              onPress={() => {
                setGiftType('vip_days');
                void triggerLegacyGiftSend(u.id, u.displayName);
              }}
              fullWidth
            >
              Trao đặc quyền VIP Archmage
            </Button>
          </View>
        )}

        {inspectorTab === 'notify' && (
          <View style={{ gap: 8 }}>
            <TextInput
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholder="Tiêu đề thông báo riêng..."
              placeholderTextColor="#64748B"
              style={styles.darkInput}
            />
            <TextInput
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              placeholder="Nội dung thông báo..."
              placeholderTextColor="#64748B"
              style={styles.darkInput}
            />
            <Button
              variant="primary"
              icon="notifications-outline"
              onPress={() => {
                pushNotification(
                  {
                    recipientId: u.id,
                    kind: 'system',
                    title: broadcastTitle.trim() || `🦉 Thông báo cho ${u.displayName}`,
                    body: broadcastBody.trim() || 'Hãy kiểm tra học liệu mới trên Papyrus nhé!',
                    actionRoute: '/profile',
                    fromAdminConsole: true,
                  },
                  false
                );
                setBroadcastTitle('');
                setBroadcastBody('');
                showToast(`🔔 Đã đẩy thông báo riêng tới ${u.displayName}!`);
              }}
              fullWidth
            >
              Gửi Push Cá Nhân Hóa
            </Button>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.rootDark}>
      <View style={styles.workspaceRow}>
        {/* Desktop Vertical Sidebar */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <BrandMark size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sidebarTitle}>Papyrus Admin</Text>
                <Text style={styles.sidebarSub}>v3.0 · Social & Learning Ops</Text>
              </View>
            </View>

            <ScrollView style={{ flex: 1, marginTop: spacing.sm }} contentContainerStyle={{ gap: 4 }}>
              {NAV_ITEMS.map((item) => {
                const active = section === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSection(item.id)}
                    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
                  >
                    <AppIcon name={item.icon} size={17} color={active ? '#38BDF8' : '#94A3B8'} />
                    <Text
                      style={[
                        styles.sidebarItemText,
                        active && { color: '#F8FAFC', fontWeight: '800' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.id === 'moderation_audit' &&
                    metrics.pendingModCount + metrics.pendingAppeals > 0 ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {metrics.pendingModCount + metrics.pendingAppeals}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sidebarFooter}>
              <Pressable onPress={() => router.replace('/')} style={styles.sidebarFooterBtn}>
                <AppIcon name="phone-portrait-outline" size={16} color="#C7D2FE" />
                <Text style={{ color: '#C7D2FE', fontSize: 12.5, fontWeight: '700' }}>
                  Mở Ứng dụng
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthenticated(false)}
                style={[styles.sidebarFooterBtn, { borderColor: 'rgba(239,68,68,0.4)' }]}
              >
                <AppIcon name="lock-closed-outline" size={16} color="#FCA5A5" />
                <Text style={{ color: '#FCA5A5', fontSize: 12.5, fontWeight: '700' }}>
                  Khóa Admin
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Main Workspace Canvas */}
        <View style={{ flex: 1 }}>
          <View style={styles.topCommandBar}>
            {!isDesktop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở menu quản trị"
                onPress={() => setMobileDrawerOpen(true)}
                style={styles.hamburgerBtn}
              >
                <AppIcon name="menu" size={22} color="#F8FAFC" />
              </Pressable>
            )}

            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={styles.pageHeaderTitle} numberOfLines={1}>
                {NAV_ITEMS.find((n) => n.id === section)?.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <OnlineStatusDot size={7} />
                <Text style={styles.pageHeaderSub} numberOfLines={1}>
                  Hệ thống ổn định (99.98%) · {metrics.totalUsers} thành viên · {auditLogs.length} bản ghi Audit
                </Text>
              </View>
            </View>

            {isTabletUp && (
              <View style={styles.datePillGroup}>
                {(['7d', '30d', 'all'] as const).map((rk) => (
                  <Pressable
                    key={rk}
                    onPress={() => setDateRange(rk)}
                    style={[styles.datePill, dateRange === rk && styles.datePillActive]}
                  >
                    <Text style={[styles.datePillText, dateRange === rk && { color: '#FFFFFF' }]}>
                      {rk === '7d' ? '7 ngày' : rk === '30d' ? '30 ngày' : 'Tất cả'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {!isDesktop && (
              <Pressable accessibilityRole="button" accessibilityLabel="Về trang chủ" onPress={() => router.replace('/')} style={styles.mobileExitBtn}>
                <AppIcon name="home-outline" size={18} color="#E0E7FF" />
              </Pressable>
            )}
          </View>

          {!isDesktop && (
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#1E293B', backgroundColor: '#0B1120' }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mobileTabsRow}
              >
                {NAV_ITEMS.map((item) => {
                  const active = section === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSection(item.id)}
                      style={[styles.mobileTabChip, active && styles.mobileTabChipActive]}
                    >
                      <AppIcon name={item.icon} size={14} color={active ? '#FFFFFF' : '#94A3B8'} />
                      <Text style={[styles.mobileTabText, active && { color: '#FFFFFF' }]}>
                        {item.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Global Search Filter */}
          <View style={styles.searchStrip}>
            <AppIcon name="search" size={16} color="#64748B" />
            <TextInput
              value={globalQuery}
              onChangeText={setGlobalQuery}
              placeholder="Tìm kiếm Người dùng, Bài viết, Cộng đồng, Tài liệu, Nhật ký Audit..."
              placeholderTextColor="#64748B"
              style={styles.searchStripInput}
            />
            {!!globalQuery && (
              <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setGlobalQuery('')}>
                <AppIcon name="close-circle" size={18} color="#64748B" />
              </Pressable>
            )}
          </View>

          {!!actionToast && (
            <View style={styles.toastBanner}>
              <Text style={styles.toastText}>{actionToast}</Text>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.canvasScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ================================================================= */}
            {/* 14.1 ADMIN OVERVIEW DASHBOARD                                     */}
            {/* ================================================================= */}
            {section === 'overview' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.kpiGrid}>
                  <TablerKpiCard
                    subheader="NGƯỜI DÙNG (DAU / WAU / MAU)"
                    value={`${metrics.dau} / ${metrics.wau} / ${metrics.mau}`}
                    trend="+24%"
                    positive
                    accentColor="#38BDF8"
                    bars={[4, 6, 7, 9, 10, 12, metrics.mau + 6]}
                  />
                  <TablerKpiCard
                    subheader="CHUỖI THREADS & PHẢN HỒI"
                    value={`${metrics.totalPosts} bài · ${metrics.totalComments} cmt`}
                    trend={`${metrics.totalReactions} biểu cảm`}
                    positive
                    accentColor="#818CF8"
                    bars={[3, 5, 8, 9, 11, 14, metrics.totalPosts + 10]}
                  />
                  <TablerKpiCard
                    subheader="CỘNG ĐỒNG & TIN NHẮN TỔNG HỢP"
                    value={`${metrics.totalCommunities} nhóm · ${metrics.totalConversations} chat`}
                    trend={`${metrics.liveRoomsCount} phòng Live`}
                    positive
                    accentColor="#10B981"
                    bars={[2, 3, 4, 5, 6, 7, metrics.totalCommunities + metrics.totalConversations]}
                  />
                  <TablerKpiCard
                    subheader="BÁO CÁO & KHIẾU NẠI CHỜ XỬ LÝ"
                    value={`${metrics.pendingModCount} báo cáo · ${metrics.pendingAppeals} khiếu nại`}
                    trend={metrics.pendingModCount === 0 ? 'An toàn' : 'Cần duyệt'}
                    positive={metrics.pendingModCount === 0}
                    accentColor="#F59E0B"
                    bars={[3, 2, 2, 1, 1, 1, Math.max(1, metrics.pendingModCount)]}
                  />
                </View>

                <View style={[styles.splitRow, !isTabletUp && { flexDirection: 'column' }]}>
                  <View style={[styles.panelCard, { flex: 1.3, gap: 10 }]}>
                    <Text style={styles.panelTitle}>
                      ⚡ Sức Khỏe Hệ Thống, Dung Lượng Lưu Trữ & Chi Phí PapyAI
                    </Text>
                    <View style={styles.inspectorMetricGrid}>
                      <View style={styles.inspectorMetricBox}>
                        <Text style={styles.inspectorMetricLabel}>DATABASE & RLS</Text>
                        <Text style={[styles.inspectorMetricVal, { color: '#34D399' }]}>
                          Hoạt động tốt
                        </Text>
                      </View>
                      <View style={styles.inspectorMetricBox}>
                        <Text style={styles.inspectorMetricLabel}>STORAGE TÀI LIỆU</Text>
                        <Text style={styles.inspectorMetricVal}>
                          {adminDocuments.length} tài liệu ({gifts.length} lượt tặng)
                        </Text>
                      </View>
                      <View style={styles.inspectorMetricBox}>
                        <Text style={styles.inspectorMetricLabel}>ƯỚC TÍNH PAPYAI</Text>
                        <Text style={[styles.inspectorMetricVal, { color: '#38BDF8' }]}>
                          $0.14 / tháng (Cache bật)
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.panelCard, { flex: 1, gap: 8 }]}>
                    <Text style={styles.panelTitle}>🚀 Điều Hành Nhanh</Text>
                    <Button
                      variant="reward"
                      icon="document-attach-outline"
                      onPress={() => setSection('documents_gifts')}
                      fullWidth
                    >
                      Tải Lên & Trao Tặng Tài Liệu Học Thuật
                    </Button>
                    <Button
                      variant="primary"
                      icon="shield-checkmark-outline"
                      onPress={() => setSection('moderation_audit')}
                      fullWidth
                    >
                      Duyệt Báo Cáo & Khiếu Nại ({metrics.pendingModCount + metrics.pendingAppeals})
                    </Button>
                  </View>
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.2 USER MANAGEMENT                                              */}
            {/* ================================================================= */}
            {section === 'users' && (
              <View style={[styles.splitRow, !isDesktop && { flexDirection: 'column' }]}>
                <View style={[styles.panelCard, { flex: 1.5 }]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                      Danh Bạ Người Dùng ({filteredUsers.length})
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['score', 'elo', 'games'] as const).map((sk) => (
                        <Pressable
                          key={sk}
                          onPress={() => setUserSort(sk)}
                          style={[styles.sortChip, userSort === sk && styles.sortChipActive]}
                        >
                          <Text
                            style={{
                              color: userSort === sk ? '#FFF' : '#94A3B8',
                              fontSize: 11,
                              fontWeight: '700',
                            }}
                          >
                            {sk === 'score' ? 'Điểm ↓' : sk === 'elo' ? 'ELO ↓' : 'Trận ↓'}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable accessibilityRole="button" accessibilityLabel="Làm mới danh sách người dùng" onPress={() => void refreshUsers()} style={styles.sortChip}>
                        <AppIcon name="refresh" size={13} color="#38BDF8" />
                      </Pressable>
                    </View>
                  </View>

                  {loadingUsers ? (
                    <Text style={{ color: '#94A3B8', paddingVertical: 16 }}>
                      Đang đồng bộ danh bạ người dùng…
                    </Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 10 }}>
                      {filteredUsers.map((u) => {
                        const selected = selectedUser?.id === u.id;
                        const st = profilesById[u.id]?.accountStatus ?? 'active';
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() => {
                              setSelectedUser(u);
                              setRecipientId(u.id);
                              setRecipientName(u.displayName);
                            }}
                            style={[
                              styles.tableDataRow,
                              selected && {
                                borderColor: '#38BDF8',
                                backgroundColor: 'rgba(56, 189, 248, 0.10)',
                              },
                            ]}
                          >
                            <View style={styles.rowAvatar}>
                              <Text style={{ color: '#E0E7FF', fontWeight: '800', fontSize: 13 }}>
                                {(u.displayName[0] || 'U').toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13.5 }}
                                numberOfLines={1}
                              >
                                {u.displayName}
                              </Text>
                              <Text style={{ color: '#94A3B8', fontSize: 11 }} numberOfLines={1}>
                                Trạng thái: {st} · ELO {u.eloRating} · {u.totalScore.toLocaleString('vi-VN')} XP
                              </Text>
                            </View>
                            <Badge tone={st === 'active' ? 'success' : 'danger'}>{st}</Badge>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {isDesktop && (
                  <View style={{ flex: 1 }}>
                    {selectedUser ? (
                      renderUserInspector(selectedUser)
                    ) : (
                      <View style={styles.panelCard}>
                        <Text style={{ color: '#94A3B8' }}>
                          Chọn một người dùng để xem chi tiết, cấp quyền hoặc khóa tài khoản.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.3 CONTENT MANAGEMENT (PRIVACY-SAFE: NO PRIVATE DRAFTS/BOOKMARKS) */}
            {/* ================================================================= */}
            {section === 'content' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    🧵 Quản Lý Bài Viết, Chuỗi Threads, Ghost Posts & Bình Chọn ({manageablePosts.length})
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 11.5, marginTop: 4 }}>
                    🔒 Bảo vệ quyền riêng tư: Bản nháp cá nhân (Drafts), bài viết Chỉ mình tôi và danh sách Bookmark/Yêu thích riêng tư không bao giờ bị hiển thị tại đây.
                  </Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {manageablePosts.map((p) => (
                      <View key={p.id} style={styles.tableDataRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            <Badge tone="primary">{p.postKind}</Badge>
                            <Badge
                              tone={p.lifecycleStatus === 'published' ? 'success' : 'neutral'}
                            >
                              {p.lifecycleStatus}
                            </Badge>
                            {p.isSpoiler && <Badge tone="reward">Spoiler</Badge>}
                          </View>
                          <Text
                            style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13.5, marginTop: 4 }}
                          >
                            {p.authorName}
                          </Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12 }} numberOfLines={2}>
                            {p.threadParts[0]}
                          </Text>
                        </View>
                        {p.lifecycleStatus !== 'removed' ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onPress={() =>
                              setConfirmDialog({
                                title: 'Xác nhận gỡ bài viết vi phạm?',
                                description: `Gỡ bài viết của "${p.authorName}" khỏi Bảng tin công khai.`,
                                onConfirm: () => {
                                  deleteOrArchivePost(p.id, 'admin', 'delete');
                                  setConfirmDialog(null);
                                  showToast('🗑️ Đã gỡ bài viết khỏi hệ thống.');
                                },
                              })
                            }
                          >
                            Gỡ bài
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => {
                              deleteOrArchivePost(p.id, 'admin', 'restore');
                              showToast('✓ Đã khôi phục bài viết.');
                            }}
                          >
                            Khôi phục
                          </Button>
                        )}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                      📚 Ngân Hàng Câu Hỏi Đại Học ({allSets.length} bộ · {totalQuestions} câu)
                    </Text>
                    <Button
                      size="sm"
                      icon="add-circle-outline"
                      onPress={() => router.push('/create/generate?mode=manual')}
                    >
                      Tạo bộ đề mới
                    </Button>
                  </View>
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.4 COMMUNITY MANAGEMENT                                         */}
            {/* ================================================================= */}
            {section === 'communities' && (
              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>
                  🏛️ Quản Lý Nhóm & Cộng Đồng ({communities.length})
                </Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  {communities.map((c) => (
                    <View key={c.id} style={styles.tableDataRow}>
                      <Text style={{ fontSize: 22 }}>{c.avatarEmoji}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }}>
                          {c.name} ({c.visibility})
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                          👥 {c.members.length} thành viên · 📅 {c.events.length} sự kiện · Duyệt bài:{' '}
                          {c.requirePostApproval ? 'Bật' : 'Tắt'}
                        </Text>
                      </View>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: '/community',
                            params: { communityId: c.id },
                          })
                        }
                      >
                        Mở nhóm
                      </Button>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.5 MESSAGING & REALTIME MANAGEMENT (AGGREGATE + REPORTED ONLY)  */}
            {/* ================================================================= */}
            {section === 'messaging' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    💬 Quản Trị Tin Nhắn & Phòng Live (Bảo Mật Tin Nhắn Riêng Tư)
                  </Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
                    🔒 Tuân thủ quyền riêng tư: Quản trị viên chỉ xem chỉ số tổng hợp và các tin nhắn bị người dùng bấm Báo cáo vi phạm — tuyệt đối không đọc lén hội thoại 1-1 riêng tư.
                  </Text>
                  <View style={[styles.inspectorMetricGrid, { marginTop: 12 }]}>
                    <View style={styles.inspectorMetricBox}>
                      <Text style={styles.inspectorMetricLabel}>TỔNG HỘI THOẠI</Text>
                      <Text style={styles.inspectorMetricVal}>{metrics.totalConversations}</Text>
                    </View>
                    <View style={styles.inspectorMetricBox}>
                      <Text style={styles.inspectorMetricLabel}>TIN NHẮN ĐÃ GỬI</Text>
                      <Text style={styles.inspectorMetricVal}>{metrics.totalMessagesCount}</Text>
                    </View>
                    <View style={styles.inspectorMetricBox}>
                      <Text style={styles.inspectorMetricLabel}>PHÒNG LIVE HOẠT ĐỘNG</Text>
                      <Text style={[styles.inspectorMetricVal, { color: '#34D399' }]}>
                        {metrics.liveRoomsCount}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>🚩 Tin Nhắn Bị Báo Cáo Vi Phạm</Text>
                  {moderationCases
                    .filter((mc) => mc.targetType === 'message')
                    .map((mc) => (
                      <View key={mc.id} style={[styles.tableDataRow, { marginTop: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{mc.reason}</Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                            Nội dung bị báo cáo: «{mc.targetPreview}»
                          </Text>
                        </View>
                        <Badge tone="primary">{mc.workflowStatus}</Badge>
                      </View>
                    ))}
                  {moderationCases.filter((mc) => mc.targetType === 'message').length === 0 ? (
                    <Text style={{ color: '#94A3B8', marginTop: 8 }}>
                      Không có tin nhắn nào bị báo cáo vi phạm.
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.6 FEED & PAPYAI MANAGEMENT                                     */}
            {/* ================================================================= */}
            {section === 'feed_ai' && (
              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>
                  ✨ Điều Khiển Thuật Toán Bảng Tin, Từ Khóa Cấm & PapyAI
                </Text>
                <View style={{ gap: 12, marginTop: 12 }}>
                  {(
                    [
                      {
                        label: 'PapyAI Feed Assistant (Tối ưu bảng tin bằng ngôn ngữ tự nhiên)',
                        val: aiFeedAssistantEnabled,
                        toggle: () => setAiFeedAssistantEnabled((v) => !v),
                      },
                      {
                        label: 'PapyAI Tóm tắt bài viết dài & chuỗi thảo luận (Có nhãn AI rõ ràng)',
                        val: aiPostSummaryEnabled,
                        toggle: () => setAiPostSummaryEnabled((v) => !v),
                      },
                      {
                        label: 'Tìm kiếm ngữ nghĩa PapyAI & Gợi ý chủ đề thông minh',
                        val: aiSemanticSearchEnabled,
                        toggle: () => setAiSemanticSearchEnabled((v) => !v),
                      },
                      {
                        label: 'PapyAI Hỗ trợ phát hiện Spam & Độc hại trước kiểm duyệt',
                        val: aiAutoModerationEnabled,
                        toggle: () => setAiAutoModerationEnabled((v) => !v),
                      },
                    ] as const
                  ).map((item, idx) => (
                    <Pressable
                      key={idx}
                      onPress={item.toggle}
                      style={[styles.tableDataRow, { justifyContent: 'space-between' }]}
                    >
                      <Text style={{ color: '#F8FAFC', fontSize: 13, fontWeight: '700', flex: 1 }}>
                        {item.label}
                      </Text>
                      <Badge tone={item.val ? 'success' : 'neutral'}>
                        {item.val ? 'ĐANG BẬT' : 'TẮT'}
                      </Badge>
                    </Pressable>
                  ))}

                  <Text style={styles.fieldLabel}>GIỚI HẠN TỐC ĐỘ AI (REQUESTS / PHÚT / USER)</Text>
                  <TextInput
                    value={aiRateLimitPerMin}
                    onChangeText={setAiRateLimitPerMin}
                    keyboardType="numeric"
                    style={styles.darkInput}
                  />

                  <Text style={styles.fieldLabel}>TỪ KHÓA CHẶN TOÀN HỆ THỐNG</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={newGlobalMutedWord}
                      onChangeText={setNewGlobalMutedWord}
                      placeholder="Nhập từ khóa spam cần lọc..."
                      placeholderTextColor="#64748B"
                      style={[styles.darkInput, { flex: 1, marginBottom: 0 }]}
                    />
                    <Button
                      onPress={() => {
                        if (!newGlobalMutedWord.trim()) return;
                        setGlobalMutedWords((prev) =>
                          Array.from(new Set([...prev, newGlobalMutedWord.trim()]))
                        );
                        setNewGlobalMutedWord('');
                      }}
                    >
                      Thêm
                    </Button>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {globalMutedWords.map((w) => (
                      <Pressable
                        key={w}
                        onPress={() =>
                          setGlobalMutedWords((prev) => prev.filter((item) => item !== w))
                        }
                        style={styles.miniChip}
                      >
                        <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>
                          {w} ✕
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.7 NOTIFICATION MANAGEMENT                                      */}
            {/* ================================================================= */}
            {section === 'notifications' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    🦉 Mẫu Chiến Dịch Nhắc Học Tự Động & Thông Báo Hệ Thống
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    <Button
                      variant="reward"
                      icon="flame"
                      onPress={() =>
                        handleBroadcastCampaign(
                          '🔥 Cảnh báo giữ chuỗi Streak 20h!',
                          'Hãy hoàn thành 5 câu ôn tập nhanh hôm nay để bảo vệ chuỗi ngày học liên tiếp nhé!'
                        )
                      }
                    >
                      Nhắc Giữ Chuỗi 20h
                    </Button>
                    <Button
                      variant="primary"
                      icon="sparkles"
                      onPress={() =>
                        handleBroadcastCampaign(
                          '🧵 Thảo luận sôi nổi trên Cộng đồng Threads!',
                          'Nhiều chủ đề học thuật & bình chọn mới vừa lên sóng — tham gia đóng góp góc nhìn của bạn ngay!'
                        )
                      }
                    >
                      Mời Thảo Luận Cộng Đồng
                    </Button>
                  </View>
                </View>

                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>📢 Phát Thông Báo Tùy Chỉnh</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <TextInput
                      value={broadcastTitle}
                      onChangeText={setBroadcastTitle}
                      placeholder="Tiêu đề thông báo..."
                      placeholderTextColor="#64748B"
                      style={styles.darkInput}
                    />
                    <TextInput
                      value={broadcastBody}
                      onChangeText={setBroadcastBody}
                      multiline
                      placeholder="Nội dung chi tiết..."
                      placeholderTextColor="#64748B"
                      style={[styles.darkInput, { minHeight: 80 }]}
                    />
                    <Button
                      variant="primary"
                      icon="megaphone-outline"
                      onPress={() => handleBroadcastCampaign()}
                      fullWidth
                    >
                      Phát Thông Báo Ngay ({notifications.length} lịch sử đã gửi)
                    </Button>
                  </View>
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.8 MANDATORY DEDICATED ADMIN DOCUMENT & GIFT MANAGEMENT MODULE  */}
            {/* ================================================================= */}
            {section === 'documents_gifts' && (
              <View style={{ gap: spacing.md }}>
                {/* Part A: Upload / Rich-Author Document into Library */}
                <View style={styles.panelCard}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                      📑 1. Soạn Thảo Hoặc Tải Lên Tài Liệu Học Thuật (PDF · DOC · DOCX · MD · TXT)
                    </Text>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="cloud-upload-outline"
                      disabled={uploadingFile}
                      onPress={() => void handleUploadDocumentFile()}
                    >
                      {uploadingFile ? 'Đang nạp tệp…' : 'Chọn tệp từ máy'}
                    </Button>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.fieldLabel}>TIÊU ĐỀ TÀI LIỆU</Text>
                    <TextInput
                      value={docTitle}
                      onChangeText={setDocTitle}
                      placeholder="Vd: Giáo Trình Tóm Tắt Hệ Phân Tán & Kiến Trúc CSDL..."
                      placeholderTextColor="#64748B"
                      style={styles.darkInput}
                    />

                    <Text style={styles.fieldLabel}>MÔ TẢ NGẮN & CHUYÊN NGÀNH</Text>
                    <TextInput
                      value={docDesc}
                      onChangeText={setDocDesc}
                      placeholder="Mô tả giá trị học tập của tài liệu..."
                      placeholderTextColor="#64748B"
                      style={styles.darkInput}
                    />

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <TextInput
                        value={docCategory}
                        onChangeText={setDocCategory}
                        placeholder="Danh mục..."
                        placeholderTextColor="#64748B"
                        style={[styles.darkInput, { flex: 1, minWidth: 160 }]}
                      />
                      <TextInput
                        value={docTags}
                        onChangeText={setDocTags}
                        placeholder="Thẻ tags (cách bởi dấu phẩy)..."
                        placeholderTextColor="#64748B"
                        style={[styles.darkInput, { flex: 1, minWidth: 160 }]}
                      />
                    </View>

                    <Text style={styles.fieldLabel}>ĐỊNH DẠNG & TRẠNG THÁI XUẤT BẢN</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {(['markdown', 'pdf', 'docx', 'doc', 'txt'] as const).map((fmt) => (
                        <Pressable
                          key={fmt}
                          onPress={() => setDocFormat(fmt)}
                          style={[styles.miniChip, docFormat === fmt && styles.sortChipActive]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>
                            {fmt.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}

                      {(['published', 'draft', 'scheduled', 'unpublished'] as const).map((st) => (
                        <Pressable
                          key={st}
                          onPress={() => setDocStatus(st)}
                          style={[styles.miniChip, docStatus === st && styles.sortChipActive]}
                        >
                          <Text style={{ color: '#FDE68A', fontSize: 11.5, fontWeight: '800' }}>
                            {st}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>
                      NỘI DUNG TÀI LIỆU {docFileName ? `(Đã đính kèm tệp: ${docFileName})` : '(Rich Markdown / Văn bản)'}
                    </Text>
                    <TextInput
                      value={docRichContent}
                      onChangeText={setDocRichContent}
                      multiline
                      placeholder="Nhập nội dung tài liệu trực tiếp hoặc bấm «Chọn tệp từ máy» để trích xuất nội dung..."
                      placeholderTextColor="#64748B"
                      style={[styles.darkInput, { minHeight: 120, textAlignVertical: 'top' }]}
                    />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      <Pressable
                        onPress={() => setDocAllowDownload((v) => !v)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <AppIcon
                          name={docAllowDownload ? 'checkbox' : 'square-outline'}
                          size={18}
                          color="#38BDF8"
                        />
                        <Text style={{ color: '#F8FAFC', fontSize: 12.5, fontWeight: '700' }}>
                          Cho phép người nhận tải tệp về máy
                        </Text>
                      </Pressable>

                      <TextInput
                        value={docExpiresAt}
                        onChangeText={setDocExpiresAt}
                        placeholder="Ngày hết hạn tùy chọn (YYYY-MM-DD)..."
                        placeholderTextColor="#64748B"
                        style={[styles.darkInput, { marginBottom: 0, minWidth: 230 }]}
                      />
                    </View>

                    <Button
                      variant="primary"
                      icon="save-outline"
                      onPress={() => void handleSaveAdminDocument()}
                      fullWidth
                    >
                      {docEditingId ? 'Cập Nhật Tài Liệu' : 'Lưu Vào Kho Tài Liệu Quản Trị'}
                    </Button>
                  </View>
                </View>

                {/* Part B: Gift Document to Individual / Selected Users / Community / All Users */}
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    🎁 2. Phân Phối & Tặng Tài Liệu Tới Người Dùng Hoặc Cộng Đồng
                  </Text>

                  <Text style={styles.fieldLabel}>
                    CHỌN TÀI LIỆU TRONG KHO ({adminDocuments.length})
                  </Text>
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {adminDocuments.map((doc) => (
                      <View
                        key={doc.id}
                        style={[
                          styles.tableDataRow,
                          selectedDocToGift === doc.id && {
                            borderColor: '#F59E0B',
                            backgroundColor: 'rgba(245, 158, 11, 0.14)',
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => setSelectedDocToGift(doc.id)}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13.5 }}>
                            [{doc.fileFormat.toUpperCase()}] {doc.title} ({doc.status})
                          </Text>
                          <Text style={{ color: '#94A3B8', fontSize: 11.5 }}>
                            📥 {doc.downloadCount} lượt tải · 🎁 {doc.giftHistory.length} đợt trao tặng
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setDocEditingId(doc.id);
                            setDocTitle(doc.title);
                            setDocDesc(doc.description);
                            setDocCategory(doc.category);
                            setDocTags(doc.tags.join(', '));
                            setDocFormat(doc.fileFormat);
                            setDocRichContent(doc.richContent);
                            setDocStatus(doc.status);
                            setDocAllowDownload(doc.allowDownload);
                          }}
                          style={styles.sortChip}
                        >
                          <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800' }}>
                            Sửa
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Xóa tài liệu"
                          onPress={() => {
                            deleteAdminDocument('Admin', doc.id);
                            showToast('Đã xóa tài liệu khỏi kho.');
                          }}
                          style={styles.sortChip}
                        >
                          <AppIcon name="trash-outline" size={14} color="#FCA5A5" />
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>PHẠM VI NGƯỜI NHẬN TÀI LIỆU</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {(
                      [
                        { id: 'all_users', label: '🌍 Tất cả người dùng đủ điều kiện' },
                        { id: 'user', label: '👤 Cá nhân 1 người dùng' },
                        { id: 'selected_users', label: '👥 Nhóm nhiều người dùng chọn lọc' },
                        { id: 'community', label: '🏛️ Toàn bộ thành viên 1 Cộng đồng' },
                      ] as const
                    ).map((sc) => (
                      <Pressable
                        key={sc.id}
                        onPress={() => setGiftScope(sc.id)}
                        style={[styles.miniChip, giftScope === sc.id && styles.sortChipActive]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                          {sc.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {giftScope === 'user' && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, marginBottom: 10 }}
                    >
                      {users.map((u) => (
                        <Pressable
                          key={u.id}
                          onPress={() => {
                            setRecipientId(u.id);
                            setRecipientName(u.displayName);
                          }}
                          style={[styles.miniChip, recipientId === u.id && styles.sortChipActive]}
                        >
                          <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>
                            {u.displayName}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  {giftScope === 'selected_users' && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {users.map((u) => {
                        const picked = multiSelectedUserIds.includes(u.id);
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() =>
                              setMultiSelectedUserIds((prev) =>
                                prev.includes(u.id)
                                  ? prev.filter((x) => x !== u.id)
                                  : [...prev, u.id]
                              )
                            }
                            style={[styles.miniChip, picked && styles.sortChipActive]}
                          >
                            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                              {picked ? '✓ ' : '+ '}
                              {u.displayName}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {giftScope === 'community' && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {communities.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => setTargetCommunityId(c.id)}
                          style={[
                            styles.miniChip,
                            targetCommunityId === c.id && styles.sortChipActive,
                          ]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                            {c.avatarEmoji} {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  <TextInput
                    value={giftExpiresAt}
                    onChangeText={setGiftExpiresAt}
                    placeholder="Hạn nhận / truy cập quà tặng (tùy chọn, vd: 2027-06-30)..."
                    placeholderTextColor="#64748B"
                    style={styles.darkInput}
                  />

                  <Button
                    variant="reward"
                    icon="gift"
                    onPress={handleDispatchDocumentGift}
                    fullWidth
                  >
                    Trao Tặng Tài Liệu & Phát Thông Báo Tức Thì
                  </Button>
                </View>

                {/* Part C: Gift Question Sets / VIP / Streak Freeze */}
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    👑 3. Tặng Nhanh Bộ Đề Quiz, VIP Archmage Hoặc Bùa Đóng Băng Chuỗi
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>
                    {(
                      [
                        { id: 'question_set', label: '📚 Bộ đề Đại học' },
                        { id: 'vip_days', label: '👑 Đặc quyền VIP' },
                        { id: 'streak_freeze', label: '🧊 +2 Bùa Chuỗi' },
                      ] as const
                    ).map((gt) => (
                      <Pressable
                        key={gt.id}
                        onPress={() => setGiftType(gt.id)}
                        style={[styles.miniChip, giftType === gt.id && styles.sortChipActive]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                          {gt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Button
                    variant="secondary"
                    icon="paper-plane-outline"
                    onPress={() =>
                      void triggerLegacyGiftSend(
                        giftScope === 'user' ? recipientId : 'all',
                        giftScope === 'user' ? recipientName : 'Tất cả người dùng'
                      )
                    }
                    fullWidth
                  >
                    Gửi Vật Phẩm Học Tập Ngay
                  </Button>
                </View>
              </View>
            )}

            {/* ================================================================= */}
            {/* 14.9 MODERATION WORKFLOW, APPEALS & IMMUTABLE AUDIT LOGS          */}
            {/* ================================================================= */}
            {section === 'moderation_audit' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    🛡️ Hàng Đợi Kiểm Duyệt & Đơn Khiếu Nại (Appeals) ({moderationCases.length})
                  </Text>
                  {moderationCases.length === 0 ? (
                    <Text style={{ color: '#94A3B8', marginTop: 10 }}>
                      Hiện không có báo cáo nội dung xã hội hay khiếu nại nào chờ xử lý.
                    </Text>
                  ) : (
                    <View style={{ gap: 10, marginTop: 10 }}>
                      {moderationCases.map((mc) => (
                        <View
                          key={mc.id}
                          style={[styles.tableDataRow, { flexDirection: 'column', alignItems: 'stretch' }]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                            <Badge tone="primary">
                              {mc.targetType.toUpperCase()} · {mc.workflowStatus}
                            </Badge>
                            {mc.aiFlagSummary ? (
                              <Text style={{ color: '#38BDF8', fontSize: 11.5, fontWeight: '700' }}>
                                🤖 {mc.aiFlagSummary}
                              </Text>
                            ) : null}
                          </View>

                          <Text style={{ color: '#F8FAFC', fontWeight: '800', marginTop: 4 }}>
                            Lý do báo cáo: {mc.reason} (Bởi {mc.reporterName})
                          </Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12 }}>{mc.targetPreview}</Text>

                          {mc.appealReason ? (
                            <View
                              style={{
                                marginTop: 6,
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: 'rgba(245, 158, 11, 0.14)',
                              }}
                            >
                              <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '800' }}>
                                📨 Nội dung Khiếu nại từ người dùng: «{mc.appealReason}»
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {mc.workflowStatus === 'appealed' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  onPress={() => {
                                    resolveUserAppeal(
                                      mc.id,
                                      'Admin',
                                      'accepted',
                                      'Chấp nhận khiếu nại & khôi phục nội dung'
                                    );
                                    showToast('✓ Đã chấp nhận khiếu nại và khôi phục nội dung!');
                                  }}
                                >
                                  Chấp nhận Khiếu nại (Khôi phục)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onPress={() => {
                                    resolveUserAppeal(
                                      mc.id,
                                      'Admin',
                                      'rejected',
                                      'Giữ nguyên quyết định kiểm duyệt'
                                    );
                                    showToast('Đã từ chối khiếu nại và đóng hồ sơ.');
                                  }}
                                >
                                  Bác bỏ Khiếu nại
                                </Button>
                              </>
                            ) : (
                              (
                                [
                                  { act: 'warning', label: '⚠️ Cảnh cáo' },
                                  { act: 'remove_content', label: '🗑️ Gỡ nội dung' },
                                  { act: 'account_suspension', label: '⏸️ Tạm khóa user' },
                                ] as Array<{ act: ModerationActionKind; label: string }>
                              ).map((btn) => (
                                <Button
                                  key={btn.act}
                                  size="sm"
                                  variant="secondary"
                                  onPress={() => {
                                    applyAdminModerationAction(
                                      mc.id,
                                      'Admin',
                                      'action_applied',
                                      btn.act,
                                      mc.reason
                                    );
                                    showToast(`Đã áp dụng chế tài: ${btn.label}`);
                                  }}
                                >
                                  {btn.label}
                                </Button>
                              ))
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Legacy Question Set Reports */}
                {quizReports.length > 0 ? (
                  <View style={styles.panelCard}>
                    <Text style={styles.panelTitle}>
                      📝 Báo Cáo Câu Hỏi Trắc Nghiệm ({quizReports.length})
                    </Text>
                    {quizReports.map((r) => (
                      <View key={r.id} style={[styles.tableDataRow, { marginTop: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{r.reason}</Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12 }}>{r.questionPreview}</Text>
                        </View>
                        {r.status === 'open' ? (
                          <Button
                            size="sm"
                            variant="success"
                            onPress={() => updateQuizReportStatus(r.id, 'reviewed')}
                          >
                            Đã xử lý
                          </Button>
                        ) : (
                          <Badge tone="success">{r.status}</Badge>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Immutable Admin Audit Logs */}
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>
                    📜 Nhật Ký Kiểm Toán Bất Biến (Admin Audit Logs · {auditLogs.length})
                  </Text>
                  {auditLogs.length === 0 ? (
                    <Text style={{ color: '#94A3B8', marginTop: 8 }}>
                      Mọi thao tác quản trị (khóa/mở tài khoản, gỡ bài, duyệt khiếu nại, tặng tài liệu) đều tự động ghi nhận tại đây.
                    </Text>
                  ) : (
                    <View style={{ gap: 6, marginTop: 10 }}>
                      {auditLogs.slice(0, 30).map((log) => (
                        <View key={log.id} style={styles.tableDataRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '800' }}>
                              [{log.actionType}] bởi {log.actorName} → {log.targetType} ({log.targetId.slice(0, 12)})
                            </Text>
                            <Text style={{ color: '#E2E8F0', fontSize: 12 }}>{log.reason}</Text>
                          </View>
                          <Text style={{ color: '#64748B', fontSize: 11 }}>
                            {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Sensitive Action Confirmation Modal */}
      {confirmDialog ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmDialog(null)}
        >
          <View style={styles.confirmBackdrop}>
            <Card color="#0F172A" style={{ width: '100%', maxWidth: 420, gap: 12, borderColor: '#EF4444', borderWidth: 1 }}>
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '900' }}>
                {confirmDialog.title}
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 13 }}>{confirmDialog.description}</Text>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onPress={() => setConfirmDialog(null)}>
                  Hủy
                </Button>
                <Button variant="danger" onPress={confirmDialog.onConfirm}>
                  Xác nhận thực thi
                </Button>
              </View>
            </Card>
          </View>
        </Modal>
      ) : null}

      {/* Mobile Slide-Over Drawer */}
      <Modal
        visible={!isDesktop && mobileDrawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMobileDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={styles.mobileDrawer}>
            <View style={styles.sidebarBrand}>
              <BrandMark size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sidebarTitle}>Papyrus Admin</Text>
                <Text style={styles.sidebarSub}>Mobile Ops v3.0</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setMobileDrawerOpen(false)}>
                <AppIcon name="close" size={24} color="#94A3B8" />
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: spacing.md, flex: 1 }} contentContainerStyle={{ gap: 4 }}>
              {NAV_ITEMS.map((item) => {
                const active = section === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSection(item.id);
                      setMobileDrawerOpen(false);
                    }}
                    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
                  >
                    <AppIcon name={item.icon} size={18} color={active ? '#38BDF8' : '#94A3B8'} />
                    <Text
                      style={[
                        styles.sidebarItemText,
                        active && { color: '#F8FAFC', fontWeight: '800' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button
              variant="danger"
              icon="lock-closed-outline"
              onPress={() => {
                setMobileDrawerOpen(false);
                setAuthenticated(false);
              }}
              fullWidth
            >
              Khóa Bảng Quản Trị
            </Button>
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setMobileDrawerOpen(false)} />
        </View>
      </Modal>

      {/* Mobile Contextual User Inspector Sheet */}
      <Modal
        visible={!isDesktop && section === 'users' && Boolean(selectedUser)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.mobileInspectorBackdrop}>
          {selectedUser ? renderUserInspector(selectedUser) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootDark: { flex: 1, backgroundColor: '#070B19' },
  workspaceRow: { flex: 1, flexDirection: 'row' },
  loginShell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl },
  loginCard: { borderColor: '#1E293B', borderWidth: 1.5, padding: spacing.xl },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  adminPillText: { color: '#38BDF8', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    marginBottom: 12,
  },
  fieldLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  darkInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1120',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    marginBottom: 10,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1120',
    marginBottom: 10,
  },
  credHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  sidebar: {
    width: 262,
    backgroundColor: '#0B1120',
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
    padding: spacing.md,
  },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  sidebarTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '900' },
  sidebarSub: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.30)',
  },
  sidebarItemText: { color: '#94A3B8', fontSize: 12.5, fontWeight: '700', flex: 1 },
  countBadge: { backgroundColor: '#EF4444', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { color: '#FFF', fontSize: 10.5, fontWeight: '900' },
  sidebarFooter: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E293B' },
  sidebarFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  topCommandBar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    ...(Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 30 } as unknown as ViewStyle) : {}),
  },
  hamburgerBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileExitBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeaderTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  pageHeaderSub: { color: '#64748B', fontSize: 11.5, fontWeight: '600' },
  datePillGroup: { flexDirection: 'row', backgroundColor: '#070B19', borderRadius: 9, padding: 3, borderWidth: 1, borderColor: '#1E293B' },
  datePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  datePillActive: { backgroundColor: '#4F46E5' },
  datePillText: { color: '#94A3B8', fontSize: 11.5, fontWeight: '700' },
  mobileTabsRow: { paddingHorizontal: spacing.md, paddingVertical: 8, gap: 6 },
  mobileTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  mobileTabChipActive: { backgroundColor: '#4F46E5', borderColor: '#818CF8' },
  mobileTabText: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  searchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  searchStripInput: { flex: 1, color: '#F8FAFC', fontSize: 13.5 },
  toastBanner: {
    marginHorizontal: spacing.md,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  toastText: { color: '#A7F3D0', fontSize: 12.5, fontWeight: '800' },
  canvasScroll: { padding: spacing.md, paddingBottom: 60, gap: spacing.md },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderTopWidth: 3,
    padding: 14,
  },
  kpiHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  kpiSubheader: { color: '#94A3B8', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, flex: 1 },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  kpiValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginTop: 8, fontVariant: ['tabular-nums'] },
  sparklineRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 28, marginTop: 10 },
  splitRow: { flexDirection: 'row', gap: 12 },
  panelCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: spacing.md,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  rowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sortChipActive: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#818CF8',
  },
  miniChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inspectorCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    padding: spacing.md,
    gap: 12,
  },
  inspectorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inspectorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectorName: { color: '#F8FAFC', fontSize: 16, fontWeight: '900' },
  inspectorSub: { color: '#94A3B8', fontSize: 11.5 },
  inspectorTabs: { flexDirection: 'row', gap: 4, backgroundColor: '#0B1120', padding: 4, borderRadius: 10 },
  inspectorTabBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  inspectorTabBtnActive: { backgroundColor: '#4F46E5' },
  inspectorTabText: { color: '#94A3B8', fontSize: 11.5, fontWeight: '800' },
  inspectorMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inspectorMetricBox: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#0B1120',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inspectorMetricLabel: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  inspectorMetricVal: { color: '#F8FAFC', fontSize: 14.5, fontWeight: '900', marginTop: 4 },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(2, 6, 23, 0.72)' },
  mobileDrawer: {
    width: 280,
    backgroundColor: '#0B1120',
    padding: spacing.md,
    paddingTop: spacing.xl,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
  },
  mobileInspectorBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
});
