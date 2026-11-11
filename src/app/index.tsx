import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Badge, BrandMark, Button, Card, IconTile, Screen, SectionHeading, StatCard, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useI18n } from '@/core/i18n';

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const sets = usePapyrusStore((state) => state.questionSets);
  const user = useAuthStore((state) => state.user);
  const { language, toggleLanguage, t } = useI18n();
  const { width } = useWindowDimensions();

  return (
    <Screen bottomNav>
      {/* Top Header & Language Switcher (Đã bỏ streak, thay bằng nút đổi ngôn ngữ trực tiếp) */}
      <View style={styles.topHeader}>
        <View style={styles.brandIdentity}>
          <BrandMark size={44} />
          <View>
            <Text style={[typography.title, { color: palette.ink }]}>
              {user?.displayName ? `${t.home.greeting} ${user.displayName}` : 'Papyrus Quiz'}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              {t.home.subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.topRightControls}>
          {/* Button chuyển đổi English mode & Tiếng Việt mode */}
          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel="Switch language"
            style={[
              styles.langPillButton,
              { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
            ]}
          >
            <Text style={styles.langEmoji}>{language === 'vi' ? '🇻🇳' : '🇬🇧'}</Text>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
              {language === 'vi' ? 'VI' : 'EN'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.profileButton}
            accessibilityRole="button"
            accessibilityLabel="Settings and profile"
          >
            <Ionicons name="person-circle-outline" size={36} color={palette.indigo} />
          </Pressable>
        </View>
      </View>

      {/* Hero Banner */}
      <Card color={palette.indigo} style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <Badge tone="reward">{t.home.heroBadge1}</Badge>
          <Badge tone="success">{t.home.heroBadge2}</Badge>
        </View>
        <Text style={[typography.heading, { color: palette.white, marginTop: spacing.md, maxWidth: 540 }]}>
          {t.home.heroTitle}
        </Text>
        <Text style={[typography.body, { color: '#E0E7FF', marginTop: spacing.xs, maxWidth: 540 }]}>
          {t.home.heroSub}
        </Text>
        <View style={styles.heroActions}>
          <Button
            icon="sparkles"
            onPress={() => router.push('/create/scan')}
            variant="reward"
          >
            {t.home.createAiBtn}
          </Button>
          <Button
            icon="extension-puzzle-outline"
            onPress={() => router.push('/games/match')}
            variant="secondary"
          >
            {t.home.matchGameBtn}
          </Button>
          <Button
            icon="game-controller-outline"
            onPress={() => router.push('/battle')}
            variant="ghost"
          >
            {t.home.battleBtn}
          </Button>
        </View>
      </Card>

      {/* Progress & Stats */}
      <SectionHeading title={t.home.statsTitle} />
      <View style={[styles.stats, width >= 720 && styles.statsWide]}>
        <StatCard value={String(sets.length)} label={t.home.statSets} icon="book-outline" tone="primary" />
        <StatCard value="88%" label={t.home.statAccuracy} icon="analytics-outline" tone="success" />
        <StatCard value="1,240" label="XP" icon="flash-outline" tone="reward" />
      </View>

      {/* Recent Sets */}
      <SectionHeading
        title={t.home.recentTitle}
        action={t.home.viewAll}
        onAction={() => router.push('/sets')}
      />
      {sets.slice(0, 3).map((set) => (
        <Card
          key={set.id}
          onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })}
          style={styles.setCard}
        >
          <IconTile icon="document-text-outline" tint="primary" />
          <View style={styles.setCopy}>
            <Text style={[typography.title, { color: palette.ink }]}>{set.title}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>
              {set.subject || 'General'} · {set.questions.length} {t.library.questionsCount}
            </Text>
          </View>
          <View style={styles.trailingSet}>
            <Badge tone={set.syncStatus === 'pending' ? 'reward' : 'success'}>
              {set.syncStatus === 'pending' ? t.home.pendingSync : t.home.synced}
            </Badge>
            <Ionicons name="play-circle" size={28} color={palette.indigo} />
          </View>
        </Card>
      ))}

      {/* Quick Action Grid */}
      <SectionHeading title={t.home.featuresTitle} />
      <View style={[styles.quickGrid, width >= 720 && styles.quickGridWide]}>
        <Card onPress={() => router.push('/create/scan')} style={styles.quickCard}>
          <IconTile icon="scan-outline" tint="success" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.home.featScanTitle}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.home.featScanSub}
          </Text>
        </Card>
        <Card onPress={() => router.push('/games/survival')} style={styles.quickCard}>
          <IconTile icon="skull-outline" tint="danger" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.survival.title}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.survival.subtitle}
          </Text>
        </Card>
        <Card onPress={() => router.push('/games/match')} style={styles.quickCard}>
          <IconTile icon="extension-puzzle-outline" tint="reward" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.home.featMatchTitle}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.home.featMatchSub}
          </Text>
        </Card>
        <Card onPress={() => router.push('/battle')} style={styles.quickCard}>
          <IconTile icon="flash-outline" tint="reward" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.home.featBattleTitle}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.home.featBattleSub}
          </Text>
        </Card>
        <Card onPress={() => router.push('/sync')} style={styles.quickCard}>
          <IconTile icon="cloud-done-outline" tint="primary" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {t.home.featSyncTitle}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.home.featSyncSub}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  langEmoji: { fontSize: 16 },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 0,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  heroBadgeRow: { flexDirection: 'row', gap: spacing.xs },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsWide: { flexWrap: 'nowrap' },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  setCopy: { flex: 1 },
  trailingSet: { alignItems: 'flex-end', gap: spacing.xs },
  quickGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  quickGridWide: { flexDirection: 'row' },
  quickCard: { flex: 1, minHeight: 140 },
});
