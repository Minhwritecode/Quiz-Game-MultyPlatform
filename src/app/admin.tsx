import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Badge, BrandMark, Button, Card, Screen, SmoothReveal } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useModerationStore } from '@/features/moderation/state/useModerationStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { listAllUsersForAdmin, type AdminUserSummary } from '@/composition/platform';
import { seedQuestionSets } from '@/composition/preferences';
import { sfx } from '@/core/audio/sfx';

type AdminTab = 'overview' | 'gifts' | 'users' | 'content' | 'broadcast';

const ADMIN_USER = (process.env.EXPO_PUBLIC_ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ADMIN_PASS = process.env.EXPO_PUBLIC_ADMIN_PASSWORD || 'Papyrus@2026';

export default function AdminPortalScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  // Separate Admin Portal Auth Gate (completely independent of user accounts)
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Admin Console State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Gift Center State
  const [recipientId, setRecipientId] = useState<string>('all');
  const [recipientName, setRecipientName] = useState<string>('Tất cả người dùng');
  const [giftType, setGiftType] = useState<AdminGiftItem['giftType']>('question_set');
  const [selectedSetId, setSelectedSetId] = useState<string>(seedQuestionSets[0]?.id ?? '');
  const [customTitle, setCustomTitle] = useState('');
  const [customDocText, setCustomDocText] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftNotice, setGiftNotice] = useState('');

  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastKind, setBroadcastKind] = useState<'system' | 'update'>('system');
  const [broadcastNotice, setBroadcastNotice] = useState('');

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
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void listAllUsersForAdmin()
      .then((list) => {
        if (active) setUsers(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authenticated]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.displayName} ${u.id}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  const handleAdminLogin = () => {
    setLoginError('');
    if (username.trim().toLowerCase() === ADMIN_USER && password === ADMIN_PASS) {
      setAuthenticated(true);
      setPassword('');
      sfx.playLevelUp();
    } else {
      setLoginError('Sai tên đăng nhập hoặc mật khẩu Quản trị viên.');
      sfx.playWrong();
    }
  };

  const handleSendGift = async () => {
    setGiftNotice('');
    if (giftType === 'question_set') {
      const targetSet = allSets.find((s) => s.id === selectedSetId);
      if (!targetSet) {
        setGiftNotice('Vui lòng chọn bộ câu hỏi hợp lệ để tặng.');
        return;
      }
      await sendGift({
        recipientId,
        recipientName,
        giftType: 'question_set',
        title: customTitle.trim() || targetSet.title,
        message: giftMessage.trim() || `Quản trị viên gửi tặng bạn bộ đề "${targetSet.title}" (${targetSet.questions.length} câu hỏi).`,
        questionSet: targetSet,
      });
    } else if (giftType === 'study_document') {
      if (customDocText.trim().length < 20) {
        setGiftNotice('Nội dung tài liệu tặng cần ít nhất 20 ký tự.');
        return;
      }
      await sendGift({
        recipientId,
        recipientName,
        giftType: 'study_document',
        title: customTitle.trim() || 'Tài liệu ôn thi đặc biệt từ Admin',
        message: giftMessage.trim() || 'Mở Hồ sơ hoặc Thông báo để nhận tài liệu và tạo Quiz AI ngay!',
        documentText: customDocText.trim(),
      });
    } else if (giftType === 'vip_days') {
      await sendGift({
        recipientId,
        recipientName,
        giftType: 'vip_days',
        title: customTitle.trim() || 'Đặc quyền VIP Archmage',
        message: giftMessage.trim() || 'Chúc mừng bạn được Quản trị viên nâng cấp đặc quyền VIP Archmage!',
      });
    } else {
      await sendGift({
        recipientId,
        recipientName,
        giftType: 'streak_freeze',
        title: customTitle.trim() || '+2 Bùa Đóng Băng Chuỗi',
        message: giftMessage.trim() || 'Tặng bạn +2 Bùa Đóng Băng để bảo vệ chuỗi học tập liên tiếp!',
      });
    }

    sfx.playLevelUp();
    setCustomTitle('');
    setCustomDocText('');
    setGiftMessage('');
    setGiftNotice(`✅ Đã gửi quà tặng thành công tới "${recipientName}" kèm thông báo đẩy!`);
  };

  const handleSendBroadcast = () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      setBroadcastNotice('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.');
      return;
    }
    pushNotification(
      {
        recipientId: 'all',
        kind: broadcastKind,
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        actionRoute: '/',
      },
      true
    );
    sfx.playCorrect();
    setBroadcastTitle('');
    setBroadcastBody('');
    setBroadcastNotice('✅ Đã phát thông báo toàn hệ thống (trong ứng dụng & Push)! ');
  };

  // ── 1. DEDICATED ADMIN LOGIN GATE ──
  if (!authenticated) {
    return (
      <View style={styles.rootDark}>
        <Screen transparent>
          <View style={styles.loginShell}>
            <SmoothReveal style={{ width: '100%', maxWidth: 440 }}>
              <Card color="#0F172A" style={styles.loginCard}>
                <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                  <BrandMark size={64} />
                  <View style={styles.adminPill}>
                    <Ionicons name="shield-checkmark" size={13} color="#FDE68A" />
                    <Text style={styles.adminPillText}>PAPYRUS ADMIN PORTAL</Text>
                  </View>
                  <Text style={[typography.heading, { color: '#F8FAFC', marginTop: spacing.xs, textAlign: 'center' }]}>
                    Đăng nhập Quản trị viên
                  </Text>
                  <Text style={[typography.caption, { color: '#94A3B8', textAlign: 'center', marginTop: 4 }]}>
                    Hệ thống quản trị độc lập — quản lý người dùng, kho đề Đại học, kiểm duyệt và tặng tài liệu.
                  </Text>
                </View>

                {loginError ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#FCA5A5" />
                    <Text style={{ color: '#FCA5A5', fontSize: 12.5, fontWeight: '700', flex: 1 }}>{loginError}</Text>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>TÊN ĐĂNG NHẬP ADMIN</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="admin"
                  placeholderTextColor="#64748B"
                  style={styles.darkInput}
                />

                <Text style={styles.fieldLabel}>MẬT KHẨU QUẢN TRỊ</Text>
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
                  <Pressable onPress={() => setShowPass((v) => !v)} style={{ paddingHorizontal: 10 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                  </Pressable>
                </View>

                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Button variant="reward" icon="shield-checkmark-outline" onPress={handleAdminLogin} fullWidth>
                    Vào Bảng Điều Khiển Admin
                  </Button>
                  <Button variant="ghost" icon="arrow-back" onPress={() => router.replace('/')} fullWidth>
                    Quay lại ứng dụng Papyrus
                  </Button>
                </View>

                <View style={styles.credHint}>
                  <Ionicons name="key-outline" size={14} color="#818CF8" />
                  <Text style={{ color: '#94A3B8', fontSize: 11.5, flex: 1 }}>
                    Tài khoản mặc định: <Text style={{ color: '#E0E7FF', fontWeight: '800' }}>admin</Text> · Mật khẩu: <Text style={{ color: '#FDE68A', fontWeight: '800' }}>Papyrus@2026</Text>
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

  // ── 2. EXECUTIVE ADMIN CONSOLE ──
  return (
    <View style={styles.rootDark}>
      <Screen transparent>
        {/* Top Executive Header */}
        <View style={styles.execHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }}>
            <BrandMark size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.execEyebrow}>PAPYRUS EXECUTIVE CONSOLE</Text>
              <Text style={[typography.title, { color: '#FFFFFF' }]} numberOfLines={1}>
                Trung tâm Quản trị Hệ thống
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => router.replace('/')} style={styles.headerActionBtn}>
              <Ionicons name="home-outline" size={16} color="#E0E7FF" />
              <Text style={styles.headerActionText}>App</Text>
            </Pressable>
            <Pressable
              onPress={() => setAuthenticated(false)}
              style={[styles.headerActionBtn, { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.16)' }]}
            >
              <Ionicons name="lock-closed-outline" size={16} color="#FCA5A5" />
              <Text style={[styles.headerActionText, { color: '#FCA5A5' }]}>Khóa</Text>
            </Pressable>
          </View>
        </View>

        {/* Navigation Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {(
            [
              { id: 'overview', label: 'Tổng quan', icon: 'analytics-outline' as const },
              { id: 'gifts', label: '🎁 Tặng tài liệu / Đề', icon: 'gift-outline' as const },
              { id: 'users', label: `Người dùng (${users.length})`, icon: 'people-outline' as const },
              { id: 'content', label: `Kho đề & Duyệt (${allSets.length})`, icon: 'library-outline' as const },
              { id: 'broadcast', label: 'Phát thông báo', icon: 'megaphone-outline' as const },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: active ? '#4F46E5' : 'rgba(15, 23, 42, 0.85)',
                    borderColor: active ? '#818CF8' : 'rgba(148, 163, 184, 0.22)',
                  },
                ]}
              >
                <Ionicons name={tab.icon} size={15} color={active ? '#FFFFFF' : '#94A3B8'} />
                <Text style={{ color: active ? '#FFFFFF' : '#CBD5E1', fontSize: 12.5, fontWeight: '800' }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* TAB 1: OVERVIEW KPI DASHBOARD */}
        {activeTab === 'overview' && (
          <View style={{ gap: spacing.md }}>
            <View style={[styles.kpiGrid, isWide && styles.kpiGridWide]}>
              <KpiTile icon="people" color="#6366F1" label="Người dùng Cloud" value={String(users.length)} />
              <KpiTile icon="book" color="#10B981" label="Bộ câu hỏi chuẩn" value={String(allSets.length)} />
              <KpiTile icon="help-circle" color="#38BDF8" label="Tổng số câu hỏi" value={String(totalQuestions)} />
              <KpiTile icon="gift" color="#F59E0B" label="Quà đã gửi tặng" value={String(gifts.length)} />
              <KpiTile icon="flag" color="#EF4444" label="Báo cáo chờ duyệt" value={String(openReports.length)} />
              <KpiTile icon="notifications" color="#A78BFA" label="Thông báo hệ thống" value={String(notifications.length)} />
            </View>

            <Card color="#0F172A" style={styles.panelCard}>
              <Text style={styles.panelTitle}>⚡ Thao tác nhanh cho Quản trị viên</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button variant="reward" icon="gift-outline" onPress={() => setActiveTab('gifts')}>
                  Tặng bộ đề / tài liệu ngay
                </Button>
                <Button variant="primary" icon="megaphone-outline" onPress={() => setActiveTab('broadcast')}>
                  Gửi thông báo toàn hệ thống
                </Button>
                <Button variant="secondary" icon="refresh" onPress={() => void refreshUsers()}>
                  {loadingUsers ? 'Đang tải...' : 'Làm mới dữ liệu Cloud'}
                </Button>
              </View>
            </Card>
          </View>
        )}

        {/* TAB 2: GIFT CENTER (Tặng tài liệu / bộ câu hỏi cho bất kỳ user nào) */}
        {activeTab === 'gifts' && (
          <View style={{ gap: spacing.md }}>
            <Card color="#0F172A" style={styles.panelCard}>
              <Text style={styles.panelTitle}>🎁 Gửi tặng Bộ câu hỏi / Tài liệu cho Người dùng</Text>
              <Text style={styles.panelSub}>
                Chọn người dùng bất kỳ (hoặc toàn bộ người dùng), chọn bộ câu hỏi hoặc tài liệu học tập — hệ thống sẽ gửi thẳng vào Hồ sơ, Thư viện & Thông báo đẩy của họ.
              </Text>

              {/* Step 1: Pick Recipient */}
              <Text style={styles.fieldLabel}>1. CHỌN NGƯỜI NHẬN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
                <Pressable
                  onPress={() => {
                    setRecipientId('all');
                    setRecipientName('Tất cả người dùng');
                  }}
                  style={[
                    styles.pickPill,
                    recipientId === 'all' && styles.pickPillActive,
                  ]}
                >
                  <Text style={styles.pickPillText}>🌍 Tất cả người dùng</Text>
                </Pressable>
                {users.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => {
                      setRecipientId(u.id);
                      setRecipientName(u.displayName);
                    }}
                    style={[
                      styles.pickPill,
                      recipientId === u.id && styles.pickPillActive,
                    ]}
                  >
                    <Text style={styles.pickPillText}>👤 {u.displayName}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Step 2: Gift Type */}
              <Text style={styles.fieldLabel}>2. LOẠI QUÀ TẶNG</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm }}>
                {(
                  [
                    { id: 'question_set', label: '📚 Bộ câu hỏi (20+ Đại học)' },
                    { id: 'study_document', label: '📄 Tài liệu / Giáo trình' },
                    { id: 'vip_days', label: '👑 Gói VIP Archmage' },
                    { id: 'streak_freeze', label: '❄️ +2 Bùa Đóng Băng' },
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setGiftType(item.id)}
                    style={[styles.pickPill, giftType === item.id && styles.pickPillActive]}
                  >
                    <Text style={styles.pickPillText}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Step 3: Payload */}
              {giftType === 'question_set' && (
                <>
                  <Text style={styles.fieldLabel}>3. CHỌN BỘ CÂU HỎI TẶNG ({allSets.length} BỘ)</Text>
                  <ScrollView style={{ maxHeight: 190, marginBottom: spacing.sm }}>
                    {allSets.map((s) => {
                      const active = selectedSetId === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => setSelectedSetId(s.id)}
                          style={[
                            styles.setSelectRow,
                            {
                              backgroundColor: active ? 'rgba(79,70,229,0.28)' : 'rgba(255,255,255,0.03)',
                              borderColor: active ? '#818CF8' : 'rgba(148,163,184,0.18)',
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>{s.title}</Text>
                            <Text style={{ color: '#94A3B8', fontSize: 11 }}>
                              {s.subject} · {s.questions.length} câu hỏi
                            </Text>
                          </View>
                          {active && <Ionicons name="checkmark-circle" size={18} color="#34D399" />}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {giftType === 'study_document' && (
                <>
                  <Text style={styles.fieldLabel}>3. NỘI DUNG TÀI LIỆU / GIÁO TRÌNH TẶNG</Text>
                  <TextInput
                    value={customDocText}
                    onChangeText={setCustomDocText}
                    multiline
                    placeholder="Dán nội dung giáo trình, đề cương ôn thi hoặc bài giảng muốn tặng người dùng..."
                    placeholderTextColor="#64748B"
                    style={[styles.darkInput, { minHeight: 100, textAlignVertical: 'top' }]}
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>TIÊU ĐỀ QUÀ TẶNG (TUỲ CHỌN)</Text>
              <TextInput
                value={customTitle}
                onChangeText={setCustomTitle}
                placeholder="Vd: Bộ đề Ôn thi Cuối kỳ Hệ điều hành..."
                placeholderTextColor="#64748B"
                style={styles.darkInput}
              />

              <Text style={styles.fieldLabel}>LỜI NHẮN TỪ QUẢN TRỊ VIÊN</Text>
              <TextInput
                value={giftMessage}
                onChangeText={setGiftMessage}
                placeholder="Chúc bạn ôn thi thật tốt và đạt điểm A+!"
                placeholderTextColor="#64748B"
                style={styles.darkInput}
              />

              {!!giftNotice && (
                <Text style={{ color: '#34D399', fontSize: 12.5, fontWeight: '700', marginBottom: spacing.sm }}>
                  {giftNotice}
                </Text>
              )}

              <Button variant="reward" icon="gift" onPress={() => void handleSendGift()} fullWidth>
                Gửi quà tặng tới {recipientName}
              </Button>
            </Card>

            {/* Gift History */}
            <Card color="#0F172A" style={styles.panelCard}>
              <Text style={styles.panelTitle}>📜 Lịch sử Quà tặng đã gửi ({gifts.length})</Text>
              {gifts.length === 0 ? (
                <Text style={styles.panelSub}>Chưa có quà tặng nào được gửi trong phiên này.</Text>
              ) : (
                gifts.slice(0, 12).map((g) => (
                  <View key={g.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>{g.title}</Text>
                      <Text style={{ color: '#94A3B8', fontSize: 11.5 }}>
                        Người nhận: {g.recipientName} · {new Date(g.createdAt).toLocaleString('vi-VN')}
                      </Text>
                    </View>
                    <Badge tone="reward">{g.giftType}</Badge>
                  </View>
                ))
              )}
            </Card>
          </View>
        )}

        {/* TAB 3: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <Card color="#0F172A" style={styles.panelCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={styles.panelTitle}>👥 Danh sách Học giả ({filteredUsers.length})</Text>
              <Pressable onPress={() => void refreshUsers()}>
                <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '700' }}>Làm mới</Text>
              </Pressable>
            </View>
            <TextInput
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Tìm tên hiển thị hoặc ID người dùng..."
              placeholderTextColor="#64748B"
              style={styles.darkInput}
            />
            {filteredUsers.length === 0 ? (
              <Text style={styles.panelSub}>Chưa tìm thấy người dùng khớp bộ lọc.</Text>
            ) : (
              filteredUsers.map((u) => (
                <View key={u.id} style={styles.listRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                      {u.displayName}
                    </Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11.5 }}>
                      {u.eloRating} ELO · {u.totalScore.toLocaleString('vi-VN')} XP · {u.gamesPlayed} trận
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setRecipientId(u.id);
                      setRecipientName(u.displayName);
                      setActiveTab('gifts');
                    }}
                    style={styles.quickGiftBtn}
                  >
                    <Ionicons name="gift-outline" size={14} color="#0F172A" />
                    <Text style={{ color: '#0F172A', fontSize: 11.5, fontWeight: '800' }}>Tặng quà</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        )}

        {/* TAB 4: LIBRARY & MODERATION */}
        {activeTab === 'content' && (
          <View style={{ gap: spacing.md }}>
            <Card color="#0F172A" style={styles.panelCard}>
              <Text style={styles.panelTitle}>🚩 Báo cáo câu hỏi cần kiểm duyệt ({openReports.length})</Text>
              {openReports.length === 0 ? (
                <Text style={styles.panelSub}>Không còn báo cáo mở nào. Hệ thống sạch sẽ!</Text>
              ) : (
                openReports.map((r) => (
                  <View key={r.id} style={styles.listRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>{r.questionPreview}</Text>
                      <Text style={{ color: '#FCA5A5', fontSize: 11.5 }}>Lý do: {r.reason}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable onPress={() => void updateReportStatus(r.id, 'reviewed')} style={[styles.quickGiftBtn, { backgroundColor: '#10B981' }]}>
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Duyệt</Text>
                      </Pressable>
                      <Pressable onPress={() => void updateReportStatus(r.id, 'dismissed')} style={[styles.quickGiftBtn, { backgroundColor: '#475569' }]}>
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Bỏ qua</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card color="#0F172A" style={styles.panelCard}>
              <Text style={styles.panelTitle}>📚 Toàn bộ Kho đề Đại học & Người dùng ({allSets.length} bộ)</Text>
              {allSets.map((s) => (
                <View key={s.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13.5 }}>{s.title}</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 11.5 }}>
                      {s.subject} · {s.questions.length} câu hỏi
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setGiftType('question_set');
                      setSelectedSetId(s.id);
                      setActiveTab('gifts');
                    }}
                    style={styles.quickGiftBtn}
                  >
                    <Ionicons name="gift-outline" size={13} color="#0F172A" />
                    <Text style={{ color: '#0F172A', fontSize: 11, fontWeight: '800' }}>Tặng bộ này</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* TAB 5: BROADCAST NOTIFICATIONS */}
        {activeTab === 'broadcast' && (
          <Card color="#0F172A" style={styles.panelCard}>
            <Text style={styles.panelTitle}>📣 Phát Thông báo Toàn Hệ thống</Text>
            <Text style={styles.panelSub}>
              Thông báo sẽ xuất hiện trong Trung tâm Thông báo (biểu tượng chuông) và bắn thông báo đẩy ra ngoài ứng dụng nếu người dùng đã bật.
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.sm }}>
              <Pressable
                onPress={() => setBroadcastKind('system')}
                style={[styles.pickPill, broadcastKind === 'system' && styles.pickPillActive]}
              >
                <Text style={styles.pickPillText}>📢 Thông báo chung</Text>
              </Pressable>
              <Pressable
                onPress={() => setBroadcastKind('update')}
                style={[styles.pickPill, broadcastKind === 'update' && styles.pickPillActive]}
              >
                <Text style={styles.pickPillText}>🚀 Bản cập nhật mới</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>TIÊU ĐỀ THÔNG BÁO</Text>
            <TextInput
              value={broadcastTitle}
              onChangeText={setBroadcastTitle}
              placeholder="Vd: Papyrus 2.5 đã cập nhật thêm đề thi mới!"
              placeholderTextColor="#64748B"
              style={styles.darkInput}
            />

            <Text style={styles.fieldLabel}>NỘI DUNG CHI TIẾT</Text>
            <TextInput
              value={broadcastBody}
              onChangeText={setBroadcastBody}
              multiline
              placeholder="Nhập nội dung thông báo gửi đến toàn bộ học giả..."
              placeholderTextColor="#64748B"
              style={[styles.darkInput, { minHeight: 90, textAlignVertical: 'top' }]}
            />

            {!!broadcastNotice && (
              <Text style={{ color: '#34D399', fontSize: 12.5, fontWeight: '700', marginBottom: spacing.sm }}>
                {broadcastNotice}
              </Text>
            )}

            <Button variant="primary" icon="send" onPress={handleSendBroadcast} fullWidth>
              Phát thông báo ngay
            </Button>
          </Card>
        )}
      </Screen>
    </View>
  );
}

function KpiTile({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.kpiTile}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[typography.heading, { color: '#FFFFFF', fontSize: 22, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rootDark: { flex: 1, backgroundColor: '#060A24' },
  loginShell: { flex: 1, minHeight: 620, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl },
  loginCard: { padding: spacing.xl, borderRadius: radii.lg, borderColor: 'rgba(129, 140, 248, 0.35)', borderWidth: 1 },
  adminPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.4)',
  },
  adminPillText: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    marginBottom: spacing.sm,
  },
  fieldLabel: { color: '#A5B4FC', fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6, marginTop: 6 },
  darkInput: {
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    backgroundColor: '#0B112B',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    backgroundColor: '#0B112B',
    marginBottom: spacing.xs,
  },
  credHint: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  execHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  execEyebrow: { color: '#FDE68A', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  headerActionText: { color: '#E0E7FF', fontSize: 12, fontWeight: '700' },
  tabBar: { gap: 8, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiGridWide: { gap: spacing.md },
  kpiTile: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.24)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  kpiIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  panelCard: { padding: spacing.lg, borderRadius: radii.md, borderColor: 'rgba(129, 140, 248, 0.24)', borderWidth: 1 },
  panelTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  panelSub: { color: '#94A3B8', fontSize: 12.5, lineHeight: 19, marginTop: 4, marginBottom: spacing.sm },
  pickPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  pickPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#A5B4FC',
  },
  pickPillText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  setSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.14)',
  },
  quickGiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
});
