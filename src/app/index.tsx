import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import {
  BrandMark,
  Button,
  Card,
  IconTile,
  OnlineStatusDot,
  Screen,
  SectionHeading,
  SmoothReveal,
  StatCard,
  usePalette,
} from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { useI18n } from '@/core/i18n';
import { HomeHero3DShowcase } from '@/shared/visuals/HomeHero3DShowcase';
import { StreakBadge } from '@/features/streak/presentation/StreakBadge';
import { VipBadge } from '@/features/membership/presentation/VipBadge';
import { SoundToggle } from '@/shared/SoundToggle';
import { InstallWebAppButton } from '@/shared/InstallWebAppButton';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { NotificationBell } from '@/features/notifications/presentation/NotificationBell';
import { DraggableHomePapybot } from '@/features/assistant/presentation/DraggableHomePapybot';

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const sets = usePapyrusStore((state) => state.questionSets);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const eloRating = usePapyrusStore((state) => state.eloRating);
  const user = useAuthStore((state) => state.user);
  const openAssistant = useAssistantUiStore((state) => state.openAssistant);
  const { language, toggleLanguage, t } = useI18n();
  const { width } = useWindowDimensions();
  const [roomCode, setRoomCode] = useState('');
  const isWide = width >= 900;
  const desktopWeb = Platform.OS === 'web' && width >= 900;

  const totalQuestions = useMemo(
    () => sets.reduce((total, set) => total + set.questions.length, 0),
    [sets]
  );
  const recentSets = useMemo(() => sets.slice(0, 3), [sets]);

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) return;
    router.push({ pathname: '/battle', params: { code } });
  };

  useEffect(() => {
    useStreakStore.getState().refreshStreakStatus();
  }, []);

  const heroGradientWeb =
    Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #161347 0%, #312E81 48%, #4F46E5 100%)',
        } as unknown as ViewStyle)
      : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomNav>
        {/* Clean Mobile Header with Minimal Red/Green Online Dot & Notification Bell */}
        {!desktopWeb && (
          <View style={styles.topHeader}>
            <View style={styles.brandIdentity}>
              <BrandMark size={42} />
              <View style={styles.brandIdentityCopy}>
                <View style={styles.nameDotRow}>
                  <Text style={[typography.title, { color: palette.ink, flexShrink: 1 }]} numberOfLines={1}>
                    {user?.displayName ? `${t.home.greeting} ${user.displayName}` : 'Papyrus'}
                  </Text>
                  <OnlineStatusDot />
                </View>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  {t.home.subtitle}
                </Text>
              </View>
            </View>
            <View style={styles.topRightControls}>
              <NotificationBell />
              <Pressable
                onPress={toggleLanguage}
                accessibilityRole="button"
                accessibilityLabel="Switch language"
                style={[
                  styles.langPillButton,
                  { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
                ]}
              >
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                  {language === 'vi' ? 'VI' : 'EN'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/profile')}
                style={styles.profileButton}
                accessibilityRole="button"
                accessibilityLabel={language === 'vi' ? 'Hồ sơ người dùng' : 'User profile'}
              >
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatarImg} />
                ) : (
                  <Ionicons name="person-circle-outline" size={36} color={palette.indigo} />
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Compact Status Strip (Streak · VIP · Sound · Web Install when supported) */}
        <View style={[styles.utilityBar, desktopWeb && { marginTop: spacing.md }]}>
          <StreakBadge />
          <VipBadge />
          <SoundToggle />
          <InstallWebAppButton />
        </View>

        {/* Cosmic Primary Hero Card WITH Interactive Animated 3D Showcase on BOTH Mobile & Desktop */}
        <SmoothReveal>
          <Card
            color="#252275"
            style={[styles.heroCard, isWide && styles.heroCardWide, heroGradientWeb]}
          >
            <View style={styles.heroCopy}>
              <Text
                style={[
                  typography.heading,
                  {
                    color: '#FFFFFF',
                    maxWidth: 560,
                    fontSize: isWide ? 31 : 23,
                    lineHeight: isWide ? 39 : 30,
                  },
                ]}
              >
                {t.home.heroTitle}
              </Text>
              <Text style={[typography.body, { color: '#E0E7FF', marginTop: spacing.xs, maxWidth: 540 }]}>
                {t.home.heroSub}
              </Text>
              <View style={styles.heroActions}>
                <Button icon="sparkles" onPress={() => router.push('/create/scan')} variant="reward">
                  {t.home.createAiBtn}
                </Button>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/create/generate?mode=manual')}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.heroGlassBtn,
                    {
                      backgroundColor: hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)',
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  <Text style={[typography.body, { color: '#FFFFFF', fontWeight: '800' }]}>
                    {t.home.createManualBtn}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Full-Color Interactive Blender 3D Showcase (Visible on BOTH Mobile & Desktop!) */}
            <View style={isWide ? styles.sceneWrapWide : styles.sceneWrapMobile}>
              <HomeHero3DShowcase compact={!isWide} reduceMotion={reduceMotion} />
            </View>
          </Card>
        </SmoothReveal>

        {/* Clean 3-Stat Overview */}
        <SmoothReveal delay={60}>
          <SectionHeading title={t.home.statsTitle} />
          <View style={[styles.stats, width >= 720 && styles.statsWide]}>
            <StatCard value={String(sets.length)} label={t.home.statSets} icon="book-outline" tone="primary" />
            <StatCard
              value={String(totalQuestions)}
              label={t.home.statQuestions}
              icon="help-circle-outline"
              tone="success"
            />
            <StatCard value={`${eloRating}`} label="ELO" icon="trophy-outline" tone="reward" />
          </View>
        </SmoothReveal>

        {/* Recent Study Sets */}
        <SmoothReveal delay={110}>
          <SectionHeading title={t.home.recentTitle} action={t.home.viewAll} onAction={() => router.push('/sets')} />
          {sets.length === 0 ? (
            <Card style={styles.emptyCard}>
              <IconTile icon="book-outline" tint="primary" />
              <View style={styles.setCopy}>
                <Text style={[typography.title, { color: palette.ink }]}>{t.home.studyLibrary}</Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>
                  {t.home.libraryEmpty}
                </Text>
              </View>
              <Button onPress={() => router.push('/create/scan')}>{t.home.createAiBtn}</Button>
            </Card>
          ) : (
            recentSets.map((set) => (
              <Card
                key={set.id}
                onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })}
                style={styles.setCard}
              >
                <IconTile icon="document-text-outline" tint="primary" />
                <View style={styles.setCopy}>
                  <Text style={[typography.title, { color: palette.ink }]} numberOfLines={1}>
                    {set.title}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]} numberOfLines={1}>
                    {set.subject || (language === 'vi' ? 'Tổng hợp' : 'General')} · {set.questions.length}{' '}
                    {t.library.questionsCount}
                  </Text>
                </View>
                <Ionicons name="play-circle" size={30} color={palette.indigo} />
              </Card>
            ))
          )}
        </SmoothReveal>

        {/* Organized 4-Card Arena & AI Hub */}
        <SmoothReveal delay={150}>
          <SectionHeading title={language === 'vi' ? 'Chế độ học & Đấu trường' : 'Study & Arena Modes'} />
          <View style={[styles.quickGrid, width >= 640 && styles.quickGridWide]}>
            <QuickAction
              icon="skull-outline"
              tint="danger"
              title={t.survival.title}
              description={t.survival.subtitle}
              onPress={() => router.push('/games/survival')}
              palette={palette}
            />
            <QuickAction
              icon="extension-puzzle-outline"
              tint="reward"
              title={t.home.featMatchTitle}
              description={t.home.featMatchSub}
              onPress={() => router.push('/games/match')}
              palette={palette}
            />
            <QuickAction
              icon="game-controller-outline"
              tint="primary"
              title={t.home.battleBtn}
              description={t.home.featBattleSub}
              onPress={() => router.push('/battle')}
              palette={palette}
            />
            <QuickAction
              icon="chatbubbles-outline"
              tint="success"
              title={language === 'vi' ? 'Gia sư AI Papybot' : 'Papybot AI Tutor'}
              description={
                language === 'vi'
                  ? 'Hỏi bài trực tiếp, đính kèm PDF/DOCX để giải thích chi tiết'
                  : 'Ask study questions and attach PDF/DOCX notes'
              }
              onPress={() => openAssistant()}
              palette={palette}
            />
          </View>
        </SmoothReveal>

        {/* Compact Quick Join Room Bar */}
        <SmoothReveal delay={190}>
          <Card style={styles.joinCard}>
            <View style={styles.joinText}>
              <IconTile icon="people-outline" tint="primary" />
              <View style={styles.joinCopy}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  {language === 'vi' ? 'Vào nhanh phòng đấu bằng mã PIN' : 'Quick Join by Room PIN'}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                  {language === 'vi'
                    ? 'Nhập mã 6 ký tự từ bạn bè để vào phòng ngay'
                    : 'Enter a 6-character code shared by your host'}
                </Text>
              </View>
            </View>
            <View style={styles.joinControls}>
              <TextInput
                value={roomCode}
                onChangeText={(value) => setRoomCode(value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())}
                onSubmitEditing={joinRoom}
                returnKeyType="go"
                autoCapitalize="characters"
                maxLength={6}
                accessibilityLabel={t.home.enterRoomCode}
                placeholder="ABC123"
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.codeInput,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              />
              <Button icon="arrow-forward" onPress={joinRoom} disabled={roomCode.trim().length !== 6}>
                {t.home.joinRoom}
              </Button>
            </View>
          </Card>
        </SmoothReveal>
      </Screen>

      {/* Draggable, Glowing, Pulsing, Dismissible Home Papybot Mascot */}
      <DraggableHomePapybot />
    </View>
  );
}

const QuickAction = memo(function QuickAction({
  icon,
  tint,
  title,
  description,
  onPress,
  palette,
}: {
  icon: 'skull-outline' | 'extension-puzzle-outline' | 'game-controller-outline' | 'chatbubbles-outline';
  tint: 'primary' | 'success' | 'danger' | 'reward';
  title: string;
  description: string;
  onPress: () => void;
  palette: ReturnType<typeof usePalette>;
}) {
  return (
    <Card onPress={onPress} style={styles.quickCard}>
      <IconTile icon={icon} tint={tint} />
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]} numberOfLines={2}>
        {description}
      </Text>
    </Card>
  );
});

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 0 },
  brandIdentityCopy: { flex: 1, minWidth: 0 },
  nameDotRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  utilityBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  langPillButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#818CF8' },
  heroCard: { padding: spacing.lg, borderRadius: radii.lg, borderWidth: 0, overflow: 'hidden' },
  heroCardWide: { minHeight: 320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xxl },
  heroCopy: { flex: 1, zIndex: 1 },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  heroGlassBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sceneWrapWide: { width: '40%', minWidth: 300, marginLeft: spacing.xl },
  sceneWrapMobile: { width: '100%', marginTop: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsWide: { flexWrap: 'nowrap' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  setCopy: { flex: 1, minWidth: 100 },
  quickGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  quickGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  quickCard: { flexBasis: '47%', flexGrow: 1, minHeight: 138 },
  joinCard: {
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  joinText: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 220 },
  joinCopy: { flex: 1, minWidth: 0 },
  joinControls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, flex: 1, justifyContent: 'flex-end' },
  codeInput: {
    minWidth: 120,
    flex: 1,
    maxWidth: 220,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
