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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, BrandMark, Button, Card, OnlineStatusDot, Screen, SmoothReveal } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useModerationStore } from '@/features/moderation/state/useModerationStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { listAllUsersForAdmin, type AdminUserSummary } from '@/composition/platform';
import { seedQuestionSets } from '@/composition/preferences';
import { sfx } from '@/core/audio/sfx';

type AdminSection = 'dashboard' | 'users' | 'content' | 'gifts' | 'moderation' | 'campaigns';
type DateRangeKey = '7d' | '30d' | 'all';
type InspectorTab = 'overview' | 'gift' | 'notify';

const ADMIN_USER = (process.env.EXPO_PUBLIC_ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ADMIN_PASS = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || 'Papyrus@2026';

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'dashboard', label: 'Dashboard Tổng quan', shortLabel: 'Dashboard', icon: 'grid-outline' },
  { id: 'users', label: 'Quản lý Học giả', shortLabel: 'Học giả', icon: 'people-outline' },
  { id: 'content', label: 'Kho Bộ Đề & Môn Học', shortLabel: 'Kho đề', icon: 'library-outline' },
  { id: 'gifts', label: 'Trung tâm Tặng Quà', shortLabel: 'Tặng quà', icon: 'gift-outline' },
  { id: 'moderation', label: 'Kiểm duyệt Nội dung', shortLabel: 'Kiểm duyệt', icon: 'shield-half-outline' },
  { id: 'campaigns', label: 'Chiến dịch Push (20h)', shortLabel: 'Push', icon: 'megaphone-outline' },
];

/**
 * Tabler KPI Card with top status stripe, bold tabular value, trend badge & inline mini sparkline bars.
 */
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
          <Ionicons
            name={positive ? 'trending-up' : 'trending-down'}
            size={12}
            color={positive ? '#34D399' : '#F87171'}
          />
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: positive ? '#34D399' : '#F87171' }}>
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

/**
 * Enterprise Admin Console built around Tabler (KPIs, Sidebar/Offcanvas, Analytics Cards)
 * and Appsmith (Master-Detail Data Table + Contextual Right/Sheet Inspector).
 */
export default function AdminPortalScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const isTabletUp = width >= 700;

  // Independent Admin Authentication
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Workspace & Master-Detail State
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>('7d');
  const [globalQuery, setGlobalQuery] = useState('');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');
  const [userSort, setUserSort] = useState<'score' | 'elo' | 'games'>('score');

  // Gift & Push Composer State
  const [recipientId, setRecipientId] = useState<string>('all');
  const [recipientName, setRecipientName] = useState<string>('Tất cả người dùng');
  const [giftType, setGiftType] = useState<AdminGiftItem['giftType']>('question_set');
  const [selectedSetId, setSelectedSetId] = useState<string>(seedQuestionSets[0]?.id ?? '');
  const [customTitle, setCustomTitle] = useState('');
  const [customDocText, setCustomDocText] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [actionToast, setActionToast] = useState('');

  // Broadcast / Duolingo Campaign State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastKind, setBroadcastKind] = useState<'system' | 'update'>('system');

  const storeSets = usePapyrusStore((s) => s.questionSets);
  const allSets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const totalQuestions = useMemo(() => allSets.reduce((sum, s) => sum + s.questions.length, 0), [allSets]);

  const reports = useModerationStore((s) => s.reports);
  const updateReportStatus = useModerationStore((s) => s.updateStatus);

  const gifts = useNotificationStore((s) => s.gifts);
  const notifications = useNotificationStore((s) => s.notifications);
  const sendGift = useNotificationStore((s) => s.sendGift);
  const pushNotification = useNotificationStore((s) => s.pushNotification);

  const refreshUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await listAllUsersForAdmin();
      setUsers(list);
      if (!selectedUser && list[0]) {
        setSelectedUser(list[0]);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void listAllUsersForAdmin()
      .then((list) => {
        if (!active) return;
        setUsers(list);
        if (list[0]) setSelectedUser(list[0]);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authenticated]);

  const filteredUsers = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    const base = q
      ? users.filter((u) => `${u.displayName} ${u.id} ${u.role} ${u.membershipTier}`.toLowerCase().includes(q))
      : [...users];
    return base.sort((a, b) => {
      if (userSort === 'elo') return b.eloRating - a.eloRating;
      if (userSort === 'games') return b.gamesPlayed - a.gamesPlayed;
      return b.totalScore - a.totalScore;
    });
  }, [users, globalQuery, userSort]);

  const filteredSets = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return allSets;
    return allSets.filter((s) => `${s.title} ${s.subject} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q));
  }, [allSets, globalQuery]);

  const subjectStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSets) {
      const key = s.subject?.trim() || 'Đại cương';
      counts.set(key, (counts.get(key) ?? 0) + s.questions.length);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [allSets]);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 4200);
  };

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

  const triggerGiftSend = async (targetId: string, targetName: string) => {
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
          `🎁 Admin gửi tặng bạn bộ đề "${targetSet.title}" (${targetSet.questions.length} câu hỏi chuẩn Đại học).`,
        questionSet: targetSet,
      });
    } else if (giftType === 'study_document') {
      const docBody =
        customDocText.trim() ||
        'Tóm tắt Trọng tâm Ôn thi Đại học Papyrus: 1) Nắm vững định nghĩa cốt lõi. 2) Luyện Active Recall qua Cung Thủ 3D & Sinh Tồn.';
      await sendGift({
        recipientId: targetId,
        recipientName: targetName,
        giftType: 'study_document',
        title: customTitle.trim() || 'Tài liệu Ôn thi Đặc biệt từ Admin',
        message: giftMessage.trim() || 'Mở Thông báo hoặc Hồ sơ cá nhân để nhận tài liệu và tạo Quiz AI ngay!',
        documentText: docBody,
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
    setCustomTitle('');
    setCustomDocText('');
    setGiftMessage('');
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
    showToast('🚀 Đã phát thông báo đẩy (Trong App + Hệ điều hành / PWA Service Worker)!');
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
                    <Ionicons name="shield-checkmark" size={13} color="#38BDF8" />
                    <Text style={styles.adminPillText}>PAPYRUS ENTERPRISE ADMIN</Text>
                  </View>
                  <Text style={[typography.heading, { color: '#F8FAFC', marginTop: spacing.xs, textAlign: 'center' }]}>
                    Bảng Điều Khiển Quản Trị
                  </Text>
                  <Text style={[typography.caption, { color: '#94A3B8', textAlign: 'center', marginTop: 4 }]}>
                    Kiến trúc Dashboard Quản lý Học giả, Kho đề Đại học, Kiểm duyệt & Chiến dịch Push 20h.
                  </Text>
                </View>

                {loginError ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#FCA5A5" />
                    <Text style={{ color: '#FCA5A5', fontSize: 12.5, fontWeight: '700', flex: 1 }}>{loginError}</Text>
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
                  <Pressable onPress={() => setShowPass((v) => !v)} style={{ paddingHorizontal: 12 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                  </Pressable>
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Button variant="primary" icon="log-in-outline" onPress={handleAdminLogin} fullWidth>
                    Đăng nhập Workspace Quản trị
                  </Button>
                  <Button variant="ghost" icon="arrow-back" onPress={() => router.replace('/')} fullWidth>
                    Quay về Ứng dụng Papyrus
                  </Button>
                </View>

                <View style={styles.credHint}>
                  <Ionicons name="key-outline" size={14} color="#38BDF8" />
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

  const openReports = reports.filter((r) => r.status === 'open');

  // Contextual Appsmith Inspector Panel (reused in Right Column on Desktop & Modal Sheet on Mobile)
  const renderUserInspector = (u: AdminUserSummary) => (
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
            ID: {u.id.slice(0, 14)}… · {u.membershipTier === 'archmage' ? '👑 VIP Archmage' : 'Học giả'}
          </Text>
        </View>
        {!isDesktop && (
          <Pressable onPress={() => setSelectedUser(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={24} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* Inspector Tabs */}
      <View style={styles.inspectorTabs}>
        {(
          [
            { id: 'overview', label: 'Hồ sơ' },
            { id: 'gift', label: '🎁 Tặng nhanh' },
            { id: 'notify', label: '🔔 Gửi Push' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setInspectorTab(tab.id)}
            style={[styles.inspectorTabBtn, inspectorTab === tab.id && styles.inspectorTabBtnActive]}
          >
            <Text style={[styles.inspectorTabText, inspectorTab === tab.id && { color: '#FFFFFF' }]}>
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
              <Text style={styles.inspectorMetricVal}>{u.totalScore.toLocaleString('vi-VN')} XP</Text>
            </View>
            <View style={styles.inspectorMetricBox}>
              <Text style={styles.inspectorMetricLabel}>1V1 ELO</Text>
              <Text style={[styles.inspectorMetricVal, { color: '#FBBF24' }]}>{u.eloRating}</Text>
            </View>
            <View style={styles.inspectorMetricBox}>
              <Text style={styles.inspectorMetricLabel}>SỐ TRẬN</Text>
              <Text style={[styles.inspectorMetricVal, { color: '#34D399' }]}>{u.gamesPlayed}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="reward"
              icon="gift-outline"
              onPress={() => {
                setGiftType('vip_days');
                void triggerGiftSend(u.id, u.displayName);
              }}
            >
              Cấp VIP ngay
            </Button>
            <Button
              variant="secondary"
              icon="snow-outline"
              onPress={() => {
                setGiftType('streak_freeze');
                void triggerGiftSend(u.id, u.displayName);
              }}
            >
              +2 Bùa Chuỗi
            </Button>
          </View>
        </View>
      )}

      {inspectorTab === 'gift' && (
        <View style={{ gap: 8 }}>
          <Text style={styles.fieldLabel}>CHỌN BỘ ĐỀ ĐẠI HỌC GỬI TẶNG RIÊNG</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {allSets.slice(0, 8).map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setGiftType('question_set');
                  setSelectedSetId(s.id);
                }}
                style={[
                  styles.miniChip,
                  selectedSetId === s.id && { backgroundColor: '#4F46E5', borderColor: '#818CF8' },
                ]}
              >
                <Text style={{ color: '#F8FAFC', fontSize: 11.5, fontWeight: '700' }} numberOfLines={1}>
                  {s.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            value={giftMessage}
            onChangeText={setGiftMessage}
            placeholder="Lời nhắn kèm món quà..."
            placeholderTextColor="#64748B"
            style={styles.darkInput}
          />
          <Button
            variant="reward"
            icon="paper-plane-outline"
            onPress={() => {
              setGiftType('question_set');
              void triggerGiftSend(u.id, u.displayName);
            }}
            fullWidth
          >
            Gửi Bộ Đề Tới {u.displayName}
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
            placeholder="Nội dung nhắc nhở học tập..."
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
                  title: broadcastTitle.trim() || `🦉 Nhắc học dành cho ${u.displayName}`,
                  body: broadcastBody.trim() || 'Hãy quay lại hoàn thành bài ôn tập hôm nay để giữ chuỗi Streak nhé!',
                  actionRoute: '/',
                  fromAdminConsole: true,
                },
                false
              );
              setBroadcastTitle('');
              setBroadcastBody('');
              showToast(`🔔 Đã đẩy thông báo trực tiếp tới ${u.displayName}!`);
            }}
            fullWidth
          >
            Gửi Push Cá Nhân Hóa
          </Button>
        </View>
      )}
    </View>
  );

  // ── 2. TABLER + APPSMITH WORKSPACE SHELL ───────────────────────────────────
  return (
    <View style={styles.rootDark}>
      <View style={styles.workspaceRow}>
        {/* Desktop Tabler Left Vertical Sidebar */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <BrandMark size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sidebarTitle}>Papyrus Admin</Text>
                <Text style={styles.sidebarSub}>v2.5 · Enterprise Ops</Text>
              </View>
            </View>

            <View style={{ gap: 4, flex: 1, marginTop: spacing.md }}>
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
                    <Ionicons name={item.icon} size={18} color={active ? '#38BDF8' : '#94A3B8'} />
                    <Text style={[styles.sidebarItemText, active && { color: '#F8FAFC', fontWeight: '800' }]}>
                      {item.label}
                    </Text>
                    {item.id === 'moderation' && openReports.length > 0 ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{openReports.length}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sidebarFooter}>
              <Pressable onPress={() => router.replace('/')} style={styles.sidebarFooterBtn}>
                <Ionicons name="phone-portrait-outline" size={16} color="#C7D2FE" />
                <Text style={{ color: '#C7D2FE', fontSize: 12.5, fontWeight: '700' }}>Mở Ứng dụng</Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthenticated(false)}
                style={[styles.sidebarFooterBtn, { borderColor: 'rgba(239,68,68,0.4)' }]}
              >
                <Ionicons name="lock-closed-outline" size={16} color="#FCA5A5" />
                <Text style={{ color: '#FCA5A5', fontSize: 12.5, fontWeight: '700' }}>Đăng xuất</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Main Scrollable Canvas */}
        <View style={{ flex: 1 }}>
          {/* Sticky Top Command Bar (Mobile-First Safe Area + Search + Date Filter) */}
          <View style={styles.topCommandBar}>
            {!isDesktop && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mở menu quản trị"
                onPress={() => setMobileDrawerOpen(true)}
                style={styles.hamburgerBtn}
              >
                <Ionicons name="menu" size={22} color="#F8FAFC" />
              </Pressable>
            )}

            <View style={{ flex: 1, minWidth: 120 }}>
              <Text style={styles.pageHeaderTitle} numberOfLines={1}>
                {NAV_ITEMS.find((n) => n.id === section)?.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <OnlineStatusDot size={7} />
                <Text style={styles.pageHeaderSub} numberOfLines={1}>
                  Realtime Cloud Telemetry · {users.length} học giả
                </Text>
              </View>
            </View>

            {/* Date Range Pills */}
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
              <Pressable onPress={() => router.replace('/')} style={styles.mobileExitBtn}>
                <Ionicons name="home-outline" size={18} color="#E0E7FF" />
              </Pressable>
            )}
          </View>

          {/* Mobile Quick Horizontal Section Switcher (Thumb-friendly!) */}
          {!isDesktop && (
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#1E293B', backgroundColor: '#0B1120' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileTabsRow}>
                {NAV_ITEMS.map((item) => {
                  const active = section === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setSection(item.id)}
                      style={[styles.mobileTabChip, active && styles.mobileTabChipActive]}
                    >
                      <Ionicons name={item.icon} size={14} color={active ? '#FFFFFF' : '#94A3B8'} />
                      <Text style={[styles.mobileTabText, active && { color: '#FFFFFF' }]}>{item.shortLabel}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Global Filter Search Bar */}
          <View style={styles.searchStrip}>
            <Ionicons name="search" size={16} color="#64748B" />
            <TextInput
              value={globalQuery}
              onChangeText={setGlobalQuery}
              placeholder="Tìm kiếm nhanh Học giả, ID, Bộ đề, Môn học..."
              placeholderTextColor="#64748B"
              style={styles.searchStripInput}
            />
            {!!globalQuery && (
              <Pressable onPress={() => setGlobalQuery('')}>
                <Ionicons name="close-circle" size={18} color="#64748B" />
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
            {/* ── SECTION 1: TABLER EXECUTIVE DASHBOARD ── */}
            {section === 'dashboard' && (
              <View style={{ gap: spacing.md }}>
                {/* 4 Tabler KPI Cards */}
                <View style={styles.kpiGrid}>
                  <TablerKpiCard
                    subheader="HỌC GIẢ ĐÃ ĐĂNG KÝ"
                    value={String(Math.max(1, users.length))}
                    trend="+24%"
                    positive
                    accentColor="#38BDF8"
                    bars={[3, 5, 4, 7, 8, 10, Math.max(11, users.length + 8)]}
                  />
                  <TablerKpiCard
                    subheader="KHO BỘ ĐỀ ĐẠI HỌC"
                    value={`${allSets.length} bộ`}
                    trend={`${totalQuestions} câu`}
                    positive
                    accentColor="#818CF8"
                    bars={[8, 10, 12, 15, 17, 19, allSets.length]}
                  />
                  <TablerKpiCard
                    subheader="QUÀ & TÀI LIỆU ĐÃ TẶNG"
                    value={String(gifts.length)}
                    trend="+100%"
                    positive
                    accentColor="#F59E0B"
                    bars={[1, 2, 3, 4, 4, 6, Math.max(7, gifts.length + 5)]}
                  />
                  <TablerKpiCard
                    subheader="BÁO CÁO CẦN DUYỆT"
                    value={String(openReports.length)}
                    trend={openReports.length === 0 ? 'An toàn' : 'Cần xử lý'}
                    positive={openReports.length === 0}
                    accentColor="#10B981"
                    bars={[4, 3, 2, 2, 1, 1, Math.max(1, openReports.length)]}
                  />
                </View>

                {/* Split Analytics Row: Subject Distribution + Live Activity Feed */}
                <View style={[styles.splitRow, !isTabletUp && { flexDirection: 'column' }]}>
                  <View style={[styles.panelCard, { flex: 1.4 }]}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>Phân bổ Ngân hàng Câu hỏi theo Chuyên ngành</Text>
                      <Badge tone="primary">{totalQuestions} câu</Badge>
                    </View>
                    <View style={{ gap: 10, marginTop: 8 }}>
                      {subjectStats.map(([subj, cnt], idx) => {
                        const pct = Math.min(100, Math.round((cnt / Math.max(1, totalQuestions)) * 100 * 2.8));
                        const barColors = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
                        return (
                          <View key={subj} style={{ gap: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ color: '#E2E8F0', fontSize: 12.5, fontWeight: '700' }}>{subj}</Text>
                              <Text style={{ color: '#94A3B8', fontSize: 12, fontVariant: ['tabular-nums'] }}>
                                {cnt} câu hỏi
                              </Text>
                            </View>
                            <View style={styles.barTrack}>
                              <View
                                style={[
                                  styles.barFill,
                                  { width: `${pct}%`, backgroundColor: barColors[idx % barColors.length] },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.panelCard, { flex: 1 }]}>
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelTitle}>Tác vụ Điều hành Nhanh</Text>
                    </View>
                    <View style={{ gap: 8, marginTop: 6 }}>
                      <Button variant="reward" icon="gift-outline" onPress={() => setSection('gifts')} fullWidth>
                        Tặng Bộ Đề / Tài Liệu / VIP
                      </Button>
                      <Button
                        variant="primary"
                        icon="notifications-outline"
                        onPress={() =>
                          handleBroadcastCampaign(
                            '🦉 Papybot nhắc giờ vàng ôn thi!',
                            'Vào bắn 1 ván Cung Thủ Thiên Thạch 3D để nhận x2 XP và giữ lửa chuỗi Streak hôm nay nhé!'
                          )
                        }
                        fullWidth
                      >
                        Phát Nhắc Học Duolingo Toàn App
                      </Button>
                      <Button variant="secondary" icon="people-outline" onPress={() => setSection('users')} fullWidth>
                        Mở Bảng Học Giả & Inspector
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ── SECTION 2: APPSMITH MASTER-DETAIL USER DIRECTORY + INSPECTOR ── */}
            {section === 'users' && (
              <View style={[styles.splitRow, !isDesktop && { flexDirection: 'column' }]}>
                <View style={[styles.panelCard, { flex: 1.5 }]}>
                  <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Danh bạ Học giả ({filteredUsers.length})</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {(['score', 'elo', 'games'] as const).map((sk) => (
                        <Pressable
                          key={sk}
                          onPress={() => setUserSort(sk)}
                          style={[styles.sortChip, userSort === sk && styles.sortChipActive]}
                        >
                          <Text style={{ color: userSort === sk ? '#FFF' : '#94A3B8', fontSize: 11, fontWeight: '700' }}>
                            {sk === 'score' ? 'Điểm ↓' : sk === 'elo' ? 'ELO ↓' : 'Trận ↓'}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable onPress={() => void refreshUsers()} style={styles.sortChip}>
                        <Ionicons name="refresh" size={13} color="#38BDF8" />
                      </Pressable>
                    </View>
                  </View>

                  {loadingUsers ? (
                    <Text style={{ color: '#94A3B8', paddingVertical: 16 }}>Đang đồng bộ dữ liệu người dùng…</Text>
                  ) : filteredUsers.length === 0 ? (
                    <Text style={{ color: '#94A3B8', paddingVertical: 16 }}>
                      Chưa tìm thấy người dùng khớp bộ lọc hiện tại.
                    </Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {/* Desktop Table Header */}
                      {isTabletUp && (
                        <View style={styles.tableHeadRow}>
                          <Text style={[styles.thText, { flex: 2 }]}>HỌC GIẢ</Text>
                          <Text style={[styles.thText, { flex: 1 }]}>HẠNG</Text>
                          <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>ELO</Text>
                          <Text style={[styles.thText, { flex: 1.2, textAlign: 'right' }]}>ĐIỂM XP</Text>
                        </View>
                      )}

                      {filteredUsers.map((u) => {
                        const selected = selectedUser?.id === u.id;
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
                              selected && { borderColor: '#38BDF8', backgroundColor: 'rgba(56, 189, 248, 0.10)' },
                            ]}
                          >
                            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <View style={styles.rowAvatar}>
                                <Text style={{ color: '#E0E7FF', fontWeight: '800', fontSize: 13 }}>
                                  {(u.displayName[0] || 'U').toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 13.5 }} numberOfLines={1}>
                                    {u.displayName}
                                  </Text>
                                  {u.isOnline ? (
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' }} />
                                  ) : null}
                                </View>
                                <Text style={{ color: '#94A3B8', fontSize: 11 }} numberOfLines={1}>
                                  {u.email ? `${u.email} · ` : ''}🔥 {u.currentStreak ?? 0}d · {u.gamesPlayed} trận · ID {u.id.slice(0, 6)}
                                </Text>
                              </View>
                            </View>

                            {isTabletUp ? (
                              <>
                                <View style={{ flex: 1 }}>
                                  <Badge tone={u.membershipTier === 'archmage' ? 'reward' : 'neutral'}>
                                    {u.membershipTier === 'archmage' ? 'VIP' : 'Free'}
                                  </Badge>
                                </View>
                                <Text style={[styles.tdNum, { flex: 1, color: '#FBBF24' }]}>{u.eloRating}</Text>
                                <Text style={[styles.tdNum, { flex: 1.2, color: '#38BDF8' }]}>
                                  {u.totalScore.toLocaleString('vi-VN')} XP
                                </Text>
                              </>
                            ) : (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: '#38BDF8', fontWeight: '800', fontSize: 12.5 }}>
                                  {u.totalScore.toLocaleString('vi-VN')} XP
                                </Text>
                                <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '700' }}>
                                  ELO {u.eloRating}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Desktop Contextual Right Inspector */}
                {isDesktop && (
                  <View style={{ flex: 1 }}>
                    {selectedUser ? (
                      renderUserInspector(selectedUser)
                    ) : (
                      <View style={styles.panelCard}>
                        <Text style={{ color: '#94A3B8' }}>Chọn một học giả bên trái để mở bảng Inspector chi tiết.</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── SECTION 3: QUESTION BANK MANAGEMENT ── */}
            {section === 'content' && (
              <View style={styles.panelCard}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>Kho 20 Bộ Câu Hỏi Đại Học & Bộ Đề Người Dùng ({filteredSets.length})</Text>
                  <Button icon="add-circle-outline" onPress={() => router.push('/create/generate?mode=manual')}>
                    Tạo đề mới
                  </Button>
                </View>
                <View style={{ gap: 8, marginTop: 10 }}>
                  {filteredSets.map((s, idx) => (
                    <View key={s.id} style={styles.tableDataRow}>
                      <View style={styles.indexBadge}>
                        <Text style={{ color: '#818CF8', fontWeight: '900', fontSize: 12 }}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                          {s.title}
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 11.5 }} numberOfLines={1}>
                          {s.subject || 'Đại học'} · {s.questions.length} câu hỏi
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          setSelectedSetId(s.id);
                          setGiftType('question_set');
                          setSection('gifts');
                        }}
                        style={styles.sortChipActive}
                      >
                        <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '800' }}>🎁 Tặng bộ này</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── SECTION 4: GIFT CENTER ── */}
            {section === 'gifts' && (
              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>🎁 Trung Tâm Trao Tặng Học Liệu, Bộ Đề & Đặc Quyền VIP</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12.5, marginTop: 4, marginBottom: 12 }}>
                  Gửi tặng trực tiếp cho Tất cả người dùng hoặc từng Học giả cụ thể — tự động đẩy thông báo tức thì!
                </Text>

                <Text style={styles.fieldLabel}>1. NGƯỜI NHẬN</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  <Pressable
                    onPress={() => {
                      setRecipientId('all');
                      setRecipientName('Tất cả người dùng');
                    }}
                    style={[styles.miniChip, recipientId === 'all' && styles.sortChipActive]}
                  >
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>🌍 Tất cả người dùng</Text>
                  </Pressable>
                  {users.map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => {
                        setRecipientId(u.id);
                        setRecipientName(u.displayName);
                      }}
                      style={[styles.miniChip, recipientId === u.id && styles.sortChipActive]}
                    >
                      <Text style={{ color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}>👤 {u.displayName}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>2. LOẠI QUÀ TẶNG</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(
                    [
                      { id: 'question_set', label: '📚 Bộ câu hỏi Đại học' },
                      { id: 'study_document', label: '📄 Tài liệu ôn tập' },
                      { id: 'vip_days', label: '👑 Đặc quyền VIP' },
                      { id: 'streak_freeze', label: '🧊 +2 Bùa Chuỗi' },
                    ] as const
                  ).map((gt) => (
                    <Pressable
                      key={gt.id}
                      onPress={() => setGiftType(gt.id)}
                      style={[styles.miniChip, giftType === gt.id && styles.sortChipActive]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{gt.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {giftType === 'question_set' && (
                  <>
                    <Text style={styles.fieldLabel}>CHỌN BỘ CÂU HỎI ({allSets.length} BỘ)</Text>
                    <ScrollView style={{ maxHeight: 190, marginBottom: 12 }} nestedScrollEnabled>
                      {allSets.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => setSelectedSetId(s.id)}
                          style={[
                            styles.tableDataRow,
                            { marginBottom: 6 },
                            selectedSetId === s.id && { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.14)' },
                          ]}
                        >
                          <Text style={{ color: '#F8FAFC', fontWeight: '700', flex: 1 }}>{s.title}</Text>
                          <Text style={{ color: '#FDE68A', fontSize: 11.5 }}>{s.questions.length} câu</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                {giftType === 'study_document' && (
                  <>
                    <Text style={styles.fieldLabel}>NỘI DUNG TÀI LIỆU TẶNG</Text>
                    <TextInput
                      value={customDocText}
                      onChangeText={setCustomDocText}
                      multiline
                      placeholder="Dán đề cương, công thức, tài liệu ôn thi để học giả tạo Quiz AI ngay..."
                      placeholderTextColor="#64748B"
                      style={[styles.darkInput, { minHeight: 96, textAlignVertical: 'top' }]}
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>TIÊU ĐỀ & LỜI NHẮN TỪ ADMIN</Text>
                <TextInput
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="Tiêu đề món quà (để trống sẽ lấy tự động)..."
                  placeholderTextColor="#64748B"
                  style={styles.darkInput}
                />
                <TextInput
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                  placeholder="Lời chúc khích lệ học tập..."
                  placeholderTextColor="#64748B"
                  style={styles.darkInput}
                />

                <Button
                  variant="reward"
                  icon="gift"
                  onPress={() => void triggerGiftSend(recipientId, recipientName)}
                  fullWidth
                >
                  Gửi Tặng Ngay Tới «{recipientName}»
                </Button>
              </View>
            )}

            {/* ── SECTION 5: MODERATION QUEUE ── */}
            {section === 'moderation' && (
              <View style={styles.panelCard}>
                <Text style={styles.panelTitle}>🛡️ Hàng Đợi Kiểm Duyệt Báo Cáo Câu Hỏi ({reports.length})</Text>
                {reports.length === 0 ? (
                  <Text style={{ color: '#94A3B8', marginTop: 12 }}>
                    Tuyệt vời — Hiện không có báo cáo vi phạm hoặc câu hỏi lỗi nào tồn đọng.
                  </Text>
                ) : (
                  <View style={{ gap: 10, marginTop: 12 }}>
                    {reports.map((r) => (
                      <View key={r.id} style={styles.tableDataRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{r.reason}</Text>
                          <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{r.questionPreview}</Text>
                        </View>
                        {r.status === 'open' ? (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Button variant="success" onPress={() => updateReportStatus(r.id, 'reviewed')}>
                              Đã xử lý
                            </Button>
                            <Button variant="ghost" onPress={() => updateReportStatus(r.id, 'dismissed')}>
                              Bỏ qua
                            </Button>
                          </View>
                        ) : (
                          <Badge tone="success">{r.status}</Badge>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── SECTION 6: DUOLINGO-STYLE PUSH CAMPAIGNS & SYSTEM BROADCASTS ── */}
            {section === 'campaigns' && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>🦉 Mẫu Chiến Dịch Nhắc Học Tự Động (Chuẩn Duolingo)</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12.5, marginTop: 4, marginBottom: 12 }}>
                    Hệ thống tự động theo dõi phiên học dang dở và chu kỳ 20 giờ không truy cập qua Service Worker / Local Push. Bạn cũng có thể kích hoạt chiến dịch ngay lập tức:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      variant="reward"
                      icon="flame"
                      onPress={() =>
                        handleBroadcastCampaign(
                          '🔥 Cảnh báo đóng băng chuỗi Streak 20h!',
                          'Papybot thấy bạn chưa hoàn thành mục tiêu hôm nay — vào làm 5 câu tốc độ để giữ chuỗi ngay nhé!'
                        )
                      }
                    >
                      Nhắc Giữ Chuỗi 20h
                    </Button>
                    <Button
                      variant="secondary"
                      icon="document-text-outline"
                      onPress={() =>
                        handleBroadcastCampaign(
                          '📜 Bài học dang dở đang chờ bạn!',
                          'Chỉ còn vài câu hỏi nữa là hoàn tất bộ đề đang học — quay lại nhận trọn vẹn XP nào!'
                        )
                      }
                    >
                      Nhắc Bài Học Dang Dở
                    </Button>
                    <Button
                      variant="primary"
                      icon="rocket-outline"
                      onPress={() => {
                        setBroadcastKind('update');
                        handleBroadcastCampaign(
                          '✨ Bản cập nhật Đấu Trường 3D Mới!',
                          'Thử ngay Cung Thủ Thiên Thạch 3D và Giả Kim Phân Loại 3D vừa ra mắt trên Papyrus!'
                        );
                      }}
                    >
                      Thông Báo Tính Năng Mới
                    </Button>
                  </View>
                </View>

                <View style={styles.panelCard}>
                  <Text style={styles.panelTitle}>📢 Soạn Thông Báo Đẩy Tùy Chỉnh Toàn Hệ Thống</Text>
                  <View style={{ gap: 8, marginTop: 10 }}>
                    <TextInput
                      value={broadcastTitle}
                      onChangeText={setBroadcastTitle}
                      placeholder="Tiêu đề thông báo đẩy (hiển thị cả ngoài màn hình khóa / trình duyệt)..."
                      placeholderTextColor="#64748B"
                      style={styles.darkInput}
                    />
                    <TextInput
                      value={broadcastBody}
                      onChangeText={setBroadcastBody}
                      multiline
                      placeholder="Nội dung chi tiết gửi đến tất cả thiết bị..."
                      placeholderTextColor="#64748B"
                      style={[styles.darkInput, { minHeight: 84, textAlignVertical: 'top' }]}
                    />
                    <Button variant="primary" icon="megaphone-outline" onPress={() => handleBroadcastCampaign()} fullWidth>
                      Phát Sóng Tới Toàn Bộ Người Dùng ({notifications.length} đã gửi)
                    </Button>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Mobile Slide-Over Offcanvas Sidebar Drawer */}
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
                <Text style={styles.sidebarSub}>Mobile Ops Console</Text>
              </View>
              <Pressable onPress={() => setMobileDrawerOpen(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </Pressable>
            </View>
            <View style={{ gap: 6, marginTop: spacing.md, flex: 1 }}>
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
                    <Ionicons name={item.icon} size={18} color={active ? '#38BDF8' : '#94A3B8'} />
                    <Text style={[styles.sidebarItemText, active && { color: '#F8FAFC', fontWeight: '800' }]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

      {/* Mobile Contextual Bottom Inspector Sheet when tapping a User */}
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
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1120',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
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

  // Sidebar
  sidebar: {
    width: 248,
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
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.30)',
  },
  sidebarItemText: { color: '#94A3B8', fontSize: 13, fontWeight: '700', flex: 1 },
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

  // Top Command Bar
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
    minWidth: 155,
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
  kpiValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginTop: 8, fontVariant: ['tabular-nums'] },
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
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#1E293B', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  tableHeadRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  thText: { color: '#64748B', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
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
  tdNum: { fontSize: 13, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums'] },
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
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(99,102,241,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inspector
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
  inspectorTabs: { flexDirection: 'row', gap: 6, backgroundColor: '#0B1120', padding: 4, borderRadius: 10 },
  inspectorTabBtn: { flex: 1, paddingVertical: 6, borderRadius: 7, alignItems: 'center' },
  inspectorTabBtnActive: { backgroundColor: '#4F46E5' },
  inspectorTabText: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  inspectorMetricGrid: { flexDirection: 'row', gap: 8 },
  inspectorMetricBox: {
    flex: 1,
    backgroundColor: '#0B1120',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inspectorMetricLabel: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  inspectorMetricVal: { color: '#F8FAFC', fontSize: 15, fontWeight: '900', marginTop: 4 },

  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(2, 6, 23, 0.72)' },
  mobileDrawer: {
    width: 276,
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
    padding: spacing.sm,
  },
});
