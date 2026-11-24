import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import {
  Badge,
  BrandMark,
  Button,
  Card,
  IconTile,
  OnlineStatusDot,
  ProgressBar,
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
import { dependencies } from '@/composition/dependencies';
import { roomApi } from '@/composition/platform';
import { seedQuestionSets } from '@/composition/preferences';
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
  const storeSets = usePapyrusStore((state) => state.questionSets);
  const sets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const eloRating = usePapyrusStore((state) => state.eloRating);
  const user = useAuthStore((state) => state.user);
  const openAssistant = useAssistantUiStore((state) => state.openAssistant);
  const { language, toggleLanguage, t } = useI18n();
  const { width } = useWindowDimensions();
  const [roomCode, setRoomCode] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [unfinishedStudy, setUnfinishedStudy] = useState<{
    setId: string;
    title: string;
    answered: number;
    total: number;
  } | null>(null);

  const isWide = width >= 900;
  const desktopWeb = Platform.OS === 'web' && width >= 900;

  const totalQuestions = useMemo(
    () => sets.reduce((total, set) => total + set.questions.length, 0),
    [sets]
  );

  const subjectChips = useMemo(() => {
    const uniq = new Set<string>();
    for (const s of sets) {
      if (s.subject?.trim()) uniq.add(s.subject.trim());
    }
    return ['ALL', ...Array.from(uniq).slice(0, 8)];
  }, [sets]);

  const displayedSets = useMemo(() => {
    const filtered =
      subjectFilter === 'ALL' ? sets : sets.filter((s) => (s.subject || '').trim() === subjectFilter);
    return filtered.slice(0, 4);
  }, [sets, subjectFilter]);

  const joinKahootOrRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push({ pathname: '/multiplayer/join', params: { room: code } });
  };

  const quickHostKahoot = async () => {
    const first = sets[0];
    if (!first) return;
    const created = await roomApi.create(first.id, user?.displayName || 'Chủ phòng');
    router.push({ pathname: '/multiplayer/host/[roomCode]', params: { roomCode: created.roomCode } });
  };

  useEffect(() => {
    useStreakStore.getState().refreshStreakStatus();
  }, []);

  // Detect unfinished study session for Duolingo-style 1-tap resume banner
  useEffect(() => {
    let active = true;
    void dependencies.study
      .listProgress()
      .then((list) => {
        if (!active || list.length === 0) return;
        const latest = list[0]!;
        const target = sets.find((s) => s.id === latest.questionSetId);
        if (target && target.questions.length > 0) {
          setUnfinishedStudy({
            setId: target.id,
            title: target.title,
            answered: Math.max(1, latest.answers.length || latest.currentIndex),
            total: target.questions.length,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [sets]);

  const heroGradientWeb =
    Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #12103E 0%, #2E1065 48%, #4F46E5 100%)',
        } as unknown as ViewStyle)
      : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomNav>
        {/* Flagship Mobile Header */}
        {!desktopWeb && (
          <View style={styles.topHeader}>
            <View style={styles.brandIdentity}>
              <BrandMark size={44} />
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

        {/* Status Utility Pills */}
        <View style={[styles.utilityBar, desktopWeb && { marginTop: spacing.md }]}>
          <StreakBadge />
          <VipBadge />
          <SoundToggle />
          <InstallWebAppButton />
        </View>

        {/* Duolingo-Style Unfinished Lesson Resume Banner */}
        {unfinishedStudy && (
          <SmoothReveal>
            <Card
              onPress={() =>
                router.push({ pathname: '/study/[setId]', params: { setId: unfinishedStudy.setId } })
              }
              style={[styles.resumeCard, { borderColor: palette.mint, backgroundColor: palette.paperRaised }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="play-forward" tint="success" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: palette.mint, letterSpacing: 0.4 }}>
                    📜 BÀI HỌC ĐANG DANG DỞ · TIẾP TỤC NGAY
                  </Text>
                  <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]} numberOfLines={1}>
                    {unfinishedStudy.title}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar progress={unfinishedStudy.answered / Math.max(1, unfinishedStudy.total)} tone="success" />
                  </View>
                </View>
                <Ionicons name="chevron-forward-circle" size={28} color={palette.mint} />
              </View>
            </Card>
          </SmoothReveal>
        )}

        {/* Primary 3D RPG Hero Card */}
        <SmoothReveal>
          <Card
            color="#20165E"
            style={[styles.heroCard, isWide && styles.heroCardWide, heroGradientWeb]}
          >
            <View style={styles.heroCopy}>
              <View style={styles.heroEyebrowPill}>
                <Ionicons name="flame" size={13} color="#FDE68A" />
                <Text style={styles.heroEyebrowText}>AI · 3D RPG ARENA · KAHOOT LIVE</Text>
              </View>
              <Text
                style={[
                  typography.heading,
                  {
                    color: '#FFFFFF',
                    maxWidth: 560,
                    fontSize: isWide ? 31 : 23,
                    lineHeight: isWide ? 39 : 30,
                    marginTop: 8,
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

            <View style={isWide ? styles.sceneWrapWide : styles.sceneWrapMobile}>
              <HomeHero3DShowcase compact={!isWide} reduceMotion={reduceMotion} />
            </View>
          </Card>
        </SmoothReveal>

        {/* NEW: Non-Quiz 3D Action Learning Games Spotlight */}
        <SmoothReveal delay={50}>
          <SectionHeading
            title={language === 'vi' ? '🎮 Game Hành Động 3D (Học Không Cần Trắc Nghiệm)' : '🎮 3D Action Games (Zero Multiple Choice)'}
          />
          <View style={[styles.arcadeRow, width >= 640 && styles.arcadeRowWide]}>
            <Card
              color="#1A103D"
              onPress={() => router.push('/games/archer')}
              style={[styles.arcadeBannerCard, { borderColor: '#FB923C' }]}
            >
              <View style={styles.arcadeTopRow}>
                <Badge tone="fire">🏹 3D SHOOTER MỚI</Badge>
                <Ionicons name="arrow-forward-circle" size={24} color="#FDBA74" />
              </View>
              <Text style={[typography.title, { color: '#FFFFFF', marginTop: 8 }]}>
                Cung Thủ Diệt Thiên Thạch 3D
              </Text>
              <Text style={[typography.caption, { color: '#FED7AA', marginTop: 4 }]}>
                Ngắm nỏ Phượng Hoàng 3D bắn rơi thiên thạch mang khái niệm đúng hoặc gõ nhanh ký tự đầu để phóng mưa tên lửa!
              </Text>
            </Card>

            <Card
              color="#0B2926"
              onPress={() => router.push('/games/alchemy')}
              style={[styles.arcadeBannerCard, { borderColor: '#34D399' }]}
            >
              <View style={styles.arcadeTopRow}>
                <Badge tone="success">🧪 3D ALCHEMY MỚI</Badge>
                <Ionicons name="arrow-forward-circle" size={24} color="#6EE7B7" />
              </View>
              <Text style={[typography.title, { color: '#FFFFFF', marginTop: 8 }]}>
                Giả Kim Thuật Phân Loại 3D
              </Text>
              <Text style={[typography.caption, { color: '#A7F3D0', marginTop: 4 }]}>
                Ném tinh thể kiến thức vào đúng 1 trong 3 lò giả kim 3D đang sôi sục để kích hoạt chuỗi Lửa Phượng Hoàng!
              </Text>
            </Card>
          </View>
        </SmoothReveal>

        {/* Instant Kahoot Party Live Join & Host Bar */}
        <SmoothReveal delay={85}>
          <Card style={[styles.joinCard, { borderColor: palette.indigoBorder, borderWidth: 1.5 }]}>
            <View style={styles.joinText}>
              <IconTile icon="flash" tint="reward" />
              <View style={styles.joinCopy}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  ⚡ Đấu Nhóm Kahoot Live (Không cần đăng nhập)
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                  Nhập mã PIN 6 ký tự từ bạn bè hoặc mở phòng Kahoot mới chỉ với 1 chạm
                </Text>
              </View>
            </View>
            <View style={styles.joinControls}>
              <TextInput
                value={roomCode}
                onChangeText={(value) => setRoomCode(value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())}
                onSubmitEditing={joinKahootOrRoom}
                returnKeyType="go"
                autoCapitalize="characters"
                maxLength={6}
                accessibilityLabel={t.home.enterRoomCode}
                placeholder="MÃ PIN"
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.codeInput,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              />
              <Button icon="enter-outline" onPress={joinKahootOrRoom} disabled={roomCode.trim().length < 4}>
                Vào phòng
              </Button>
              <Button variant="reward" icon="megaphone-outline" onPress={() => void quickHostKahoot()}>
                Mở Kahoot
              </Button>
            </View>
          </Card>
        </SmoothReveal>

        {/* Clean 3-Stat Overview */}
        <SmoothReveal delay={110}>
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

        {/* University Knowledge Bank with Subject Filter Chips */}
        <SmoothReveal delay={140}>
          <SectionHeading title={t.home.recentTitle} action={t.home.viewAll} onAction={() => router.push('/sets')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectFilterRow}
          >
            {subjectChips.map((subj) => {
              const active = subjectFilter === subj;
              return (
                <Pressable
                  key={subj}
                  onPress={() => setSubjectFilter(subj)}
                  style={[
                    styles.subjectPill,
                    {
                      backgroundColor: active ? palette.indigo : palette.paperRaised,
                      borderColor: active ? palette.indigo : palette.paperMuted,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : palette.ink }}>
                    {subj === 'ALL' ? `🔥 Tất cả (${sets.length})` : subj}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {displayedSets.map((set) => (
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
                  {set.subject || 'Đại học'} · {set.questions.length} {t.library.questionsCount}
                </Text>
              </View>
              <Ionicons name="play-circle" size={30} color={palette.indigo} />
            </Card>
          ))}
        </SmoothReveal>

        {/* 4-Card Arena & Multimodal AI Studio Bento Grid */}
        <SmoothReveal delay={170}>
          <SectionHeading title={language === 'vi' ? 'Đấu trường Nhập vai 3D & Gia sư AI' : '3D RPG Arena & AI Tutor'} />
          <View style={[styles.quickGrid, width >= 640 && styles.quickGridWide]}>
            <QuickAction
              icon="skull-outline"
              tint="danger"
              title={t.survival.title}
              description="Đứng trên sàn đấu 3D: bắn tên lửa hạ Golem Hắc Thạch hoặc đỡ đá tảng!"
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
              description="Phòng PIN Colosseum, Kahoot Live & Đấu xếp hạng 1v1 ELO"
              onPress={() => router.push('/battle')}
              palette={palette}
            />
            <QuickAction
              icon="chatbubbles-outline"
              tint="success"
              title={language === 'vi' ? 'Papybot Đa Phương Thức' : 'Multimodal Papybot'}
              description="Chụp ảnh bài tập, gửi PDF/DOCX, nói bằng 🎤 Mic & nghe giảng 🔊"
              onPress={() => openAssistant()}
              palette={palette}
            />
          </View>
        </SmoothReveal>
      </Screen>

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
    paddingVertical: spacing.sm,
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
  resumeCard: { borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.md },
  heroCard: { padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: 'rgba(165,180,252,0.32)', overflow: 'hidden' },
  heroCardWide: { minHeight: 330, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xxl },
  heroCopy: { flex: 1, zIndex: 1 },
  heroEyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.45)',
  },
  heroEyebrowText: { color: '#FDE68A', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.6 },
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
  sceneWrapWide: { width: '42%', minWidth: 310, marginLeft: spacing.xl },
  sceneWrapMobile: { width: '100%', marginTop: spacing.md },
  arcadeRow: { gap: spacing.sm },
  arcadeRowWide: { flexDirection: 'row' },
  arcadeBannerCard: { flex: 1, borderWidth: 1.5, padding: spacing.lg },
  arcadeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statsWide: { flexWrap: 'nowrap' },
  subjectFilterRow: { gap: 8, paddingBottom: spacing.sm },
  subjectPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1 },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  setCopy: { flex: 1, minWidth: 0 },
  quickGrid: { gap: spacing.sm },
  quickGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  quickCard: { flex: 1, minWidth: 230 },
  joinCard: { marginTop: spacing.lg, gap: spacing.md },
  joinText: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  joinCopy: { flex: 1, minWidth: 0 },
  joinControls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  codeInput: {
    flex: 1,
    minWidth: 120,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
