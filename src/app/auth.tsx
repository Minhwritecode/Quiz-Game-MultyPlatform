import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandMark, Button, Card, Screen, usePalette } from '@/shared/ui';
import { colors, radii, spacing, typography } from '@/core/theme/tokens';
import { signInWithPassword } from '@/features/auth/data/authRepository';

export default function AuthScreen() {
  const router = useRouter();
  const palette = usePalette();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const signIn = async () => {
    setBusy(true);
    if (email.trim() && password) {
      const error = await signInWithPassword(email.trim(), password);
      if (error) Alert.alert('Could not sign in', error);
      else router.replace('/');
    } else {
      router.replace('/');
    }
    setBusy(false);
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.brand}><BrandMark size={68} /><Text style={[typography.display, { color: palette.ink, marginTop: spacing.lg }]}>Papyrus</Text><Text style={[typography.body, { color: palette.inkMuted, marginTop: 4 }]}>From Ancient Scroll to AI Power.</Text></View>
        <Card style={styles.formCard}><Text style={[typography.heading, { color: palette.ink }]}>Welcome back, learner.</Text><Text style={[typography.body, { color: palette.inkMuted, marginTop: spacing.sm }]}>Sync your library and pick up where your memory left off.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={palette.inkMuted} style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]} /><View style={styles.passwordRow}><TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} placeholder="Password" placeholderTextColor={palette.inkMuted} style={[styles.passwordInput, { color: palette.ink }]} /><Pressable onPress={() => setVisible((value) => !value)}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={palette.inkMuted} /></Pressable></View><Button icon="arrow-forward" onPress={signIn} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button><Button variant="secondary" icon="logo-google" onPress={() => Alert.alert('Google sign-in', 'OAuth is ready for the Supabase auth vertical slice.')}>Continue with Google</Button><View style={styles.divider}><View style={[styles.line, { backgroundColor: palette.paperMuted }]} /><Text style={[typography.caption, { color: palette.inkMuted }]}>or</Text><View style={[styles.line, { backgroundColor: palette.paperMuted }]} /></View><Pressable onPress={() => router.replace('/')} style={styles.guest}><Ionicons name="wifi-outline" size={18} color={palette.indigo} /><Text style={[typography.body, { color: palette.indigo, fontWeight: '800' }]}>Continue as guest</Text></Pressable></Card><Card color={palette.indigoTint} style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={22} color={palette.indigo} /><Text style={[typography.caption, { color: palette.indigoDeep, flex: 1 }]}>Your source images stay on-device. Only text you confirm is sent for question generation.</Text></Card><Pressable onPress={() => router.back()} style={styles.back}><Text style={[typography.caption, { color: palette.inkMuted }]}>Back to demo</Text></Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', paddingVertical: spacing.xxxl },
  formCard: { gap: spacing.md, maxWidth: 520, alignSelf: 'center', width: '100%' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, fontSize: 15 },
  passwordRow: { minHeight: 52, borderWidth: 1, borderColor: colors.paperMuted, borderRadius: radii.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  line: { flex: 1, height: 1 },
  guest: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  privacy: { maxWidth: 520, alignSelf: 'center', width: '100%', marginTop: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  back: { alignSelf: 'center', padding: spacing.lg },
});
