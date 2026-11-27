import { errorMessage } from '@/core/domain/failure';
import { createElement, useCallback, useEffect, useState } from 'react';
import { AppIcon, type IconName } from '@/shared/AppIcon';
import { useRouter } from 'expo-router';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Badge, BrandMark, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  deleteRegisteredPasskey,
  disableTotp2FA,
  isPlatformPasskeyAvailable,
  loadUserSecuritySnapshot,
  registerNewPasskey,
  renameRegisteredPasskey,
  revokeAllOtherDeviceSessions,
  revokeDeviceSession,
  type PendingTotpEnrollment,
  type UserSecuritySnapshot,
} from '@/composition/platform';
import { useAuthStore } from '@/core/state/useAuthStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';
import { VipCheckoutModal } from '@/features/membership/presentation/VipCheckoutModal';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import { useOnboardingStore } from '@/core/state/useOnboardingStore';

function PreferenceRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
        <AppIcon name={icon} size={20} color={palette.indigo} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>{title}</Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, setLanguage, t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const theme = usePapyrusStore((s) => s.theme);
  const setTheme = usePapyrusStore((s) => s.setTheme);
  const haptics = usePapyrusStore((state) => state.haptics);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const toggleHaptics = usePapyrusStore((state) => state.toggleHaptics);
  const toggleReduceMotion = usePapyrusStore((state) => state.toggleReduceMotion);
  const questionSetCount = usePapyrusStore((s) => s.questionSets.length);
  const membershipTier = useMembershipStore((s) => s.tier);

  const [reminder, setReminder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [billingOpen, setBillingOpen] = useState(false);
  const [cacheNotice, setCacheNotice] = useState('');
  const [clearingCache, setClearingCache] = useState(false);

  // Security Center State (Passkeys + 2FA + Active Devices)
  const [securitySnap, setSecuritySnap] = useState<UserSecuritySnapshot | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [secBusy, setSecBusy] = useState(false);
  const [secNotice, setSecNotice] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // 2FA Enrollment Modal State
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [pendingTotp, setPendingTotp] = useState<PendingTotpEnrollment | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

  // Instant Logout Confirmation Dialog State (Web native <dialog> + Mobile <Modal>)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const refreshSecurity = useCallback(async () => {
    const [supported, snap] = await Promise.all([
      isPlatformPasskeyAvailable(),
      user ? loadUserSecuritySnapshot() : Promise.resolve(null),
    ]);
    setPasskeySupported(supported);
    setSecuritySnap(snap);
  }, [user]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      isPlatformPasskeyAvailable(),
      user ? loadUserSecuritySnapshot() : Promise.resolve(null),
    ]).then(([supported, snap]) => {
      if (!active) return;
      setPasskeySupported(supported);
      setSecuritySnap(snap);
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const refresh = () => {
      void dependencies.reminders.enabled().then(setReminder).catch(() => undefined);
    };
    refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => listener.remove();
  }, []);

  const toggleReminder = async (value: boolean) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await dependencies.reminders.setEnabled(value);
      setReminder(value);
    } catch (e) {
      setNotice(errorMessage(e, 'Không đổi được lịch nhắc.'));
    } finally {
      setBusy(false);
    }
  };

  const handleClearStudyDraftsCache = async () => {
    if (clearingCache) return;
    setClearingCache(true);
    setCacheNotice('');
    try {
      const drafts = await dependencies.study.listProgress();
      for (const d of drafts) {
        await dependencies.study.clearProgress(d.questionSetId);
      }
      usePapyrusStore.getState().clearSourceDocument();
      setCacheNotice(
        language === 'vi'
          ? `✅ Đã dọn ${drafts.length} phiên học dở & bản nháp OCR tạm (bộ đề & lịch sử vẫn giữ nguyên).`
          : `✅ Cleared ${drafts.length} study draft(s) and temporary OCR buffer.`
      );
    } catch {
      setCacheNotice(language === 'vi' ? 'Không thể dọn bộ nhớ tạm lúc này.' : 'Could not clear local cache.');
    } finally {
      setClearingCache(false);
    }
  };

  // Security Handlers
  const handleCreatePasskey = async () => {
    if (secBusy) return;
    setSecBusy(true);
    setSecNotice('');
    try {
      const res = await registerNewPasskey();
      setSecNotice(res.message);
      if (res.ok) await refreshSecurity();
    } finally {
      setSecBusy(false);
    }
  };

  const handleDeletePasskey = async (credId: string) => {
    setSecBusy(true);
    try {
      await deleteRegisteredPasskey(credId);
      await refreshSecurity();
      setSecNotice('🗑️ Đã xóa Passkey và đồng bộ với trình quản lý mật khẩu.');
    } finally {
      setSecBusy(false);
    }
  };

  const handleSavePasskeyRename = async (credId: string) => {
    if (!renameDraft.trim()) {
      setRenamingId(null);
      return;
    }
    setSecBusy(true);
    try {
      await renameRegisteredPasskey(credId, renameDraft);
      setRenamingId(null);
      setRenameDraft('');
      await refreshSecurity();
    } finally {
      setSecBusy(false);
    }
  };

  const handleOpen2FAEnrollment = async () => {
    setSecBusy(true);
    setSecNotice('');
    try {
      const enrolled = await beginTotpEnrollment();
      setPendingTotp(enrolled);
      setTotpCode('');
      setNewBackupCodes([]);
      setTotpModalOpen(true);
    } finally {
      setSecBusy(false);
    }
  };

  const handleVerify2FAEnrollment = async () => {
    if (!pendingTotp || secBusy) return;
    setSecBusy(true);
    try {
      const res = await confirmTotpEnrollment(pendingTotp, totpCode);
      setSecNotice(res.message);
      if (res.ok) {
        setNewBackupCodes(res.backupCodes ?? []);
        await refreshSecurity();
      }
    } finally {
      setSecBusy(false);
    }
  };

  const handleDisable2FA = async () => {
    setSecBusy(true);
    try {
      await disableTotp2FA();
      await refreshSecurity();
      setSecNotice('Đã tắt Xác thực 2 lớp (2FA) cho tài khoản này.');
    } finally {
      setSecBusy(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setSecBusy(true);
    try {
      await revokeDeviceSession(deviceId);
      await refreshSecurity();
      setSecNotice('✅ Đã đăng xuất thiết bị được chọn khỏi tài khoản.');
    } finally {
      setSecBusy(false);
    }
  };

  const handleRevokeAllOthers = async () => {
    setSecBusy(true);
    try {
      await revokeAllOtherDeviceSessions();
      await refreshSecurity();
      setSecNotice('🛡️ Đã đăng xuất khỏi toàn bộ các thiết bị khác!');
    } finally {
      setSecBusy(false);
    }
  };

  // Open Logout Confirmation Dialog (Native HTML <dialog>.showModal() on Web, <Modal> on Mobile)
  const promptLogoutConfirmation = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const dlg = document.getElementById('papyrus-logout-dialog') as HTMLDialogElement | null;
      if (dlg && typeof dlg.showModal === 'function') {
        dlg.returnValue = '';
        dlg.showModal();
        return;
      }
    }
    setLogoutConfirmOpen(true);
  };

  // Instant Zero-Lag Optimistic Sign-Out (< 20ms UI response!)
  const executeInstantSignOut = useCallback(() => {
    setLogoutConfirmOpen(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const dlg = document.getElementById('papyrus-logout-dialog') as HTMLDialogElement | null;
      if (dlg?.open) dlg.close('');
    }
    // 1. Clear local auth & switch ALL user-scoped stores immediately so UI reacts in < 20ms with zero cross-account leak!
    useAuthStore.getState().clear();
    usePapyrusStore.getState().switchAccountScope('guest');
    useStreakStore.getState().switchAccountScope('guest');
    useMembershipStore.getState().switchAccountScope('guest');
    useSocialStore.getState().switchAccountScope('guest');
    router.replace('/auth');
    // 2. Clean up Supabase session asynchronously in background without blocking navigation
    void dependencies.auth.signOut().catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dlg = document.getElementById('papyrus-logout-dialog') as HTMLDialogElement | null;
    if (!dlg) return;
    const onClose = () => {
      const choice = dlg.returnValue;
      dlg.returnValue = '';
      if (choice === 'confirm-logout') {
        executeInstantSignOut();
      }
    };
    dlg.addEventListener('close', onClose);
    return () => dlg.removeEventListener('close', onClose);
  }, [executeInstantSignOut, user]);

  return (
    <Screen bottomNav>
      <TopBar title={t.settings.title} />

      {/* User Profile Card */}
      <Card style={styles.profile}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.profileMainTap, { opacity: pressed ? 0.78 : 1 }]}
        >
          <BrandMark size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.title, { color: palette.ink }]} numberOfLines={1}>
              {user?.displayName ?? (user?.email ? user.email.split('@')[0] : t.settings.guestName)}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]} numberOfLines={2}>
              {user ? user.email || t.settings.authStatus : t.settings.guestStatus}
            </Text>
          </View>
        </Pressable>
        {user ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Badge tone="success">{t.settings.badgeAuth}</Badge>
            <AppIcon name="chevron-forward" size={18} color={palette.inkMuted} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [
              styles.profileSignInPill,
              { backgroundColor: palette.indigo, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.onPrimary }}>
              {language === 'vi' ? 'Đăng nhập' : 'Sign in'}
            </Text>
          </Pressable>
        )}
      </Card>

      {/* ── SECURITY CENTER: PASSKEYS · 2FA · ACTIVE LOGIN DEVICES ── */}
      {user && (
        <>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
            🛡️ Bảo mật Tài khoản, Passkey & Thiết bị
          </Text>

          <Card style={{ gap: 14 }}>
            {!!secNotice && (
              <View style={[styles.secBanner, { backgroundColor: palette.indigoTint }]}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigoDeep }}>{secNotice}</Text>
              </View>
            )}

            {/* 1. Passkey Management */}
            <View style={{ gap: 8 }}>
              <View style={styles.secHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <AppIcon name="finger-print-outline" size={20} color={palette.indigo} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                      Khóa đăng nhập Passkey (FIDO2)
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      Đăng nhập 1 chạm bằng Face ID, Touch ID hoặc Windows Hello không cần mật khẩu
                    </Text>
                  </View>
                </View>
                {passkeySupported ? (
                  <Button
                    variant="secondary"
                    icon="add-circle-outline"
                    disabled={secBusy}
                    onPress={() => void handleCreatePasskey()}
                  >
                    Tạo Passkey
                  </Button>
                ) : (
                  <Badge tone="neutral">Ưu tiên 2FA</Badge>
                )}
              </View>

              {(securitySnap?.passkeys.length ?? 0) === 0 ? (
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  {passkeySupported
                    ? 'Chưa có Passkey nào được đăng ký. Bấm «Tạo Passkey» để kích hoạt mở khóa sinh trắc học!'
                    : 'Trình duyệt hiện tại chưa hỗ trợ Passkey phần cứng — hãy bật Xác thực 2 lớp (2FA) bên dưới.'}
                </Text>
              ) : (
                securitySnap!.passkeys.map((pk) => (
                  <View
                    key={pk.id}
                    style={[styles.deviceItem, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <AppIcon name="key-outline" size={18} color={palette.indigo} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {renamingId === pk.id ? (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <TextInput
                            value={renameDraft}
                            onChangeText={setRenameDraft}
                            placeholder="Tên Passkey..."
                            style={[styles.inlineRenameInput, { color: palette.ink, borderColor: palette.indigo }]}
                          />
                          <Pressable onPress={() => void handleSavePasskeyRename(pk.id)}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>Lưu</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }} numberOfLines={1}>
                            {pk.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                            Tạo ngày {new Date(pk.registeredAt).toLocaleDateString('vi-VN')}
                            {pk.lastUsedAt ? ` · Dùng gần nhất ${new Date(pk.lastUsedAt).toLocaleDateString('vi-VN')}` : ''}
                          </Text>
                        </>
                      )}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Đổi tên Passkey"
                      onPress={() => {
                        setRenamingId(pk.id);
                        setRenameDraft(pk.name);
                      }}
                      hitSlop={8}
                    >
                      <AppIcon name="create-outline" size={17} color={palette.inkMuted} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xóa Passkey"
                      onPress={() => void handleDeletePasskey(pk.id)}
                      hitSlop={8}
                    >
                      <AppIcon name="trash-outline" size={17} color={palette.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={[styles.fullDivider, { backgroundColor: palette.paperMuted }]} />

            {/* 2. Two-Factor Authentication (2FA Authenticator) */}
            <View style={styles.secHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <AppIcon name="shield-checkmark-outline" size={20} color={palette.mint} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                    Xác thực 2 lớp (2FA Authenticator)
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    {securitySnap?.totpEnabled
                      ? '🟢 Đang bật bảo vệ mã OTP 6 chữ số (Google Authenticator / Authy)'
                      : 'Bảo vệ tài khoản bằng mã OTP 6 chữ số đổi mới mỗi 30 giây'}
                  </Text>
                </View>
              </View>
              {securitySnap?.totpEnabled ? (
                <Button variant="danger" disabled={secBusy} onPress={() => void handleDisable2FA()}>
                  Tắt 2FA
                </Button>
              ) : (
                <Button variant="success" disabled={secBusy} onPress={() => void handleOpen2FAEnrollment()}>
                  Bật 2FA
                </Button>
              )}
            </View>

            <View style={[styles.fullDivider, { backgroundColor: palette.paperMuted }]} />

            {/* 3. Active Logged-in Devices Manager */}
            <View style={{ gap: 8 }}>
              <View style={styles.secHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <AppIcon name="laptop-outline" size={20} color={palette.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>
                      Quản lý Thiết bị Đăng nhập ({securitySnap?.devices.length || 1})
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      Kiểm soát các phiên đang đăng nhập và đăng xuất từ xa bất kỳ lúc nào
                    </Text>
                  </View>
                </View>
                {(securitySnap?.devices.length ?? 0) > 1 && (
                  <Pressable onPress={() => void handleRevokeAllOthers()}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.danger }}>
                      Đăng xuất máy khác
                    </Text>
                  </Pressable>
                )}
              </View>

              {(securitySnap?.devices ?? []).map((dev) => {
                const isCurrent = dev.deviceId === securitySnap?.currentDeviceId;
                return (
                  <View
                    key={dev.deviceId}
                    style={[styles.deviceItem, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <AppIcon name={dev.icon} size={20} color={isCurrent ? palette.mint : palette.indigo} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: palette.ink }} numberOfLines={1}>
                          {dev.deviceName}
                        </Text>
                        {isCurrent && <Badge tone="success">Thiết bị này</Badge>}
                      </View>
                      <Text style={{ fontSize: 11, color: palette.inkMuted, marginTop: 2 }}>
                        {dev.platformLabel} · {dev.timezone} · Hoạt động{' '}
                        {new Date(dev.lastActiveAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {!isCurrent && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void handleRevokeDevice(dev.deviceId)}
                        style={[styles.revokeChip, { backgroundColor: palette.dangerTint }]}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: palette.danger }}>Đăng xuất</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      {/* Preferences Section */}
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        {t.settings.appPreferences}
      </Text>

      <Card style={styles.group}>
        <View style={styles.themeBlockRow}>
          <View style={styles.themeHeaderRow}>
            <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
              <AppIcon name="moon-outline" size={20} color={palette.indigo} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
                {t.settings.themeTitle}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {t.settings.themeSub}
              </Text>
            </View>
          </View>
          <View style={[styles.themeSegmentedTrack, { backgroundColor: palette.paperMuted }]}>
            {(['system', 'light', 'dark'] as const).map((value) => {
              const selected = theme === value;
              const label =
                language === 'vi'
                  ? value === 'system'
                    ? 'Tự động'
                    : value === 'light'
                      ? 'Sáng'
                      : 'Tối'
                  : value === 'system'
                    ? 'Auto'
                    : value === 'light'
                      ? 'Light'
                      : 'Dark';
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setTheme(value)}
                  style={[
                    styles.themeSegmentBtn,
                    selected
                      ? {
                          backgroundColor: palette.paperRaised,
                          borderColor: palette.indigoBorder,
                          borderWidth: 1,
                        }
                      : undefined,
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: selected ? palette.indigo : palette.ink,
                      fontWeight: selected ? '800' : '600',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />

        <Pressable accessibilityRole="button" onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}>
          <PreferenceRow icon="language-outline" title={t.settings.langTitle} subtitle={t.settings.langSub}>
            <Badge tone="primary">{language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}</Badge>
          </PreferenceRow>
        </Pressable>

        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <PreferenceRow icon="sparkles-outline" title={t.settings.hapticsTitle} subtitle={t.settings.hapticsSub}>
          <Switch
            accessibilityLabel={t.settings.hapticsTitle}
            value={haptics}
            onValueChange={toggleHaptics}
            trackColor={{ false: palette.paperMuted, true: palette.indigo }}
          />
        </PreferenceRow>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <PreferenceRow icon="options-outline" title={t.settings.reduceMotionTitle} subtitle={t.settings.reduceMotionSub}>
          <Switch
            accessibilityLabel={t.settings.reduceMotionTitle}
            value={reduceMotion}
            onValueChange={toggleReduceMotion}
            trackColor={{ false: palette.paperMuted, true: palette.indigo }}
          />
        </PreferenceRow>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <Pressable accessibilityRole="button" onPress={() => useOnboardingStore.getState().openReplay()}>
          <PreferenceRow
            icon="film-outline"
            title={language === 'vi' ? 'Xem lại hướng dẫn Papyrus' : 'Replay Papyrus Intro'}
            subtitle={
              language === 'vi'
                ? 'Câu chuyện giới thiệu 3 bước từ tài liệu tới thi đấu'
                : '9.5s story from study notes to live battles'
            }
          >
            <Badge tone="primary">{language === 'vi' ? 'Xem' : 'Play'}</Badge>
          </PreferenceRow>
        </Pressable>
      </Card>

      {/* Cloud & Data Section */}
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        {t.settings.cloudSection}
      </Text>

      <Card style={styles.group}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/sync')}>
          <PreferenceRow
            icon="cloud-upload-outline"
            title={t.settings.accountLibraryTitle}
            subtitle={t.settings.accountLibrarySub}
          >
            <AppIcon name="chevron-forward" size={20} color={palette.indigo} />
          </PreferenceRow>
        </Pressable>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => router.push('/sets')}>
          <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
            <AppIcon name="server-outline" size={20} color={palette.indigo} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
              {t.settings.manageLocalTitle}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {t.settings.manageLocalSub}
            </Text>
          </View>
          <AppIcon name="chevron-forward" size={20} color={palette.indigo} />
        </Pressable>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => void handleClearStudyDraftsCache()}>
          <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
            <AppIcon name="trash-bin-outline" size={20} color={palette.inkMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
              {language === 'vi' ? 'Dọn bộ nhớ đệm & phiên học tạm' : 'Clear Local Drafts & OCR Cache'}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {cacheNotice ||
                (language === 'vi'
                  ? `Đang lưu ${questionSetCount} bộ đề · Chạm để dọn phiên học dở & cache tạm`
                  : `${questionSetCount} sets stored · Tap to clear temporary drafts and cache`)}
            </Text>
          </View>
          <Badge tone="neutral">{clearingCache ? '...' : language === 'vi' ? 'Dọn' : 'Clear'}</Badge>
        </Pressable>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => setBillingOpen(true)}>
          <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
            <AppIcon name="card-outline" size={20} color={palette.gold} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
              {language === 'vi' ? 'Nâng cấp VIP & Nạp AI Token' : 'VIP & AI Token Upgrades'}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {language === 'vi'
                ? 'Mở khóa tạo đề không giới hạn qua VietQR, Thẻ & Apple/Google Pay'
                : 'Unlock unlimited AI quizzes via card, Apple Pay, Google Pay & history'}
            </Text>
          </View>
          <Badge tone={membershipTier === 'archmage' ? 'reward' : 'primary'}>
            {membershipTier === 'archmage' ? '👑 VIP' : language === 'vi' ? 'Nâng cấp' : 'Upgrade'}
          </Badge>
        </Pressable>
      </Card>
      <VipCheckoutModal visible={billingOpen} onClose={() => setBillingOpen(false)} />

      {Platform.OS !== 'web' && (
        <Card style={{ marginTop: spacing.lg }}>
          <PreferenceRow icon="notifications-outline" title="Nhắc học mỗi ngày" subtitle="19:00 theo giờ điện thoại">
            <Switch
              accessibilityLabel="Nhắc học lúc 19 giờ"
              disabled={busy}
              value={reminder}
              onValueChange={(value) => void toggleReminder(value)}
            />
          </PreferenceRow>
          {notice ? <Text accessibilityRole="alert" style={{ color: palette.danger }}>{notice}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings().catch(() => setNotice('Không mở được cài đặt hệ thống.'))}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ color: palette.indigo }}>Mở cài đặt điện thoại</Text>
          </Pressable>
        </Card>
      )}

      <Card style={{ marginTop: spacing.lg }} onPress={() => router.push('/privacy')}>
        <Text style={[typography.title, { color: palette.ink }]}>Quyền riêng tư & dữ liệu</Text>
        <Text style={[typography.caption, { color: palette.inkMuted }]}>Chính sách, hỗ trợ và xóa tài khoản</Text>
      </Card>
      <Card color={palette.indigoTint} style={styles.about}>
        <Text style={[typography.title, { color: palette.indigo }]}>{t.settings.aboutTitle}</Text>
        <Text style={[typography.caption, { color: palette.indigoDeep, marginTop: 4, lineHeight: 20 }]}>
          {t.settings.aboutDesc}
        </Text>
      </Card>

      {/* Sign Out Button (Triggers Instant Confirmation Dialog) */}
      {user ? (
        <Pressable
          accessibilityRole="button"
          onPress={promptLogoutConfirmation}
          style={({ pressed }) => [
            styles.signOutBtnCard,
            {
              backgroundColor: palette.dangerTint,
              borderColor: palette.dangerBorder,
              opacity: pressed ? 0.84 : 1,
            },
          ]}
        >
          <AppIcon name="log-out-outline" size={20} color={palette.danger} />
          <Text style={[typography.body, { color: palette.danger, fontWeight: '800' }]}>
            {t.settings.signOut}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/auth')}
          style={[styles.signOutBtnCard, { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder }]}
        >
          <AppIcon name="log-in-outline" size={20} color={palette.indigo} />
          <Text style={[typography.body, { color: palette.indigo, fontWeight: '800' }]}>
            {t.settings.signIn}
          </Text>
        </Pressable>
      )}

      {/* Semantic Native HTML <dialog> for Web Logout Confirmation (autofocus on safe Cancel action) */}
      {Platform.OS === 'web'
        ? createElement(
          'dialog',
          {
            id: 'papyrus-logout-dialog',
            'aria-labelledby': 'papyrus-logout-title',
            style: {
              border: `1px solid ${palette.paperMuted}`,
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '400px',
              width: 'calc(100% - 32px)',
              backgroundColor: palette.paperRaised,
              color: palette.ink,
              boxShadow: '0 24px 54px rgba(24, 28, 37, 0.28)',
            },
          },
          createElement(
            'h1',
            {
              id: 'papyrus-logout-title',
              style: { margin: 0, fontSize: '18px', fontWeight: 800, color: palette.ink },
            },
            'Bạn có chắc chắn muốn đăng xuất?'
          ),
          createElement(
            'p',
            {
              style: { marginTop: '8px', marginBottom: '20px', fontSize: '14px', lineHeight: 1.5, color: palette.inkMuted },
            },
            'Tiến trình học tập, chuỗi Streak và cấp Học giả của bạn đã được lưu an toàn trên đám mây.'
          ),
          createElement(
            'form',
            {
              method: 'dialog',
              style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
            },
            createElement(
              'button',
              {
                value: 'cancel',
                autoFocus: true,
                style: {
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '12px',
                  border: `1px solid ${palette.paperMuted}`,
                  background: palette.paperSoft,
                  color: palette.ink,
                  fontWeight: 800,
                  cursor: 'pointer',
                },
              },
              'Ở lại'
            ),
            createElement(
              'button',
              {
                value: 'confirm-logout',
                style: {
                  minHeight: '44px',
                  padding: '0 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: palette.danger,
                  color: palette.onPrimary,
                  fontWeight: 800,
                  cursor: 'pointer',
                },
              },
              'Đăng xuất ngay'
            )
          )
        )
        : null}

      {/* Mobile Native Logout Confirmation Modal */}
      <Modal
        visible={logoutConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutConfirmOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={{ width: '100%', maxWidth: 400, gap: 12, backgroundColor: palette.paper }}>
            <Text style={[typography.title, { color: palette.ink }]}>
              Bạn có chắc chắn muốn đăng xuất không?
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, lineHeight: 19 }]}>
              Tiến trình học tập, chuỗi Streak và cấp Học giả của bạn đã được lưu an toàn trên đám mây.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" onPress={() => setLogoutConfirmOpen(false)} fullWidth>
                  Ở lại
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="danger" onPress={executeInstantSignOut} fullWidth>
                  Đăng xuất ngay
                </Button>
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* 2FA QR Enrollment Modal */}
      <Modal
        visible={totpModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTotpModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={{ width: '100%', maxWidth: 430, gap: 12, backgroundColor: palette.paper }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.title, { color: palette.ink }]}>🛡️ Thiết lập Bảo mật 2 lớp (2FA)</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setTotpModalOpen(false)}>
                <AppIcon name="close" size={22} color={palette.inkMuted} />
              </Pressable>
            </View>

            {newBackupCodes.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Text style={[typography.caption, { color: palette.mint, fontWeight: '800' }]}>
                  ✅ Đã kích hoạt 2FA thành công! Hãy lưu lại 4 mã dự phòng khẩn cấp dưới đây:
                </Text>
                <View style={[styles.backupCodesBox, { backgroundColor: palette.mintTint }]}>
                  {newBackupCodes.map((c) => (
                    <Text key={c} style={[styles.backupCodeText, { color: palette.mint }]}>
                      {c}
                    </Text>
                  ))}
                </View>
                <Button onPress={() => setTotpModalOpen(false)} fullWidth>
                  Hoàn tất & Đã lưu mã
                </Button>
              </View>
            ) : pendingTotp ? (
              <View style={{ gap: 10 }}>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  1. Mở ứng dụng <Text style={{ fontWeight: '800', color: palette.ink }}>Google Authenticator</Text>,{' '}
                  <Text style={{ fontWeight: '800', color: palette.ink }}>Authy</Text> hoặc{' '}
                  <Text style={{ fontWeight: '800', color: palette.ink }}>Mật khẩu Apple</Text> và quét mã QR:
                </Text>
                <View style={styles.qrBox}>
                  <QRCode value={pendingTotp.otpauthUri} size={164} />
                </View>
                <Text selectable style={{ fontSize: 11.5, color: palette.indigo, fontWeight: '800', textAlign: 'center' }}>
                  Khóa thủ công: {pendingTotp.secret}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  2. Nhập mã gồm 6 chữ số đang hiển thị trên ứng dụng để xác nhận:
                </Text>
                <TextInput
                  value={totpCode}
                  onChangeText={(v) => setTotpCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.otpModalInput, { color: palette.ink, borderColor: palette.indigo, backgroundColor: palette.paperRaised }]}
                />
                <Button
                  variant="success"
                  disabled={secBusy || totpCode.length < 6}
                  onPress={() => void handleVerify2FAEnrollment()}
                  fullWidth
                >
                  {secBusy ? 'Đang xác minh…' : 'Kích hoạt Bảo mật 2FA'}
                </Button>
              </View>
            ) : null}
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md },
  profileMainTap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileSignInPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  group: { padding: 0, overflow: 'hidden', borderRadius: radii.md },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  themeBlockRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  themeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  themeSegmentedTrack: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: radii.pill,
  },
  themeSegmentBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, marginLeft: 64 },
  fullDivider: { height: 1, width: '100%' },
  secBanner: { padding: 10, borderRadius: radii.sm },
  secHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  inlineRenameInput: {
    flex: 1,
    minWidth: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  revokeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  about: { marginTop: spacing.xl, borderRadius: radii.md },
  signOutBtnCard: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 28, 37, 0.56)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  qrBox: {
    alignSelf: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  otpModalInput: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  backupCodesBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
  },
  backupCodeText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
