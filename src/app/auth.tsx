import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandMark, Button, Card, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { dependencies } from '@/composition/dependencies';
import { sendMagicLinkEmail } from '@/composition/platform';
import { useI18n } from '@/core/i18n';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { AuthCosmicBackdrop } from '@/shared/visuals/AuthCosmicBackdrop';

type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

const MODE_STAGE_META: Record<
  AuthMode,
  { badge: string; accent: string; glowBg: string; captionVi: string; captionEn: string }
> = {
  signIn: {
    badge: '🔓 CỔNG TINH VÂN HỌC VIỆN',
    accent: '#818CF8',
    glowBg: 'rgba(99, 102, 241, 0.18)',
    captionVi: 'Mở khóa kho bộ đề, chuỗi Streak & tiến trình 3D riêng của bạn',
    captionEn: 'Unlock your personal library, streak, and 3D arena rank',
  },
  signUp: {
    badge: '✨ VƯƠNG MIỆN KHỞI TẠO HỌC GIẢ',
    accent: '#34D399',
    glowBg: 'rgba(16, 185, 129, 0.18)',
    captionVi: 'Khởi tạo hồ sơ đám mây độc lập · Nhận ngay +50 XP Tân Học Giả',
    captionEn: 'Create your cloud scholar profile & earn +50 starter XP',
  },
  forgot: {
    badge: '🧭 LA BÀN KHÔI PHỤC TÀI KHOẢN',
    accent: '#38BDF8',
    glowBg: 'rgba(6, 182, 212, 0.18)',
    captionVi: 'Gửi liên kết đặt lại mật khẩu bảo mật trực tiếp tới hộp thư của bạn',
    captionEn: 'Receive a secure password recovery link in your inbox',
  },
  resetPassword: {
    badge: '🛡️ THIẾT LẬP MẬT KHẨU MỚI',
    accent: '#C084FC',
    glowBg: 'rgba(168, 85, 247, 0.18)',
    captionVi: 'Hoàn tất đặt mật khẩu mới để quay lại Học viện Papyrus',
    captionEn: 'Set your new password to re-enter Papyrus Academy',
  },
};

function computePasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Chưa nhập', color: '#64748B' };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 9) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d|[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: 'Yếu (nên ≥ 8 ký tự)', color: '#EF4444' };
  if (s === 2) return { score: 2, label: 'Khá an toàn', color: '#F59E0B' };
  if (s === 3) return { score: 3, label: 'Mạnh', color: '#10B981' };
  return { score: 4, label: 'Rất mạnh · Tuyệt vời', color: '#34D399' };
}

export default function AuthScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, toggleLanguage, t } = useI18n();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const enterGuestMode = useAuthStore((state) => state.enterGuestMode);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);

  // Smooth compositor-thread morph animation on card & stage whenever mode switches
  const morphAnim = useRef(new Animated.Value(1)).current;
  const triggerCardMorph = (next: AuthMode) => {
    if (next === mode) return;
    setErrorMsg(null);
    setInfoMsg(null);
    if (reduceMotion) {
      setMode(next);
      return;
    }
    morphAnim.setValue(0.86);
    setMode(next);
    Animated.timing(morphAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (user && mode !== 'resetPassword') {
      router.replace('/');
    }
  }, [user, mode, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        setMode('resetPassword');
      }
    }

    const unsubscribe = dependencies.auth.onAuthStateChange((nextUser, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('resetPassword');
      } else if (nextUser && event === 'SIGNED_IN') {
        router.replace('/');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  const pwStrength = useMemo(
    () => computePasswordStrength(mode === 'resetPassword' ? newPassword : password),
    [mode, newPassword, password]
  );

  const handleSubmit = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);

    if (mode === 'resetPassword') {
      if (!newPassword || newPassword.length < 6) {
        setErrorMsg(t.auth.passwordTooShort);
        setBusy(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg(t.auth.passwordMismatch);
        setBusy(false);
        return;
      }

      const err = await dependencies.auth.updatePassword(newPassword);
      if (err) {
        setErrorMsg(err);
      } else {
        setInfoMsg(t.auth.passwordUpdatedSuccess);
        setTimeout(() => router.replace('/'), 1400);
      }
      setBusy(false);
      return;
    }

    const cleanEmail = email.trim();

    if (mode === 'forgot') {
      if (!cleanEmail) {
        setErrorMsg(t.auth.missingEmail);
        setBusy(false);
        return;
      }
      const err = await dependencies.auth.resetPasswordForEmail(cleanEmail);
      if (err) {
        setErrorMsg(err);
      } else {
        setInfoMsg(t.auth.resetSuccess);
      }
      setBusy(false);
      return;
    }

    if (!cleanEmail || !password) {
      setErrorMsg(t.auth.missingFields);
      setBusy(false);
      return;
    }

    if (mode === 'signUp') {
      const result = await dependencies.auth.signUpWithPassword(cleanEmail, password);
      if (result === 'CONFIRM_EMAIL_REQUIRED') {
        setInfoMsg(
          language === 'vi'
            ? 'Vui lòng kiểm tra email để xác nhận tài khoản trước khi đăng nhập.'
            : 'Please check your email to verify your account before signing in.'
        );
      } else if (result) {
        setErrorMsg(result);
      } else {
        usePapyrusStore.getState().addBonusXp(50);
        useStreakStore.getState().recordActivity('daily_checkin');
        setInfoMsg(t.auth.signUpSuccess);
        setTimeout(() => router.replace('/'), 1000);
      }
    } else {
      const error = await dependencies.auth.signInWithPassword(cleanEmail, password);
      if (error) {
        setErrorMsg(error);
      } else {
        router.replace('/');
      }
    }
    setBusy(false);
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const result = await dependencies.auth.startOAuth(provider);
      if (result.error) {
        if (result.error.startsWith('PROVIDER_NOT_ENABLED:')) {
          setErrorMsg(
            provider === 'google'
              ? 'Google Login chưa được bật trên Supabase Dashboard. Hãy dùng nút "✨ Email Magic Link" bên dưới hoặc Email + Mật khẩu!'
              : t.auth.providerNotEnabledFacebook
          );
        } else {
          setErrorMsg(result.error);
        }
      } else if (result.url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = result.url;
        } else {
          await Linking.openURL(result.url);
        }
      }
    } catch (err) {
      setErrorMsg(errorMessage(err, 'OAuth request failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg(
        language === 'vi'
          ? 'Nhập địa chỉ Email ở ô phía trên rồi bấm nút Magic Link để nhận liên kết đăng nhập 1 chạm!'
          : 'Enter your email address above first to receive a one-tap Magic Link!'
      );
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const err = await sendMagicLinkEmail(cleanEmail);
      if (err) {
        setErrorMsg(err);
      } else {
        setInfoMsg(
          language === 'vi'
            ? `✨ Đã gửi liên kết đăng nhập 1 chạm tới ${cleanEmail}! Hãy mở hộp thư để vào thẳng Papyrus.`
            : `✨ Magic sign-in link sent to ${cleanEmail}! Check your inbox.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const stageMeta = MODE_STAGE_META[mode];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#060A24' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthCosmicBackdrop mode={mode} reduceMotion={reduceMotion} />

      <Screen transparent>
        {/* Top Bar: Brand + Language Pill */}
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark size={40} />
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>
                Papyrus
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600' }}>
                AI · 3D RPG · Scholar Social
              </Text>
            </View>
          </View>

          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel="Switch language"
            style={[
              styles.langPill,
              { backgroundColor: 'rgba(15, 23, 66, 0.78)', borderColor: 'rgba(165, 180, 252, 0.38)' },
            ]}
          >
            <Text style={{ fontSize: 15 }}>{language === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
            <Text style={[typography.caption, { color: '#E0E7FF', fontWeight: '800' }]}>
              {language === 'vi' ? 'VI' : 'EN'}
            </Text>
          </Pressable>
        </View>

        {/* Clear Open Hero Viewport Showcase so the 3D Sacred Geometry Morphing Stage shines unobstructed! */}
        <View style={styles.morphStageWindow}>
          <View
            style={[
              styles.morphBadgePill,
              { backgroundColor: stageMeta.glowBg, borderColor: stageMeta.accent },
            ]}
          >
            <Text style={{ color: stageMeta.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
              {stageMeta.badge}
            </Text>
          </View>
          <Text style={styles.morphStageHint} numberOfLines={2}>
            {language === 'vi' ? stageMeta.captionVi : stageMeta.captionEn}
          </Text>
        </View>

        {/* Translucent Frosted Glass Morphing Auth Card */}
        <Animated.View
          style={{
            opacity: morphAnim,
            transform: [
              {
                translateY: morphAnim.interpolate({
                  inputRange: [0.86, 1],
                  outputRange: [14, 0],
                }),
              },
              {
                scale: morphAnim.interpolate({
                  inputRange: [0.86, 1],
                  outputRange: [0.985, 1],
                }),
              },
            ],
          }}
        >
          <Card
            color="rgba(12, 18, 52, 0.84)"
            style={[
              styles.formCard,
              { borderColor: stageMeta.accent },
              Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(22px)',
                    WebkitBackdropFilter: 'blur(22px)',
                    boxShadow: `0 20px 50px rgba(4, 8, 28, 0.72), 0 0 28px ${stageMeta.glowBg}`,
                  } as object)
                : undefined,
            ]}
          >
            {/* 3-Tab Segmented Morph Switcher */}
            {mode !== 'resetPassword' && (
              <View style={styles.modeSegmented}>
                {(
                  [
                    { id: 'signIn', label: language === 'vi' ? 'Đăng nhập' : 'Sign In', icon: 'log-in-outline' },
                    { id: 'signUp', label: language === 'vi' ? 'Đăng ký' : 'Sign Up', icon: 'person-add-outline' },
                    { id: 'forgot', label: language === 'vi' ? 'Quên MK' : 'Recover', icon: 'key-outline' },
                  ] as const
                ).map((tab) => {
                  const active = mode === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => triggerCardMorph(tab.id)}
                      style={[
                        styles.modeSegmentBtn,
                        active && { backgroundColor: stageMeta.accent },
                      ]}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={14}
                        color={active ? '#060A24' : '#CBD5E1'}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: active ? '900' : '700',
                          color: active ? '#060A24' : '#CBD5E1',
                        }}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View>
              <Text style={[typography.heading, { color: '#FFFFFF', fontSize: 22 }]}>
                {mode === 'signUp'
                  ? t.auth.signUpTitle
                  : mode === 'forgot'
                  ? t.auth.forgotTitle
                  : mode === 'resetPassword'
                  ? t.auth.setNewPasswordTitle
                  : t.auth.signInTitle}
              </Text>
              <Text style={[typography.caption, { color: '#CBD5E1', marginTop: 4 }]}>
                {mode === 'signUp'
                  ? t.auth.signUpSub
                  : mode === 'forgot'
                  ? t.auth.forgotSub
                  : mode === 'resetPassword'
                  ? t.auth.setNewPasswordSub
                  : t.auth.signInSub}
              </Text>
            </View>

            {errorMsg ? (
              <View style={[styles.banner, { backgroundColor: 'rgba(239,68,68,0.16)', borderColor: '#EF4444' }]}>
                <Ionicons name="alert-circle" size={19} color="#FCA5A5" />
                <Text style={[typography.caption, { color: '#FECACA', flex: 1 }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {infoMsg ? (
              <View style={[styles.banner, { backgroundColor: 'rgba(16,185,129,0.16)', borderColor: '#10B981' }]}>
                <Ionicons name="checkmark-circle" size={19} color="#6EE7B7" />
                <Text style={[typography.caption, { color: '#A7F3D0', flex: 1 }]}>{infoMsg}</Text>
              </View>
            ) : null}

            {mode === 'resetPassword' ? (
              <>
                <View style={styles.darkFieldRow}>
                  <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
                  <TextInput
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      setErrorMsg(null);
                    }}
                    secureTextEntry={!visible}
                    placeholder={t.auth.newPasswordPlaceholder}
                    placeholderTextColor="#64748B"
                    style={styles.darkTextInput}
                  />
                  <Pressable onPress={() => setVisible((prev) => !prev)}>
                    <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                  </Pressable>
                </View>

                <View style={styles.darkFieldRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#94A3B8" />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      setErrorMsg(null);
                    }}
                    secureTextEntry={!visible}
                    placeholder={t.auth.confirmPasswordPlaceholder}
                    placeholderTextColor="#64748B"
                    style={styles.darkTextInput}
                  />
                </View>

                <Button icon="checkmark-circle-outline" onPress={() => void handleSubmit()} disabled={busy} fullWidth>
                  {busy ? t.auth.updatingPassword : t.auth.updatePasswordBtn}
                </Button>
              </>
            ) : (
              <>
                <View style={styles.darkFieldRow}>
                  <Ionicons name="mail-outline" size={18} color="#94A3B8" />
                  <TextInput
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setErrorMsg(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder={t.auth.emailPlaceholder}
                    placeholderTextColor="#64748B"
                    style={styles.darkTextInput}
                  />
                </View>

                {mode !== 'forgot' && (
                  <View style={{ gap: 6 }}>
                    <View style={styles.darkFieldRow}>
                      <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" />
                      <TextInput
                        value={password}
                        onChangeText={(val) => {
                          setPassword(val);
                          setErrorMsg(null);
                        }}
                        secureTextEntry={!visible}
                        placeholder={t.auth.passwordPlaceholder}
                        placeholderTextColor="#64748B"
                        style={styles.darkTextInput}
                      />
                      <Pressable onPress={() => setVisible((prev) => !prev)} hitSlop={8}>
                        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                      </Pressable>
                    </View>

                    {/* Live 4-Bar Password Strength Meter on Sign-Up */}
                    {mode === 'signUp' && password.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {[1, 2, 3, 4].map((lvl) => (
                            <View
                              key={lvl}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor:
                                  lvl <= pwStrength.score ? pwStrength.color : 'rgba(148,163,184,0.25)',
                              }}
                            />
                          ))}
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: pwStrength.color }}>
                          Độ mạnh mật khẩu: {pwStrength.label}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <Button
                  variant={mode === 'signUp' ? 'success' : 'primary'}
                  icon={mode === 'forgot' ? 'paper-plane-outline' : 'arrow-forward'}
                  onPress={() => void handleSubmit()}
                  disabled={busy}
                  fullWidth
                >
                  {busy
                    ? mode === 'signUp'
                      ? t.auth.signingUp
                      : mode === 'forgot'
                      ? t.auth.sendingReset
                      : t.auth.signingIn
                    : mode === 'signUp'
                    ? t.auth.signUpBtn
                    : mode === 'forgot'
                    ? t.auth.forgotBtn
                    : t.auth.signInBtn}
                </Button>

                {mode !== 'forgot' && (
                  <>
                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: '700' }}>
                        {t.auth.orContinueWith}
                      </Text>
                      <View style={styles.line} />
                    </View>

                    <View style={styles.oauthRow}>
                      <View style={{ flex: 1 }}>
                        <Button
                          variant="secondary"
                          icon="logo-google"
                          onPress={() => void handleOAuth('google')}
                          disabled={busy}
                          fullWidth
                        >
                          Google
                        </Button>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          variant="secondary"
                          icon="logo-facebook"
                          onPress={() => void handleOAuth('facebook')}
                          disabled={busy}
                          fullWidth
                        >
                          Facebook
                        </Button>
                      </View>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void handleMagicLink()}
                      style={styles.magicBtn}
                    >
                      <Ionicons name="sparkles" size={16} color="#FDE68A" />
                      <Text style={{ color: '#FDE68A', fontSize: 13, fontWeight: '800' }}>
                        {language === 'vi'
                          ? 'Đăng nhập 1 chạm bằng Email Magic Link'
                          : 'One-tap Email Magic Link'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        enterGuestMode();
                        router.replace('/');
                      }}
                      style={styles.guest}
                      accessibilityRole="button"
                    >
                      <Ionicons name="compass-outline" size={18} color="#A5B4FC" />
                      <Text style={{ color: '#C7D2FE', fontSize: 13.5, fontWeight: '800' }}>
                        {t.auth.guestBtn}
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </Card>
        </Animated.View>

        <View style={styles.bottomLinks}>
          <Pressable
            onPress={() => {
              enterGuestMode();
              router.replace('/');
            }}
            style={styles.back}
          >
            <Text style={[typography.caption, { color: '#94A3B8' }]}>
              {palette ? t.auth.backToDemo : 'Demo'}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin')} style={styles.back}>
            <Text style={[typography.caption, { color: '#FDE68A', fontWeight: '800' }]}>
              🛡️ Quản trị viên
            </Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  morphStageWindow: {
    height: 158,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
  },
  morphBadgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  morphStageHint: {
    color: '#E0E7FF',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 380,
  },
  formCard: {
    gap: spacing.md,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 24,
  },
  modeSegmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(6, 10, 36, 0.75)',
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    gap: 4,
  },
  modeSegmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  darkFieldRow: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    backgroundColor: 'rgba(6, 10, 36, 0.65)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  darkTextInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(148, 163, 184, 0.25)' },
  oauthRow: { flexDirection: 'row', gap: spacing.sm },
  magicBtn: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.45)',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  guest: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  back: { alignSelf: 'center', padding: spacing.sm },
});
