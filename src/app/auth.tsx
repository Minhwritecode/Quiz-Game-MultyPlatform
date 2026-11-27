import { errorMessage } from '@/core/domain/failure';
import { AppIcon } from '@/shared/AppIcon';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark, Button } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { dependencies } from '@/composition/dependencies';
import {
  authenticateWithPasskeyButton,
  checkSignInRequires2FA,
  isPlatformPasskeyAvailable,
  sendMagicLinkEmail,
  verifySignIn2FACode,
} from '@/composition/platform';
import { useI18n } from '@/core/i18n';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { AuthCosmicBackdrop } from '@/shared/visuals/AuthCosmicBackdrop';

type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword' | 'twoFactor';

const MODE_MORPH_STYLE: Record<
  AuthMode,
  { accent: string; borderGlow: string; radius: number; flipDir: number }
> = {
  signIn: {
    accent: '#818CF8',
    borderGlow: 'rgba(129, 140, 248, 0.42)',
    radius: 26,
    flipDir: -1,
  },
  signUp: {
    accent: '#34D399',
    borderGlow: 'rgba(52, 211, 153, 0.42)',
    radius: 32,
    flipDir: 1,
  },
  forgot: {
    accent: '#38BDF8',
    borderGlow: 'rgba(56, 189, 248, 0.42)',
    radius: 22,
    flipDir: 1,
  },
  resetPassword: {
    accent: '#C084FC',
    borderGlow: 'rgba(192, 132, 252, 0.45)',
    radius: 28,
    flipDir: -1,
  },
  twoFactor: {
    accent: '#FBBF24',
    borderGlow: 'rgba(251, 191, 36, 0.45)',
    radius: 30,
    flipDir: 1,
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
  return { score: 4, label: 'Rất mạnh', color: '#34D399' };
}

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language, toggleLanguage, t } = useI18n();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | undefined>(undefined);
  const [passkeySupported, setPasskeySupported] = useState(false);

  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const user = useAuthStore((state) => state.user);
  const routedUser = useRef<string | null>(null);
  const finishSignIn = useCallback(async () => {
    const owner = useAuthStore.getState().user?.id;
    if (!owner || routedUser.current === owner) return;
    routedUser.current = owner;
    const isCurrent = () => useAuthStore.getState().user?.id === owner;
    const sourceId = await dependencies.generation.sourceHandoff.claim(owner, isCurrent).catch(() => null);
    if (!isCurrent()) return;
    if (sourceId) router.replace({ pathname: '/create/generate', params: { sourceId, fromSignIn: '1' } });
    else router.replace('/');
  }, [router]);
  const enterGuestMode = useAuthStore((state) => state.enterGuestMode);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);

  // 3D Flip + Spring Scale & Radius Morph directly on the Centered Modal Card
  const modalFlip = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(1)).current;
  const modalOpacity = useRef(new Animated.Value(1)).current;

  const morphToMode = (next: AuthMode) => {
    if (next === mode) return;
    setErrorMsg(null);
    setInfoMsg(null);
    if (reduceMotion) {
      setMode(next);
      return;
    }
    const dir = MODE_MORPH_STYLE[next].flipDir;
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0.35,
        duration: 115,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(modalScale, {
        toValue: 0.94,
        duration: 115,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(modalFlip, {
        toValue: dir * 0.5,
        duration: 115,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setMode(next);
      modalFlip.setValue(-dir * 0.5);
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          damping: 15,
          stiffness: 190,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(modalFlip, {
          toValue: 0,
          damping: 16,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    });
  };

  useEffect(() => {
    void isPlatformPasskeyAvailable().then(setPasskeySupported);
  }, []);

  useEffect(() => {
    if (!user || busy || mode === 'resetPassword' || mode === 'twoFactor') return;
    if (Platform.OS === 'web' && /(?:[?#&])type=recovery(?:&|$)/.test(window.location.href)) return;
    let active = true;
    void checkSignInRequires2FA().then((mfa) => {
      if (!active || useAuthStore.getState().user?.id !== user.id) return;
      if (mfa.required) {
        setMfaFactorId(mfa.factorId);
        setMode('twoFactor');
      } else {
        void finishSignIn();
      }
    }).catch(() => {
      if (active) setErrorMsg(language === 'vi' ? 'Không thể kiểm tra phiên đăng nhập. Hãy thử lại.' : 'Could not verify this session. Try again.');
    });
    return () => { active = false; };
  }, [user, mode, busy, finishSignIn, language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('type=recovery') || search.includes('type=recovery')) {
        setMode('resetPassword');
      }
    }

    const unsubscribe = dependencies.auth.onAuthStateChange((_nextUser, event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('resetPassword');
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const pwStrength = useMemo(
    () => computePasswordStrength(mode === 'resetPassword' ? newPassword : password),
    [mode, newPassword, password]
  );

  const handleVerify2FA = async () => {
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await verifySignIn2FACode(otpCode, mfaFactorId);
      if (!res.ok) {
        setErrorMsg(res.message || 'Mã xác thực 2FA chưa chính xác.');
        return;
      }
      await finishSignIn();
    } finally {
      setBusy(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res = await authenticateWithPasskeyButton();
      if (!res.ok || !res.user) {
        if (res.message && res.message !== 'Đã hủy xác thực Passkey.') {
          setErrorMsg(res.message);
        }
        return;
      }
      useAuthStore.getState().setUser({
        id: res.user.id,
        email: res.user.email,
        displayName: res.user.displayName,
        avatarUrl: null,
        role: 'user',
      });
      await finishSignIn();
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (mode === 'twoFactor') {
      await handleVerify2FA();
      return;
    }

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
        setTimeout(() => router.replace('/'), 1200);
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
        void finishSignIn();
      }
    } else {
      const error = await dependencies.auth.signInWithPassword(cleanEmail, password);
      if (error) {
        setErrorMsg(error);
      } else {
        const mfa = await checkSignInRequires2FA();
        if (mfa.required) {
          setMfaFactorId(mfa.factorId);
          morphToMode('twoFactor');
        } else {
          await finishSignIn();
        }
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
              ? 'Google Login chưa được bật trên Supabase Dashboard. Hãy dùng Email + Mật khẩu, Passkey hoặc Magic Link!'
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
          ? 'Nhập địa chỉ Email ở ô trên rồi bấm Magic Link để nhận liên kết đăng nhập 1 chạm!'
          : 'Enter your email address above first!'
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
            ? `✨ Đã gửi liên kết đăng nhập 1 chạm tới ${cleanEmail}!`
            : `✨ Magic sign-in link sent to ${cleanEmail}!`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const morphMeta = MODE_MORPH_STYLE[mode];

  return (
    <KeyboardAvoidingView
      style={styles.screenRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AuthCosmicBackdrop mode={mode} reduceMotion={reduceMotion} />

      <ScrollView
        style={styles.scrollViewport}
        contentContainerStyle={[
          styles.centeredScroll,
          {
            paddingTop: Math.max(spacing.md, insets.top + 10),
            paddingBottom: Math.max(spacing.md, insets.bottom + 12),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Morphing Modal Card */}
        <Animated.View
          style={[
            styles.modalOuter,
            {
              opacity: modalOpacity,
              transform: [
                { perspective: 1100 },
                {
                  rotateY: modalFlip.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: ['-22deg', '0deg', '22deg'],
                  }),
                },
                { scale: modalScale },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              {
                borderRadius: morphMeta.radius,
                borderColor: morphMeta.borderGlow,
              },
              Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(26px)',
                    WebkitBackdropFilter: 'blur(26px)',
                    boxShadow: `0 24px 64px rgba(2, 6, 23, 0.78), 0 0 0 1px ${morphMeta.borderGlow}`,
                    transition: 'border-radius 380ms cubic-bezier(0.22, 1, 0.36, 1), border-color 380ms ease, box-shadow 380ms ease',
                  } as unknown as ViewStyle)
                : undefined,
            ]}
          >
            {/* Compact Clean Brand Header inside the Centered Modal */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <BrandMark size={38} />
                <View>
                  <Text style={styles.brandName}>Papyrus</Text>
                  <Text style={styles.brandSub}>Học viện AI & Đấu trường 3D</Text>
                </View>
              </View>

              <Pressable
                onPress={toggleLanguage}
                accessibilityRole="button"
                accessibilityLabel="Switch language"
                style={styles.langPill}
              >
                <Text style={{ fontSize: 13 }}>{language === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
                <Text style={{ color: '#E2E8F0', fontSize: 11.5, fontWeight: '800' }}>
                  {language === 'vi' ? 'VI' : 'EN'}
                </Text>
              </Pressable>
            </View>

            {/* 3-Mode Morph Switcher */}
            {mode !== 'resetPassword' && mode !== 'twoFactor' && (
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
                      onPress={() => morphToMode(tab.id)}
                      style={[
                        styles.modeSegmentBtn,
                        active && { backgroundColor: morphMeta.accent },
                      ]}
                    >
                      <AppIcon
                        name={tab.icon}
                        size={14}
                        color={active ? '#050818' : '#CBD5E1'}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: active ? '900' : '700',
                          color: active ? '#050818' : '#CBD5E1',
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

            {/* Dynamic Modal Heading */}
            <View>
              <Text nativeID="auth-modal-heading" style={styles.headingText}>
                {mode === 'twoFactor'
                  ? '🛡️ Xác thực Bảo mật 2 lớp (2FA)'
                  : mode === 'signUp'
                  ? t.auth.signUpTitle
                  : mode === 'forgot'
                  ? t.auth.forgotTitle
                  : mode === 'resetPassword'
                  ? t.auth.setNewPasswordTitle
                  : t.auth.signInTitle}
              </Text>
              <Text style={styles.subText}>
                {mode === 'twoFactor'
                  ? 'Nhập mã gồm 6 chữ số từ ứng dụng Google Authenticator / Authy hoặc mã dự phòng của bạn.'
                  : mode === 'signUp'
                  ? t.auth.signUpSub
                  : mode === 'forgot'
                  ? t.auth.forgotSub
                  : mode === 'resetPassword'
                  ? t.auth.setNewPasswordSub
                  : t.auth.signInSub}
              </Text>
            </View>

            {errorMsg ? (
              <View style={[styles.banner, { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.6)' }]}>
                <AppIcon name="alert-circle" size={18} color="#FCA5A5" />
                <Text style={[typography.caption, { color: '#FECACA', flex: 1 }]}>{errorMsg}</Text>
              </View>
            ) : null}

            {infoMsg ? (
              <View style={[styles.banner, { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: 'rgba(16,185,129,0.6)' }]}>
                <AppIcon name="checkmark-circle" size={18} color="#6EE7B7" />
                <Text style={[typography.caption, { color: '#A7F3D0', flex: 1 }]}>{infoMsg}</Text>
              </View>
            ) : null}

            {/* 2FA TOTP Single-Input Verification Step */}
            {mode === 'twoFactor' ? (
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                  Mã xác thực một lần (6 chữ số)
                </Text>
                <TextInput
                  value={otpCode}
                  onChangeText={(v) => setOtpCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#475569"
                  style={styles.otpSingleInput}
                />
                <Button
                  variant="reward"
                  icon="shield-checkmark"
                  disabled={busy || otpCode.length < 6}
                  onPress={() => void handleVerify2FA()}
                  fullWidth
                >
                  {busy ? 'Đang kiểm tra…' : 'Xác nhận & Vào Papyrus'}
                </Button>
                <Pressable
                  onPress={() => {
                    void dependencies.auth.signOut();
                    useAuthStore.getState().clear();
                    morphToMode('signIn');
                  }}
                  style={{ alignSelf: 'center', paddingVertical: 6 }}
                >
                  <Text style={{ color: '#94A3B8', fontSize: 12.5, fontWeight: '700' }}>
                    ← Quay lại đăng nhập tài khoản khác
                  </Text>
                </Pressable>
              </View>
            ) : mode === 'resetPassword' ? (
              <>
                <View style={styles.darkFieldRow}>
                  <AppIcon name="lock-closed-outline" size={18} color="#94A3B8" />
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
                  <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setVisible((prev) => !prev)}>
                    <AppIcon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                  </Pressable>
                </View>

                <View style={styles.darkFieldRow}>
                  <AppIcon name="shield-checkmark-outline" size={18} color="#94A3B8" />
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
                  <AppIcon name="mail-outline" size={18} color="#94A3B8" />
                  <TextInput
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setErrorMsg(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete={mode === 'signIn' ? ('username webauthn' as 'email') : 'email'}
                    placeholder={t.auth.emailPlaceholder}
                    placeholderTextColor="#64748B"
                    style={styles.darkTextInput}
                  />
                </View>

                {mode !== 'forgot' && (
                  <View style={{ gap: 6 }}>
                    <View style={styles.darkFieldRow}>
                      <AppIcon name="lock-closed-outline" size={18} color="#94A3B8" />
                      <TextInput
                        value={password}
                        onChangeText={(val) => {
                          setPassword(val);
                          setErrorMsg(null);
                        }}
                        secureTextEntry={!visible}
                        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                        onSubmitEditing={() => void handleSubmit()}
                        placeholder={t.auth.passwordPlaceholder}
                        placeholderTextColor="#64748B"
                        style={styles.darkTextInput}
                      />
                      <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setVisible((prev) => !prev)} hitSlop={8}>
                        <AppIcon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
                      </Pressable>
                    </View>

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
                                  lvl <= pwStrength.score ? pwStrength.color : 'rgba(148,163,184,0.22)',
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

                {/* Passkey Biometric Sign-In + OAuth + Magic Link */}
                {mode !== 'forgot' && (
                  <>
                    {mode === 'signIn' && passkeySupported && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => void handlePasskeySignIn()}
                        style={({ pressed }) => [
                          styles.passkeyBtn,
                          { opacity: pressed ? 0.84 : 1 },
                        ]}
                      >
                        <AppIcon name="finger-print-outline" size={18} color="#A5B4FC" />
                        <Text style={{ color: '#E0E7FF', fontSize: 13, fontWeight: '800' }}>
                          Đăng nhập bằng Passkey (Face ID / Touch ID)
                        </Text>
                      </Pressable>
                    )}

                    <View style={styles.divider}>
                      <View style={styles.line} />
                      <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '700' }}>
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
                      style={styles.magicLinkBtn}
                    >
                      <AppIcon name="sparkles-outline" size={15} color="#FBBF24" />
                      <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '800' }}>
                        Đăng nhập 1 chạm bằng Email Magic Link
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {/* Clean Guest Mode & Admin Portal Footer inside Modal */}
            <View style={styles.footerActionsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  enterGuestMode();
                  void dependencies.generation.sourceHandoff.clear().catch(() => undefined);
                  router.replace('/');
                }}
                style={styles.guestFooterBtn}
              >
                <Text style={{ color: '#CBD5E1', fontSize: 12.5, fontWeight: '700' }}>
                  {language === 'vi' ? 'Trải nghiệm với tư cách Khách →' : 'Continue as Guest →'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={language === 'vi' ? 'Cổng Quản trị viên' : 'Admin Portal'}
                onPress={() => router.push('/admin')}
                style={styles.adminFooterBtn}
              >
                <AppIcon name="shield-checkmark-outline" size={14} color="#FBBF24" />
                <Text style={{ color: '#FDE68A', fontSize: 12, fontWeight: '800' }}>
                  {language === 'vi' ? 'Quản trị viên' : 'Admin'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: '#050818',
    ...(Platform.OS === 'web'
      ? ({ minHeight: '100dvh' } as unknown as ViewStyle)
      : null),
  },
  scrollViewport: {
    flex: 1,
    width: '100%',
  },
  centeredScroll: {
    flexGrow: 1,
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalOuter: {
    width: '100%',
    maxWidth: 428,
    marginTop: 'auto',
    marginBottom: 'auto',
    alignSelf: 'center',
  },
  modalCard: {
    backgroundColor: 'rgba(13, 19, 46, 0.88)',
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  modeSegmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(6, 10, 28, 0.72)',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
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
  headingText: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subText: {
    color: '#94A3B8',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  darkFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 10, 28, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  darkTextInput: {
    flex: 1,
    minWidth: 0,
    color: '#F8FAFC',
    fontSize: 15,
    paddingVertical: 10,
  },
  otpSingleInput: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 10, 28, 0.85)',
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 10,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  passkeyBtn: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  oauthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  magicLinkBtn: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.11)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  footerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
  },
  guestFooterBtn: {
    paddingVertical: 6,
  },
  adminFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.36)',
  },
});
