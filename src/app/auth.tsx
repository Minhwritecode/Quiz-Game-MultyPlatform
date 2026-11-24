import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandMark, Button, Card, Screen, SmoothReveal, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { dependencies } from '@/composition/dependencies';
import { sendMagicLinkEmail } from '@/composition/platform';
import { useI18n } from '@/core/i18n';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { AuthCosmicBackdrop } from '@/shared/visuals/AuthCosmicBackdrop';

type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

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

  useEffect(() => {
    if (user && mode !== 'resetPassword') {
      router.replace('/');
    }
  }, [user, mode, router]);

  // Check for Password Recovery event or recovery token in URL
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

  const handleSubmit = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);

    // 1. Password Recovery: Set New Password Mode
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
        setTimeout(() => {
          router.replace('/');
        }, 1500);
      }
      setBusy(false);
      return;
    }

    const cleanEmail = email.trim();

    // 2. Forgot Password Request Mode
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

    // 3. Sign In or Sign Up Mode
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
        useStreakStore.getState().recordActivity('daily_checkin');
        setInfoMsg(t.auth.signUpSuccess);
        setTimeout(() => router.replace('/'), 1200);
      }
    } else {
      const error = await dependencies.auth.signInWithPassword(cleanEmail, password);
      if (error) {
        setErrorMsg(error);
      } else {
        useStreakStore.getState().refreshStreakStatus();
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
              ? 'Đăng nhập Google hiện chưa bật trên Supabase Dashboard (Authentication → Providers → Google). Bạn có thể dùng "Đăng nhập nhanh qua Email Magic Link" bên dưới hoặc Email + Mật khẩu ngay lúc này!'
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
            ? `✨ Đã gửi liên kết đăng nhập 1 chạm tới ${cleanEmail}! Hãy mở hộp thư và chạm vào liên kết để vào thẳng Papyrus.`
            : `✨ Magic sign-in link sent to ${cleanEmail}! Check your inbox.`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setMode(next);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#060A24' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthCosmicBackdrop mode={mode} reduceMotion={reduceMotion} />
      <Screen transparent>
        {/* Top Header with Language Switcher */}
        <View style={styles.topLangRow}>
          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel="Switch language"
            style={[
              styles.langPill,
              { backgroundColor: 'rgba(15, 23, 66, 0.72)', borderColor: 'rgba(165, 180, 252, 0.35)' },
            ]}
          >
            <Text style={{ fontSize: 16 }}>{language === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
            <Text style={[typography.caption, { color: '#E0E7FF', fontWeight: '800' }]}>
              {language === 'vi' ? 'Tiếng Việt' : 'English'}
            </Text>
          </Pressable>
        </View>

        {/* Brand Header */}
        <SmoothReveal>
          <View style={styles.brand}>
            <BrandMark size={68} />
            <Text style={[typography.display, { color: '#FFFFFF', marginTop: spacing.md }]}>
              Papyrus
            </Text>
            <Text style={[typography.body, { color: '#C7D2FE', marginTop: 2 }]}>
              From Ancient Scroll to AI Power.
            </Text>
          </View>
        </SmoothReveal>

        {/* Main Form Card — re-animates smoothly alongside Three.js 3D Constellation Morph on mode switch */}
        <SmoothReveal key={mode} delay={30}>
        <Card
          style={[
            styles.formCard,
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                } as object)
              : undefined,
          ]}
        >
          <Text style={[typography.heading, { color: palette.ink }]}>
            {mode === 'signUp'
              ? t.auth.signUpTitle
              : mode === 'forgot'
              ? t.auth.forgotTitle
              : mode === 'resetPassword'
              ? t.auth.setNewPasswordTitle
              : t.auth.signInTitle}
          </Text>
          <Text style={[typography.body, { color: palette.inkMuted, marginTop: spacing.xs }]}>
            {mode === 'signUp'
              ? t.auth.signUpSub
              : mode === 'forgot'
              ? t.auth.forgotSub
              : mode === 'resetPassword'
              ? t.auth.setNewPasswordSub
              : t.auth.signInSub}
          </Text>

          {/* Feedback Banners */}
          {errorMsg ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: palette.dangerTint, borderColor: palette.danger },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={20} color={palette.danger} />
              <Text style={[typography.caption, { color: palette.danger, flex: 1 }]}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          {infoMsg ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: palette.mintTint, borderColor: palette.mint },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={palette.mint} />
              <Text style={[typography.caption, { color: palette.mint, flex: 1 }]}>
                {infoMsg}
              </Text>
            </View>
          ) : null}

          {/* Form Fields according to Mode */}
          {mode === 'resetPassword' ? (
            <>
              {/* New Password */}
              <View
                style={[
                  styles.passwordRow,
                  { borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              >
                <TextInput
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    setErrorMsg(null);
                  }}
                  secureTextEntry={!visible}
                  placeholder={t.auth.newPasswordPlaceholder}
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.passwordInput, { color: palette.ink }]}
                />
                <Pressable onPress={() => setVisible((prev) => !prev)}>
                  <Ionicons
                    name={visible ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={palette.inkMuted}
                  />
                </Pressable>
              </View>

              {/* Confirm New Password */}
              <View
                style={[
                  styles.passwordRow,
                  { borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              >
                <TextInput
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    setErrorMsg(null);
                  }}
                  secureTextEntry={!visible}
                  placeholder={t.auth.confirmPasswordPlaceholder}
                  placeholderTextColor={palette.inkMuted}
                  style={[styles.passwordInput, { color: palette.ink }]}
                />
              </View>

              <Button icon="checkmark-circle-outline" onPress={() => void handleSubmit()} disabled={busy}>
                {busy ? t.auth.updatingPassword : t.auth.updatePasswordBtn}
              </Button>
            </>
          ) : (
            <>
              {/* Email input */}
              <TextInput
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  setErrorMsg(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={t.auth.emailPlaceholder}
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.input,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              />

              {/* Password input (hidden in Forgot mode) */}
              {mode !== 'forgot' && (
                <View
                  style={[
                    styles.passwordRow,
                    { borderColor: palette.paperMuted, backgroundColor: palette.paper },
                  ]}
                >
                  <TextInput
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      setErrorMsg(null);
                    }}
                    secureTextEntry={!visible}
                    placeholder={t.auth.passwordPlaceholder}
                    placeholderTextColor={palette.inkMuted}
                    style={[styles.passwordInput, { color: palette.ink }]}
                  />
                  <Pressable onPress={() => setVisible((prev) => !prev)}>
                    <Ionicons
                      name={visible ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={palette.inkMuted}
                    />
                  </Pressable>
                </View>
              )}

              {/* Forgot password link in Sign In mode */}
              {mode === 'signIn' && (
                <Pressable
                  onPress={() => switchMode('forgot')}
                  style={styles.forgotLink}
                  accessibilityRole="button"
                >
                  <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                    {t.auth.forgotLink}
                  </Text>
                </Pressable>
              )}

              {/* Submit Button */}
              <Button icon="arrow-forward" onPress={() => void handleSubmit()} disabled={busy}>
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

              {/* Switch Mode Links */}
              {mode === 'forgot' ? (
                <Pressable onPress={() => switchMode('signIn')} style={styles.toggleAuth}>
                  <Text style={[typography.body, { color: palette.indigo, fontWeight: '700' }]}>
                    ← {t.auth.backToSignIn}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
                  style={styles.toggleAuth}
                >
                  <Text style={[typography.body, { color: palette.inkMuted }]}>
                    {mode === 'signUp' ? t.auth.haveAccount : t.auth.noAccount}
                    <Text style={{ color: palette.indigo, fontWeight: '800' }}>
                      {mode === 'signUp' ? t.auth.signInLink : t.auth.signUpLink}
                    </Text>
                  </Text>
                </Pressable>
              )}

              {/* Social Logins Divider (Only for Sign In & Sign Up) */}
              {mode !== 'forgot' && (
                <>
                  <View style={styles.divider}>
                    <View style={[styles.line, { backgroundColor: palette.paperMuted }]} />
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      {t.auth.orContinueWith}
                    </Text>
                    <View style={[styles.line, { backgroundColor: palette.paperMuted }]} />
                  </View>

                  {/* OAuth Buttons: Google & Facebook */}
                  <View style={styles.oauthRow}>
                    <View style={{ flex: 1 }}>
                      <Button
                        variant="secondary"
                        icon="logo-google"
                        onPress={() => void handleOAuth('google')}
                        disabled={busy}
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
                      >
                        Facebook
                      </Button>
                    </View>
                  </View>

                  {/* Passwordless 1-Tap Magic Link Login */}
                  <Button
                    variant="ghost"
                    icon="mail-open-outline"
                    onPress={() => void handleMagicLink()}
                    disabled={busy}
                    fullWidth
                  >
                    {language === 'vi' ? '✨ Đăng nhập 1 chạm bằng Email Magic Link' : '✨ Sign in with Email Magic Link'}
                  </Button>

                  {/* Guest Login */}
                  <Pressable
                    onPress={() => {
                      enterGuestMode();
                      router.replace('/');
                    }}
                    style={styles.guest}
                    accessibilityRole="button"
                  >
                    <Ionicons name="sparkles-outline" size={18} color={palette.indigo} />
                    <Text style={[typography.body, { color: palette.indigo, fontWeight: '800' }]}>
                      {t.auth.guestBtn}
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </Card>
        </SmoothReveal>

        {/* Privacy Note */}
        <Card color="rgba(15, 23, 66, 0.78)" style={[styles.privacy, { borderColor: 'rgba(129, 140, 248, 0.32)' }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#A5B4FC" />
          <Text style={[typography.caption, { color: '#E0E7FF', flex: 1 }]}>
            {t.auth.privacyNote}
          </Text>
        </Card>

        {/* Admin Portal & Guest shortcut */}
        <View style={styles.bottomLinks}>
          <Pressable
            onPress={() => {
              enterGuestMode();
              router.replace('/');
            }}
            style={styles.back}
          >
            <Text style={[typography.caption, { color: '#CBD5E1' }]}>
              {t.auth.backToDemo}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.push('/admin')} style={styles.back}>
            <Text style={[typography.caption, { color: '#FDE68A', fontWeight: '700' }]}>
              🛡️ Quản trị viên
            </Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topLangRow: {
    alignItems: 'flex-end',
    paddingTop: spacing.xs,
    width: '100%',
    maxWidth: 520,
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
  brand: { alignItems: 'center', paddingVertical: spacing.lg },
  formCard: { gap: spacing.md, maxWidth: 520, alignSelf: 'center', width: '100%' },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  passwordRow: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: { flex: 1, fontSize: 15 },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    paddingVertical: spacing.xs,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  toggleAuth: { alignSelf: 'center', paddingVertical: spacing.xs },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: 1 },
  oauthRow: { flexDirection: 'row', gap: spacing.sm },
  guest: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  privacy: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    marginTop: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  back: { alignSelf: 'center', padding: spacing.md },
});
