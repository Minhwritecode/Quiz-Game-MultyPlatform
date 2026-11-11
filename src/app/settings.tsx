import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Badge, BrandMark, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';

function PreferenceRow({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
        <Ionicons name={icon} size={20} color={palette.indigo} />
      </View>
      <View style={{ flex: 1 }}>
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
  const haptics = usePapyrusStore((state) => state.haptics);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const toggleHaptics = usePapyrusStore((state) => state.toggleHaptics);
  const toggleReduceMotion = usePapyrusStore((state) => state.toggleReduceMotion);

  const handleSignOut = async () => {
    await dependencies.auth.signOut();
    useAuthStore.getState().clear();
    router.replace('/auth');
  };

  return (
    <Screen bottomNav>
      <TopBar title={t.settings.title} />

      {/* User Profile Card */}
      <Card style={styles.profile}>
        <BrandMark size={56} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.title, { color: palette.ink }]}>
            {user?.displayName ?? (user?.email ? user.email.split('@')[0] : t.settings.guestName)}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>
            {user ? t.settings.authStatus : t.settings.guestStatus}
          </Text>
        </View>
        <Badge tone={user ? 'success' : 'neutral'}>
          {user ? t.settings.badgeAuth : t.settings.badgeGuest}
        </Badge>
      </Card>

      {/* Preferences Section */}
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        {t.settings.appPreferences}
      </Text>

      <Card style={styles.group}>
        <PreferenceRow icon="moon-outline" title={t.settings.themeTitle} subtitle={t.settings.themeSub}>
          <Badge tone="neutral">{t.settings.themeVal}</Badge>
        </PreferenceRow>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />

        {/* Language Switcher */}
        <Pressable accessibilityRole="button" onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}>
          <PreferenceRow icon="language-outline" title={t.settings.langTitle} subtitle={t.settings.langSub}>
            <Badge tone="primary">
              {language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
            </Badge>
          </PreferenceRow>
        </Pressable>

        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <PreferenceRow icon="sparkles-outline" title={t.settings.hapticsTitle} subtitle={t.settings.hapticsSub}>
          <Switch
            value={haptics}
            onValueChange={toggleHaptics}
            trackColor={{ false: palette.paperMuted, true: palette.indigo }}
          />
        </PreferenceRow>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <PreferenceRow icon="options-outline" title={t.settings.reduceMotionTitle} subtitle={t.settings.reduceMotionSub}>
          <Switch
            value={reduceMotion}
            onValueChange={toggleReduceMotion}
            trackColor={{ false: palette.paperMuted, true: palette.indigo }}
          />
        </PreferenceRow>
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
            <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
          </PreferenceRow>
        </Pressable>
        <View style={[styles.separator, { backgroundColor: palette.paperMuted }]} />
        <Pressable accessibilityRole="button" style={styles.row} onPress={() => router.push('/sets')}>
          <View style={[styles.iconWrap, { backgroundColor: palette.paper }]}>
            <Ionicons name="server-outline" size={20} color={palette.indigo} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
              {t.settings.manageLocalTitle}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {t.settings.manageLocalSub}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
        </Pressable>
      </Card>

      {/* About Box */}
      <Card color={palette.indigoTint} style={styles.about}>
        <Text style={[typography.title, { color: palette.indigo }]}>{t.settings.aboutTitle}</Text>
        <Text style={[typography.caption, { color: palette.indigoDeep, marginTop: 4, lineHeight: 20 }]}>
          {t.settings.aboutDesc}
        </Text>
      </Card>

      {/* Sign Out / Sign In Action */}
      {user ? (
        <Pressable onPress={handleSignOut} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={20} color={palette.danger} />
          <Text style={[typography.body, { color: palette.danger, fontWeight: '800' }]}>
            {t.settings.signOut}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/auth')} style={styles.signOut}>
          <Ionicons name="log-in-outline" size={20} color={palette.indigo} />
          <Text style={[typography.body, { color: palette.indigo, fontWeight: '800' }]}>
            {t.settings.signIn}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.md },
  group: { padding: 0, overflow: 'hidden', borderRadius: radii.md },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  separator: { height: 1, marginLeft: 64 },
  about: { marginTop: spacing.xl, borderRadius: radii.md },
  signOut: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
});
