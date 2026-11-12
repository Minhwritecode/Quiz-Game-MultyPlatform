import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Badge, BrandMark, Button, Card, IconTile, Screen, SectionHeading, StatCard, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useI18n } from '@/core/i18n';
import PapyrusScene from '@/shared/visuals/PapyrusScene';

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const sets = usePapyrusStore((state) => state.questionSets);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const user = useAuthStore((state) => state.user);
  const { language, toggleLanguage, t } = useI18n();
  const { width } = useWindowDimensions();
  const [roomCode, setRoomCode] = useState('');
  const isWide = width >= 900;
  const totalQuestions = sets.reduce((total, set) => total + set.questions.length, 0);
  const pendingSets = sets.filter((set) => set.syncStatus === 'pending' || set.syncStatus === 'failed').length;

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;
    router.push({ pathname: '/battle', params: { code } });
  };

  return (
    <Screen bottomNav>
      <View style={styles.topHeader}>
        <View style={styles.brandIdentity}>
          <BrandMark size={44} />
          <View>
            <Text style={[typography.title, { color: palette.ink }]}>
              {user?.displayName ? `${t.home.greeting} ${user.displayName}` : 'Papyrus'}
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>{t.home.subtitle}</Text>
          </View>
        </View>
        <View style={styles.topRightControls}>
          <Pressable onPress={toggleLanguage} accessibilityRole="button" accessibilityLabel="Switch language" style={[styles.langPillButton, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{language === 'vi' ? 'VI' : 'EN'}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} style={styles.profileButton} accessibilityRole="button" accessibilityLabel={language === 'vi' ? 'Hồ sơ người dùng' : 'User profile'}>
            <Ionicons name="person-circle-outline" size={36} color={palette.indigo} />
          </Pressable>
        </View>
      </View>

      <Card color={palette.indigo} style={[styles.heroCard, isWide && styles.heroCardWide]}>
        <View style={styles.heroCopy}>
          <View style={styles.heroBadgeRow}>
            <Badge tone="reward">{t.home.heroBadge1}</Badge>
            <Badge tone="success">{t.home.heroBadge2}</Badge>
          </View>
          <Text style={[typography.heading, { color: palette.white, marginTop: spacing.md, maxWidth: 560, fontSize: isWide ? 34 : 26, lineHeight: isWide ? 42 : 33 }]}>
            {t.home.heroTitle}
          </Text>
          <Text style={[typography.body, { color: '#E0E7FF', marginTop: spacing.sm, maxWidth: 540 }]}>{t.home.heroSub}</Text>
          <View style={styles.heroActions}>
            <Button icon="sparkles" onPress={() => router.push('/create/scan')} variant="reward">{t.home.createAiBtn}</Button>
            <Button icon="create-outline" onPress={() => router.push('/create/generate?mode=manual')} variant="secondary">{t.home.createManualBtn}</Button>
            <Button icon="game-controller-outline" onPress={() => router.push('/battle')} variant="secondary">{t.home.battleBtn}</Button>
          </View>
        </View>
        {isWide && <View style={styles.sceneWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><PapyrusScene reduceMotion={reduceMotion} /></View>}
      </Card>

      <SectionHeading title={t.home.statsTitle} />
      <View style={[styles.stats, width >= 720 && styles.statsWide]}>
        <StatCard value={String(sets.length)} label={t.home.statSets} icon="book-outline" tone="primary" />
        <StatCard value={String(totalQuestions)} label={t.home.statQuestions} icon="help-circle-outline" tone="success" />
        <StatCard value={String(pendingSets)} label={t.home.statPending} icon="cloud-upload-outline" tone="reward" />
      </View>

      <Card style={styles.joinCard}>
        <View style={styles.joinText}>
          <IconTile icon="people-outline" tint="primary" />
          <View style={styles.joinCopy}>
            <Text style={[typography.title, { color: palette.ink }]}>{t.home.battleBtn}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>{t.home.featBattleSub}</Text>
          </View>
        </View>
        <View style={styles.joinControls}>
          <TextInput value={roomCode} onChangeText={(value) => setRoomCode(value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())} onSubmitEditing={joinRoom} returnKeyType="go" autoCapitalize="characters" maxLength={6} accessibilityLabel={t.home.enterRoomCode} placeholder="ABC123" placeholderTextColor={palette.inkMuted} style={[styles.codeInput, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]} />
          <Button icon="arrow-forward" onPress={joinRoom} disabled={roomCode.trim().length !== 6}>{t.home.joinRoom}</Button>
        </View>
      </Card>

      <SectionHeading title={t.home.recentTitle} action={t.home.viewAll} onAction={() => router.push('/sets')} />
      {sets.length === 0 ? (
        <Card style={styles.emptyCard}>
          <IconTile icon="book-outline" tint="primary" />
          <View style={styles.setCopy}>
            <Text style={[typography.title, { color: palette.ink }]}>{t.home.studyLibrary}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>{t.home.libraryEmpty}</Text>
          </View>
          <Button onPress={() => router.push('/create/generate?mode=manual')}>{t.home.createManualBtn}</Button>
        </Card>
      ) : sets.slice(0, 3).map((set) => (
        <Card key={set.id} onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })} style={styles.setCard}>
          <IconTile icon="document-text-outline" tint="primary" />
          <View style={styles.setCopy}>
            <Text style={[typography.title, { color: palette.ink }]} numberOfLines={1}>{set.title}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>{set.subject || 'General'} · {set.questions.length} {t.library.questionsCount}</Text>
          </View>
          <View style={styles.trailingSet}>
            <Badge tone={set.syncStatus === 'pending' || set.syncStatus === 'failed' ? 'reward' : 'success'}>{set.syncStatus === 'pending' || set.syncStatus === 'failed' ? t.home.pendingSync : t.home.synced}</Badge>
            <Ionicons name="play-circle" size={28} color={palette.indigo} />
          </View>
        </Card>
      ))}

      <SectionHeading title={t.home.featuresTitle} />
      <View style={[styles.quickGrid, width >= 720 && styles.quickGridWide]}>
        <QuickAction icon="create-outline" tint="primary" title={t.home.createManualBtn} description={t.home.createManualSub} onPress={() => router.push('/create/generate?mode=manual')} palette={palette} />
        <QuickAction icon="scan-outline" tint="success" title={t.home.featScanTitle} description={t.home.featScanSub} onPress={() => router.push('/create/scan')} palette={palette} />
        <QuickAction icon="skull-outline" tint="danger" title={t.survival.title} description={t.survival.subtitle} onPress={() => router.push('/games/survival')} palette={palette} />
        <QuickAction icon="extension-puzzle-outline" tint="reward" title={t.home.featMatchTitle} description={t.home.featMatchSub} onPress={() => router.push('/games/match')} palette={palette} />
        <QuickAction icon="cloud-done-outline" tint="primary" title={t.home.featSyncTitle} description={t.home.featSyncSub} onPress={() => router.push('/sync')} palette={palette} />
      </View>
    </Screen>
  );
}

function QuickAction({ icon, tint, title, description, onPress, palette }: { icon: 'create-outline' | 'scan-outline' | 'skull-outline' | 'extension-puzzle-outline' | 'cloud-done-outline'; tint: 'primary' | 'success' | 'danger' | 'reward'; title: string; description: string; onPress: () => void; palette: ReturnType<typeof usePalette> }) {
  return <Card onPress={onPress} style={styles.quickCard}>
    <IconTile icon={icon} tint={tint} />
    <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>{title}</Text>
    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>{description}</Text>
  </Card>;
}

const styles = StyleSheet.create({
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, gap: spacing.sm },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  langPillButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1.5 },
  profileButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroCard: { padding: spacing.xl, borderRadius: radii.lg, borderWidth: 0, overflow: 'hidden', marginTop: spacing.sm },
  heroCardWide: { minHeight: 330, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xxl },
  heroCopy: { flex: 1, zIndex: 1 },
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  sceneWrap: { width: '38%', minWidth: 300, height: 280, marginLeft: spacing.xl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsWide: { flexWrap: 'nowrap' },
  joinCard: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.lg },
  joinText: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 240 },
  joinCopy: { flex: 1 },
  joinControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, flex: 1, justifyContent: 'flex-end' },
  codeInput: { minWidth: 160, flex: 1, maxWidth: 260, minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, fontWeight: '700', letterSpacing: 1.5 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radii.md },
  setCopy: { flex: 1, minWidth: 100 },
  trailingSet: { alignItems: 'flex-end', gap: spacing.xs },
  quickGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  quickGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  quickCard: { flexBasis: '31%', flexGrow: 1, minHeight: 152 },
});
