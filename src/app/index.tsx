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
  usePalette,
} from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { CreateStoryCard916, StoryCard916 } from '@/features/community/presentation/StoryCard916';
import { StoryComposerModal, StoryViewerModal } from '@/features/community/presentation/StoryModalViewer';
import {
  groupStoriesByAuthor,
  isStoryActive24h,
  type ScholarStory,
} from '@/features/community/domain/models';
import { useSocialStore } from '@/features/social/state/useSocialStore';
import { getScholarRankInfo } from '@/core/domain/scholarRank';
import { getLocalDateString } from '@/features/streak/domain/models';
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
import { sfx } from '@/core/audio/sfx';

type FocusTabKey = 'quests' | 'pomodoro' | 'daily';

export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const storeSets = usePapyrusStore((state) => state.questionSets);
  const sets = useMemo(() => (storeSets.length > 0 ? storeSets : seedQuestionSets), [storeSets]);
  const reduceMotion = usePapyrusStore((state) => state.reduceMotion);
  const eloRating = usePapyrusStore((state) => state.eloRating);
  const totalScore = usePapyrusStore((state) => state.totalScore);
  const gamesPlayed = usePapyrusStore((state) => state.gamesPlayed);
  const addBonusXp = usePapyrusStore((state) => state.addBonusXp);
  const user = useAuthStore((state) => state.user);
  const openAssistant = useAssistantUiStore((state) => state.openAssistant);
  const todayCompleted = useStreakStore((state) => state.todayCompleted);
  const checkInToday = useStreakStore((state) => state.checkInToday);
  const stories = useCommunityStore((state) => state.stories);
  const socialPosts = useSocialStore((state) => state.posts);
  const addStory = useCommunityStore((state) => state.addStory);
  const markStoryViewed = useCommunityStore((state) => state.markStoryViewed);
  const reactToStory = useCommunityStore((state) => state.reactToStory);
  const [viewingHomeStoryGroup, setViewingHomeStoryGroup] = useState<ScholarStory[] | null>(null);
  const [homeStoryComposerOpen, setHomeStoryComposerOpen] = useState(false);
  const groupedHomeStories = useMemo(
    () => groupStoriesByAuthor(stories.filter((s) => isStoryActive24h(s))).slice(0, 8),
    [stories]
  );
  const latestCommunityPost = useMemo(
    () => socialPosts.find((p) => p.lifecycleStatus === 'published' && p.audience === 'public'),
    [socialPosts]
  );

  const { language, toggleLanguage, t } = useI18n();
  const { width } = useWindowDimensions();
  const [roomCode, setRoomCode] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  // 3D Showcase enabled by default across mobile & desktop
  const [showMobile3D, setShowMobile3D] = useState(true);
  const [focusTab, setFocusTab] = useState<FocusTabKey>('quests');
  const [unfinishedStudy, setUnfinishedStudy] = useState<{
    setId: string;
    title: string;
    answered: number;
    total: number;
  } | null>(null);

  const [selectedDailyOpt, setSelectedDailyOpt] = useState<number | null>(null);
  const [dailyRewarded, setDailyRewarded] = useState(false);

  const [pomoMode, setPomoMode] = useState<'focus' | 'break'>('focus');
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  const isWide = width >= 900;
  const isTabletUp = width >= 720;
  const desktopWeb = Platform.OS === 'web' && width >= 900;
  const rankInfo = useMemo(() => getScholarRankInfo(totalScore), [totalScore]);

  const totalQuestions = useMemo(
    () => sets.reduce((total, set) => total + set.questions.length, 0),
    [sets]
  );

  const dailyQuestion = useMemo(() => {
    const allQs = seedQuestionSets.flatMap((s) =>
      s.questions
        .filter((q) => q.options.length >= 2)
        .map((q) => ({ ...q, setTitle: s.title, subject: s.subject }))
    );
    if (allQs.length === 0) return null;
    const todayStr = getLocalDateString();
    let hash = 0;
    for (let i = 0; i < todayStr.length; i++) {
      hash = (hash * 31 + todayStr.charCodeAt(i)) >>> 0;
    }
    return allQs[hash % allQs.length] ?? allQs[0]!;
  }, []);

  useEffect(() => {
    if (!pomoRunning) return;
    const id = setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          if (pomoMode === 'focus') {
            addBonusXp(40);
            sfx.playLevelUp();
            setPomoMode('break');
            return 5 * 60;
          }
          setPomoMode('focus');
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [addBonusXp, pomoMode, pomoRunning]);

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
    return filtered.slice(0, 3);
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
  }, [user?.id]);

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

  const completedQuests =
    (todayCompleted ? 1 : 0) + (dailyRewarded ? 1 : 0) + (gamesPlayed > 0 ? 1 : 0);

  const pomoMin = String(Math.floor(pomoSeconds / 60)).padStart(2, '0');
  const pomoSec = String(pomoSeconds % 60).padStart(2, '0');

  const questsBlock = (
    <View style={{ gap: 10 }}>
      <View style={styles.arcadeTopRow}>
        <View>
          <Text style={[typography.label, { color: palette.indigo }]}>
            MỤC TIÊU HÔM NAY ({completedQuests}/3)
          </Text>
          <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]}>
            {rankInfo.badge} Cấp {rankInfo.level} · {rankInfo.titleVi}
          </Text>
        </View>
        <Text
          style={[
            typography.caption,
            { color: palette.indigo, fontWeight: '800', fontVariant: ['tabular-nums'] },
          ]}
        >
          {rankInfo.currentLevelXp}/{rankInfo.xpForNextLevel} XP
        </Text>
      </View>
      <ProgressBar progress={rankInfo.progress} tone="primary" />

      <View style={{ gap: 7 }}>
        <Pressable
          disabled={todayCompleted}
          onPress={() => {
            const res = checkInToday();
            if (res.streakUpdated) {
              addBonusXp(50);
              sfx.playLevelUp();
            }
          }}
          style={[styles.questRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
        >
          <Ionicons
            name={todayCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={todayCompleted ? palette.mint : palette.gold}
          />
          <Text style={[typography.caption, { color: palette.ink, flex: 1, fontWeight: '700' }]}>
            Điểm danh giữ chuỗi ngày học
          </Text>
          <Badge tone={todayCompleted ? 'success' : 'reward'}>
            {todayCompleted ? 'Đã nhận' : '+50 XP'}
          </Badge>
        </Pressable>

        <Pressable
          onPress={() => {
            if (!isTabletUp) setFocusTab('daily');
          }}
          style={[styles.questRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
        >
          <Ionicons
            name={dailyRewarded ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={dailyRewarded ? palette.mint : palette.indigo}
          />
          <Text style={[typography.caption, { color: palette.ink, flex: 1, fontWeight: '700' }]}>
            Trả lời Câu đố trong ngày
          </Text>
          <Badge tone={dailyRewarded ? 'success' : 'primary'}>+25 XP</Badge>
        </Pressable>

        <Pressable
          onPress={() => router.push('/games/archer')}
          style={[styles.questRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
        >
          <Ionicons
            name={gamesPlayed > 0 ? 'checkmark-circle' : 'play-circle-outline'}
            size={18}
            color={gamesPlayed > 0 ? palette.mint : palette.fire}
          />
          <Text style={[typography.caption, { color: palette.ink, flex: 1, fontWeight: '700' }]}>
            Hoàn thành 1 lượt luyện phản xạ
          </Text>
          <Badge tone={gamesPlayed > 0 ? 'success' : 'fire'}>Chơi ngay</Badge>
        </Pressable>
      </View>
    </View>
  );

  const pomodoroBlock = (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View>
        <View style={styles.arcadeTopRow}>
          <Badge tone={pomoMode === 'focus' ? 'primary' : 'success'}>
            {pomoMode === 'focus' ? 'POMODORO 25P' : 'NGHỈ NGẮN 5P'}
          </Badge>
          <Ionicons name="timer-outline" size={18} color={palette.inkMuted} />
        </View>
        <Text
          style={{
            color: palette.ink,
            fontSize: 36,
            fontWeight: '800',
            marginTop: 10,
            fontVariant: ['tabular-nums'],
            letterSpacing: -0.5,
          }}
        >
          {pomoMin}:{pomoSec}
        </Text>
        <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
          Giữ tập trung 25 phút học sâu để nhận +40 XP.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            variant={pomoRunning ? 'secondary' : 'primary'}
            icon={pomoRunning ? 'pause' : 'play'}
            onPress={() => setPomoRunning((r) => !r)}
            fullWidth
          >
            {pomoRunning ? 'Tạm dừng' : 'Bắt đầu'}
          </Button>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại đồng hồ"
          onPress={() => {
            setPomoRunning(false);
            setPomoMode('focus');
            setPomoSeconds(25 * 60);
          }}
          style={[
            styles.pomoResetBtn,
            { backgroundColor: palette.paper, borderColor: palette.paperMuted },
          ]}
        >
          <Ionicons name="refresh" size={18} color={palette.inkMuted} />
        </Pressable>
      </View>
    </View>
  );

  const dailyBlock = dailyQuestion ? (
    <View>
      <View style={styles.arcadeTopRow}>
        <Badge tone="primary">CÂU ĐỐ TRONG NGÀY · +25 XP</Badge>
        <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
          {dailyQuestion.subject}
        </Text>
      </View>
      <Text style={[typography.title, { color: palette.ink, marginTop: 8 }]}>
        {dailyQuestion.content}
      </Text>
      <View style={{ gap: 7, marginTop: 10 }}>
        {dailyQuestion.options.slice(0, 4).map((opt, idx) => {
          const answered = selectedDailyOpt !== null;
          const isCorrect = idx === dailyQuestion.correctIndex;
          const isChosen = selectedDailyOpt === idx;
          const bg = !answered
            ? palette.paper
            : isCorrect
              ? palette.mintTint
              : isChosen
                ? palette.dangerTint
                : palette.paper;
          const bdr = !answered
            ? palette.paperMuted
            : isCorrect
              ? palette.mint
              : isChosen
                ? palette.danger
                : palette.paperMuted;
          return (
            <Pressable
              key={idx}
              disabled={answered}
              onPress={() => {
                setSelectedDailyOpt(idx);
                if (idx === dailyQuestion.correctIndex) {
                  sfx.playCorrect();
                  if (!dailyRewarded) {
                    setDailyRewarded(true);
                    addBonusXp(25);
                  }
                } else {
                  sfx.playWrong();
                }
              }}
              style={[styles.dailyOptBtn, { backgroundColor: bg, borderColor: bdr }]}
            >
              <Text style={{ fontWeight: '800', color: palette.indigo }}>
                {String.fromCharCode(65 + idx)}.
              </Text>
              <Text style={[typography.caption, { color: palette.ink, flex: 1, fontWeight: '700' }]}>
                {opt}
              </Text>
              {answered && isCorrect && (
                <Ionicons name="checkmark-circle" size={16} color={palette.mint} />
              )}
              {answered && isChosen && !isCorrect && (
                <Ionicons name="close-circle" size={16} color={palette.danger} />
              )}
            </Pressable>
          );
        })}
      </View>
      {selectedDailyOpt !== null && (
        <View style={[styles.explainBox, { backgroundColor: palette.indigoTint }]}>
          <Text style={[typography.caption, { color: palette.indigoDeep, fontWeight: '700' }]}>
            {selectedDailyOpt === dailyQuestion.correctIndex
              ? 'Chính xác (+25 XP): '
              : 'Giải thích đáp án đúng: '}
            {dailyQuestion.explanation}
          </Text>
        </View>
      )}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        bottomNav
        onPullRefresh={async () => {
          useStreakStore.getState().refreshStreakStatus();
          await usePapyrusStore.getState().hydrateCloudProfile();
        }}
      >
        {/* 1. Compact Header with anchored Papybot button (never covers content!) */}
        {!desktopWeb && (
          <View style={styles.topHeader}>
            <View style={styles.brandIdentity}>
              <BrandMark size={38} />
              <View style={styles.brandIdentityCopy}>
                <View style={styles.nameDotRow}>
                  <Text style={[typography.title, { color: palette.ink, flexShrink: 1 }]} numberOfLines={1}>
                    {user?.displayName ? `${t.home.greeting} ${user.displayName}` : 'Papyrus'}
                  </Text>
                  <OnlineStatusDot />
                </View>
                <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={1}>
                  Cấp {rankInfo.level} · {rankInfo.titleVi}
                </Text>
              </View>
            </View>

            <View style={styles.topRightControls}>
              <Pressable
                onPress={() => openAssistant()}
                accessibilityRole="button"
                accessibilityLabel="Mở gia sư AI Papybot"
                style={[
                  styles.iconPillBtn,
                  { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                ]}
              >
                <Ionicons name="chatbubbles-outline" size={17} color={palette.indigo} />
              </Pressable>
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
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={[styles.headerAvatarImg, { borderColor: palette.indigoBorder }]}
                  />
                ) : (
                  <Ionicons name="person-circle-outline" size={32} color={palette.indigo} />
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Compact Status Strip */}
        <View style={[styles.utilityBar, desktopWeb && { marginTop: spacing.md }]}>
          <StreakBadge />
          <VipBadge />
          <SoundToggle />
          <InstallWebAppButton />
        </View>

        {/* 2. Unfinished Study Resume Banner */}
        {unfinishedStudy && (
          <SmoothReveal>
            <Card
              onPress={() =>
                router.push({ pathname: '/study/[setId]', params: { setId: unfinishedStudy.setId } })
              }
              style={[
                styles.resumeCard,
                {
                  borderColor: palette.mintBorder,
                  borderLeftWidth: 4,
                  borderLeftColor: palette.mint,
                  backgroundColor: palette.paperRaised,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="play-forward" tint="success" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: palette.mint, letterSpacing: 0.4 }}>
                    BÀI HỌC ĐANG DANG DỞ · TIẾP TỤC NGAY
                  </Text>
                  <Text style={[typography.title, { color: palette.ink, marginTop: 2 }]} numberOfLines={1}>
                    {unfinishedStudy.title}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <ProgressBar progress={unfinishedStudy.answered / Math.max(1, unfinishedStudy.total)} tone="success" />
                  </View>
                </View>
                <Ionicons name="chevron-forward-circle" size={26} color={palette.mint} />
              </View>
            </Card>
          </SmoothReveal>
        )}

        {/* 3. Editorial Hero Card with 3D Showcase OPEN BY DEFAULT */}
        <SmoothReveal>
          <Card
            style={[
              styles.heroCard,
              isWide && styles.heroCardWide,
              {
                backgroundColor: palette.paperRaised,
                borderColor: palette.paperMuted,
                borderTopWidth: 3,
                borderTopColor: palette.indigo,
              },
            ]}
          >
            <View style={styles.heroCopy}>
              <View style={styles.heroHeaderRow}>
                <View
                  style={[
                    styles.heroEyebrowPill,
                    { backgroundColor: palette.indigoTint, borderColor: palette.indigoBorder },
                  ]}
                >
                  <Ionicons name="document-text-outline" size={13} color={palette.indigo} />
                  <Text style={[styles.heroEyebrowText, { color: palette.indigoDeep }]}>
                    PAPYRUS STUDY STUDIO
                  </Text>
                </View>

                {!isWide && !reduceMotion && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowMobile3D((prev) => !prev)}
                    style={[
                      styles.toggle3dBtn,
                      {
                        backgroundColor: palette.paper,
                        borderColor: palette.paperMuted,
                      },
                    ]}
                  >
                    <Ionicons
                      name={showMobile3D ? 'chevron-up' : 'cube-outline'}
                      size={13}
                      color={palette.inkMuted}
                    />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: palette.inkMuted }}>
                      {showMobile3D ? 'Thu gọn 3D' : 'Hiện 3D'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Text
                style={[
                  typography.heading,
                  {
                    color: palette.ink,
                    maxWidth: 540,
                    fontSize: isWide ? 28 : 21,
                    lineHeight: isWide ? 35 : 27,
                    marginTop: spacing.xs,
                  },
                ]}
              >
                {t.home.heroTitle}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: palette.inkMuted, marginTop: 4, maxWidth: 500, lineHeight: 19 },
                ]}
              >
                {t.home.heroSub}
              </Text>

              <View style={styles.heroActions}>
                <View style={styles.heroBtnWrap}>
                  <Button icon="camera-outline" onPress={() => router.push('/create/scan')} variant="primary" fullWidth>
                    {t.home.createAiBtn}
                  </Button>
                </View>
                <View style={styles.heroBtnWrap}>
                  <Button
                    icon="library-outline"
                    variant="secondary"
                    onPress={() => router.push('/sets')}
                    fullWidth
                  >
                    {language === 'vi' ? 'Thư viện đề' : 'Study library'}
                  </Button>
                </View>
              </View>
            </View>

            {(isWide || showMobile3D) && (
              <View style={isWide ? styles.sceneWrapWide : styles.sceneWrapMobile}>
                <HomeHero3DShowcase compact={!isWide} reduceMotion={reduceMotion} />
              </View>
            )}
          </Card>
        </SmoothReveal>

        {/* 4. Single-Row Balanced 3-Column Metrics (never wraps 2+1 on 375px!) */}
        <SmoothReveal delay={30}>
          <View style={styles.compactStatsRow}>
            <View
              style={[
                styles.compactStatTile,
                { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
              ]}
            >
              <Ionicons name="book-outline" size={16} color={palette.indigo} />
              <Text style={[styles.compactStatVal, { color: palette.ink }]}>{sets.length}</Text>
              <Text style={[styles.compactStatLbl, { color: palette.inkMuted }]} numberOfLines={1}>
                Bộ câu hỏi
              </Text>
            </View>

            <View
              style={[
                styles.compactStatTile,
                { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
              ]}
            >
              <Ionicons name="help-circle-outline" size={16} color={palette.mint} />
              <Text style={[styles.compactStatVal, { color: palette.ink }]}>{totalQuestions}</Text>
              <Text style={[styles.compactStatLbl, { color: palette.inkMuted }]} numberOfLines={1}>
                Câu hỏi
              </Text>
            </View>

            <View
              style={[
                styles.compactStatTile,
                { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
              ]}
            >
              <Ionicons name="trophy-outline" size={16} color={palette.gold} />
              <Text style={[styles.compactStatVal, { color: palette.ink }]}>{eloRating}</Text>
              <Text style={[styles.compactStatLbl, { color: palette.inkMuted }]} numberOfLines={1}>
                ELO
              </Text>
            </View>
          </View>
        </SmoothReveal>

        {/* 5. Recent Study Sets (top 3 for compact Mobile-First scroll) */}
        <SmoothReveal delay={50}>
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
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: active ? palette.onPrimary : palette.ink,
                    }}
                  >
                    {subj === 'ALL' ? `Tất cả (${sets.length})` : subj}
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
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
                  {set.subject || 'Đại học'} · {set.questions.length} {t.library.questionsCount}
                </Text>
              </View>
              <Ionicons name="play-circle" size={26} color={palette.indigo} />
            </Card>
          ))}
        </SmoothReveal>

        {/* 6. Live Battle Room Entry (Balanced Row 1 PIN+Join, Row 2 full-width Host) */}
        <SmoothReveal delay={70}>
          <Card style={[styles.joinCard, { borderColor: palette.paperMuted }]}>
            <View style={styles.joinText}>
              <IconTile icon="flash-outline" tint="reward" />
              <View style={styles.joinCopy}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  Đấu phòng trắc nghiệm (PIN 2–4 người)
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                  Nhập mã PIN từ bạn học hoặc tạo phòng đấu mới ngay
                </Text>
              </View>
            </View>

            <View style={styles.joinInputRow}>
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
            </View>
            <Button variant="secondary" icon="add-circle-outline" onPress={() => void quickHostKahoot()} fullWidth>
              Mở phòng đấu mới
            </Button>
          </Card>
        </SmoothReveal>

        {/* 7. Symmetrical Grid: 2 Columns on mobile, 3 Columns on tablet/desktop */}
        <SmoothReveal delay={90}>
          <SectionHeading
            title={language === 'vi' ? 'Chế độ Luyện tập & Gia sư AI' : 'Practice & AI Tutor'}
          />
          <View style={styles.quickGrid}>
            {chunkItems(
              [
                {
                  id: 'archer',
                  icon: 'locate-outline' as const,
                  tint: 'fire' as const,
                  title: 'Cung thủ 3D',
                  description: 'Bắn khái niệm đúng',
                  onPress: () => router.push('/games/archer'),
                },
                {
                  id: 'alchemy',
                  icon: 'flask-outline' as const,
                  tint: 'success' as const,
                  title: 'Giả kim 3D',
                  description: 'Phân loại thuật ngữ',
                  onPress: () => router.push('/games/alchemy'),
                },
                {
                  id: 'survival',
                  icon: 'shield-outline' as const,
                  tint: 'danger' as const,
                  title: 'Sinh tồn 3D',
                  description: 'Thử thách 3 mạng',
                  onPress: () => router.push('/games/survival'),
                },
                {
                  id: 'match',
                  icon: 'extension-puzzle-outline' as const,
                  tint: 'reward' as const,
                  title: 'Lật thẻ Ghép',
                  description: 'Ghép câu & đáp án',
                  onPress: () => router.push('/games/match'),
                },
                {
                  id: 'battle',
                  icon: 'game-controller-outline' as const,
                  tint: 'primary' as const,
                  title: 'Đấu trường',
                  description: 'Sảnh PIN & 1v1 ELO',
                  onPress: () => router.push('/battle'),
                },
                {
                  id: 'papybot',
                  icon: 'chatbubbles-outline' as const,
                  tint: 'success' as const,
                  title: 'Gia sư Papybot',
                  description: 'Hỏi đáp PDF & bài tập',
                  onPress: () => openAssistant(),
                },
              ],
              isTabletUp ? 3 : 2
            ).map((row, rowIndex) => (
              <View key={rowIndex} style={styles.quickGridRow}>
                {row.map((item) => (
                  <QuickAction
                    key={item.id}
                    icon={item.icon}
                    tint={item.tint}
                    title={item.title}
                    description={item.description}
                    onPress={item.onPress}
                    palette={palette}
                  />
                ))}
              </View>
            ))}
          </View>
        </SmoothReveal>

        {/* 8. Streamlined Daily Focus (Mobile: 1 Segmented Card saving 1.5 screens; Tablet/Desktop: Expanded) */}
        <SmoothReveal delay={110}>
          <SectionHeading title={language === 'vi' ? 'Nhịp học hôm nay' : 'Daily Focus'} />
          {isTabletUp ? (
            <View style={{ gap: spacing.md }}>
              <View style={styles.arcadeRowWide}>
                <Card style={{ flex: 1.3 }}>{questsBlock}</Card>
                <Card style={{ flex: 1 }}>{pomodoroBlock}</Card>
              </View>
              {dailyBlock ? <Card>{dailyBlock}</Card> : null}
            </View>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <View
                style={[
                  styles.focusTabsBar,
                  { backgroundColor: palette.paper, borderColor: palette.paperMuted },
                ]}
              >
                {(
                  [
                    { key: 'quests', label: `Mục tiêu (${completedQuests}/3)` },
                    { key: 'pomodoro', label: `Pomodoro ${pomoMin}:${pomoSec}` },
                    { key: 'daily', label: 'Câu đố +25' },
                  ] as const
                ).map((tab) => {
                  const active = focusTab === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => setFocusTab(tab.key)}
                      style={[
                        styles.focusTabPill,
                        active && {
                          backgroundColor: palette.paperRaised,
                          borderColor: palette.indigoBorder,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11.5,
                          fontWeight: active ? '800' : '600',
                          color: active ? palette.indigo : palette.inkMuted,
                        }}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {focusTab === 'quests' && questsBlock}
              {focusTab === 'pomodoro' && pomodoroBlock}
              {focusTab === 'daily' && dailyBlock}
            </Card>
          )}
        </SmoothReveal>

        {/* 9. Community Highlights */}
        <SmoothReveal delay={130}>
          <SectionHeading
            title={language === 'vi' ? 'Cộng đồng học tập' : 'Study Community'}
            action={language === 'vi' ? 'Mở Cộng đồng →' : 'Open Community →'}
            onAction={() => router.push('/community')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesStrip}>
            <CreateStoryCard916
              avatarUrl={user?.avatarUrl}
              displayName={user?.displayName || 'Papyrus'}
              onPress={() => {
                if (!user) {
                  router.push('/auth');
                  return;
                }
                setHomeStoryComposerOpen(true);
              }}
            />

            {groupedHomeStories.map((grp) => {
              const viewerId = user?.id ?? 'guest';
              return (
                <StoryCard916
                  key={grp.authorId}
                  story={grp.coverStory}
                  totalCount={grp.stories.length}
                  seen={grp.stories.every((s) => s.viewedByIds.includes(viewerId))}
                  onPress={() => {
                    setViewingHomeStoryGroup(grp.stories);
                  }}
                />
              );
            })}
          </ScrollView>

          {latestCommunityPost ? (
            <Card onPress={() => router.push('/community')} style={{ marginTop: spacing.sm, padding: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Badge tone="primary">BÀI VIẾT MỚI</Badge>
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                  {latestCommunityPost.comments.length} bình luận · Xem →
                </Text>
              </View>
              <Text style={[typography.body, { color: palette.ink, fontWeight: '700', marginTop: 6 }]} numberOfLines={2}>
                {latestCommunityPost.authorName}: “{latestCommunityPost.threadParts[0]}”
              </Text>
            </Card>
          ) : null}
        </SmoothReveal>
      </Screen>

      <StoryViewerModal
        stories={viewingHomeStoryGroup}
        viewerId={user?.id ?? 'guest'}
        onClose={() => setViewingHomeStoryGroup(null)}
        onMarkViewed={(sid) => markStoryViewed(sid, user?.id ?? 'guest')}
        onReact={(sid, emo) => reactToStory(sid, emo, user?.id ?? 'guest')}
        onDirectMessage={(author) => {
          router.push({
            pathname: '/messages',
            params: { peerId: author.id, peerName: author.name },
          });
        }}
      />
      <StoryComposerModal
        visible={homeStoryComposerOpen}
        onClose={() => setHomeStoryComposerOpen(false)}
        onPublish={(data) => {
          if (!user) return;
          const created = addStory({
            authorId: user.id,
            authorName: user.displayName || 'Thành viên Papyrus',
            authorAvatar: user.avatarUrl ?? null,
            authorLevel: rankInfo.level,
            badgeLabel: rankInfo.titleVi,
            ...data,
          });
          if (!created) return;
          addBonusXp(20);
          sfx.playLevelUp();
        }}
      />
    </View>
  );
}

/** Split flat list into equal-length rows so flex: 1 slots align symmetrically across widths. */
function chunkItems<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

const QuickAction = memo(function QuickAction({
  icon,
  tint,
  title,
  description,
  onPress,
  palette,
}: {
  icon:
  | 'locate-outline'
  | 'flask-outline'
  | 'shield-outline'
  | 'extension-puzzle-outline'
  | 'game-controller-outline'
  | 'chatbubbles-outline';
  tint: 'primary' | 'success' | 'danger' | 'reward' | 'fire';
  title: string;
  description: string;
  onPress: () => void;
  palette: ReturnType<typeof usePalette>;
}) {
  return (
    <Card onPress={onPress} containerStyle={styles.quickCardSlot} style={styles.quickCard}>
      <IconTile icon={icon} tint={tint} />
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm, fontSize: 15 }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2, fontSize: 12.5 }]} numberOfLines={2}>
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
    gap: spacing.xs,
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  brandIdentityCopy: { flex: 1, minWidth: 0 },
  nameDotRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconPillBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.sm },
  langPillButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  profileButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerAvatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5 },
  resumeCard: { padding: spacing.md, marginBottom: spacing.sm },
  heroCard: { padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  heroCardWide: {
    minHeight: 270,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.xxl,
  },
  heroCopy: { flex: 1, zIndex: 1 },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  heroEyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  heroEyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  toggle3dBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  heroBtnWrap: { flex: 1, minWidth: 165 },
  sceneWrapWide: { width: '41%', minWidth: 290, marginLeft: spacing.xl },
  sceneWrapMobile: { width: '100%', marginTop: spacing.sm },
  compactStatsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  compactStatTile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  compactStatVal: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  compactStatLbl: {
    fontSize: 11,
    fontWeight: '600',
  },
  storiesStrip: { gap: 10, paddingBottom: spacing.xs },
  focusTabsBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 3,
    gap: 3,
  },
  focusTabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: radii.sm - 2,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pomoResetBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyOptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  explainBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radii.sm,
  },
  arcadeRowWide: { flexDirection: 'row', gap: spacing.sm },
  arcadeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subjectFilterRow: { gap: 8, paddingBottom: spacing.sm },
  subjectPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1 },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  setCopy: { flex: 1, minWidth: 0 },
  quickGrid: {
    gap: spacing.sm,
  },
  quickGridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  quickCardSlot: {
    flex: 1,
    minWidth: 0,
  },
  quickCard: {
    padding: spacing.md,
  },
  joinCard: { marginTop: spacing.md, gap: spacing.sm },
  joinText: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  joinCopy: { flex: 1, minWidth: 0 },
  joinInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  codeInput: {
    flex: 1,
    minWidth: 110,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
