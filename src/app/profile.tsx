import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, ProgressBar, Screen, SmoothReveal, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { StoryComposerModal, StoryViewerModal } from '@/features/community/presentation/StoryModalViewer';
import { ThreadPostCard } from '@/features/community/presentation/ThreadPostCard';
import type { ScholarStory } from '@/features/community/domain/models';
import { getScholarRankInfo, XP_PER_SCHOLAR_LEVEL } from '@/core/domain/scholarRank';
import { getLocalDateString } from '@/features/streak/domain/models';
import { dependencies } from '@/composition/dependencies';
import {
  fetchCloudProfileSnapshot,
  preferenceStorage,
  syncUserProgressToCloud,
} from '@/composition/preferences';
import { formatScholarCode, getOnlineScholarCandidates } from '@/composition/platform';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { DUEL_CATEGORIES, getEloTier } from '@/features/room-battle/domain/elo';
import { sfx } from '@/core/audio/sfx';

type ProfileTab = 'timeline' | 'about' | 'friends' | 'vault';

const PROFILE_META_KEY = 'papyrus.profile.meta.v2';
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const COVER_PRESETS = [
  { id: 'royal', label: 'Hoàng Gia', c1: '#1E1B4B', c2: '#6D28D9' },
  { id: 'aurora', label: 'Cực Quang', c1: '#064E3B', c2: '#0284C7' },
  { id: 'sunset', label: 'Phượng Hoàng', c1: '#7C2D12', c2: '#DB2777' },
  { id: 'cosmos', label: 'Tinh Vân', c1: '#0F172A', c2: '#4F46E5' },
];

const AVATAR_PRESETS = [
  { id: 'indigo', label: 'Học giả Indigo', bg: '#4F46E5', fg: '#FFFFFF', icon: 'school' as const },
  { id: 'violet', label: 'Pháp sư Tím', bg: '#7C3AED', fg: '#FFFFFF', icon: 'sparkles' as const },
  { id: 'gold', label: 'Quán quân Vàng', bg: '#D97706', fg: '#FFFFFF', icon: 'trophy' as const },
  { id: 'emerald', label: 'Thảo nguyên Xanh', bg: '#059669', fg: '#FFFFFF', icon: 'leaf' as const },
  { id: 'crimson', label: 'Chiến binh Lửa', bg: '#DC2626', fg: '#FFFFFF', icon: 'flame' as const },
  { id: 'cyan', label: 'Thiên văn Lam', bg: '#0284C7', fg: '#FFFFFF', icon: 'planet' as const },
];

function createPresetAvatarDataUri(bg: string, letter: string): string {
  const safeLetter = (letter || 'P').slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'P';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#060A24"/></linearGradient></defs><rect width="240" height="240" rx="120" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="system-ui,sans-serif" font-size="96" font-weight="800">${safeLetter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function compressWebImageToDataUrl(uri: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Unsupported platform'));
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'));
    img.src = uri;
  });
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const viewerName = user?.displayName ?? 'Người học khách';
  const palette = usePalette();
  const router = useRouter();
  const params = useLocalSearchParams<{ composeStory?: string }>();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.lg * 2, 740);

  const gamesPlayed = usePapyrusStore((s) => s.gamesPlayed);
  const totalScore = usePapyrusStore((s) => s.totalScore);
  const bestScore = usePapyrusStore((s) => s.bestScore);
  const wins = usePapyrusStore((s) => s.wins);
  const eloRating = usePapyrusStore((s) => s.eloRating);
  const eloPeak = usePapyrusStore((s) => s.eloPeak);
  const categoryElos = usePapyrusStore((s) => s.categoryElos);
  const questionSets = usePapyrusStore((s) => s.questionSets);
  const addBonusXp = usePapyrusStore((s) => s.addBonusXp);
  const hydrateCloudProfile = usePapyrusStore((s) => s.hydrateCloudProfile);
  const eloTier = getEloTier(eloRating);
  const rankInfo = useMemo(() => getScholarRankInfo(totalScore), [totalScore]);

  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const todayCompleted = useStreakStore((s) => s.todayCompleted);
  const historyDates = useStreakStore((s) => s.historyDates);
  const checkInToday = useStreakStore((s) => s.checkInToday);
  const membershipTier = useMembershipStore((s) => s.tier);

  const gifts = useNotificationStore((s) => s.gifts);
  const claimGift = useNotificationStore((s) => s.claimGift);
  const syncCloudGifts = useNotificationStore((s) => s.syncCloudGifts);

  const stories = useCommunityStore((s) => s.stories);
  const posts = useCommunityStore((s) => s.posts);
  const followingAuthorIds = useCommunityStore((s) => s.followingAuthorIds);
  const addStory = useCommunityStore((s) => s.addStory);
  const reactToStory = useCommunityStore((s) => s.reactToStory);
  const addPost = useCommunityStore((s) => s.addPost);
  const togglePostReaction = useCommunityStore((s) => s.togglePostReaction);
  const votePostPoll = useCommunityStore((s) => s.votePostPoll);
  const toggleBookmarkPost = useCommunityStore((s) => s.toggleBookmarkPost);
  const toggleRepost = useCommunityStore((s) => s.toggleRepost);
  const addComment = useCommunityStore((s) => s.addComment);
  const toggleFollowAuthor = useCommunityStore((s) => s.toggleFollowAuthor);

  const [activeTab, setActiveTab] = useState<ProfileTab>('timeline');
  const [name, setName] = useState(user?.displayName ?? '');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [bio, setBio] = useState('');
  const [coverPresetId, setCoverPresetId] = useState('royal');
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(() => params.composeStory === '1');
  const [viewingStory, setViewingStory] = useState<ScholarStory | null>(null);
  const [quickPostDraft, setQuickPostDraft] = useState('');
  const [message, setMessage] = useState('');

  const currentUserId = user?.id ?? null;

  useEffect(() => {
    let active = true;
    if (currentUserId) {
      void hydrateCloudProfile();
      void syncCloudGifts(currentUserId);
      void fetchCloudProfileSnapshot().then((snap) => {
        if (!active || !snap) return;
        if (snap.coverUrl) setCustomCoverUrl(snap.coverUrl);
        if (snap.bio) setBio(snap.bio);
        if (snap.university) setUniversity(snap.university);
        if (snap.major) setMajor(snap.major);
      });
    }

    void preferenceStorage.getItem(`${PROFILE_META_KEY}.${viewerId}`).then((raw) => {
      if (!active) return;
      setName(user?.displayName ?? '');
      if (!raw) {
        if (!currentUserId) {
          setUniversity('');
          setMajor('');
          setBio('');
          setCustomCoverUrl(null);
        }
        return;
      }
      try {
        const parsed = JSON.parse(raw) as {
          university?: string;
          major?: string;
          bio?: string;
          coverPresetId?: string;
          customCoverUrl?: string | null;
        };
        setUniversity(parsed.university ?? '');
        setMajor(parsed.major ?? '');
        setBio(parsed.bio ?? '');
        if (parsed.coverPresetId) setCoverPresetId(parsed.coverPresetId);
        setCustomCoverUrl(parsed.customCoverUrl ?? null);
      } catch {
        // Ignore
      }
    });
    return () => {
      active = false;
    };
  }, [currentUserId, user?.displayName, viewerId, hydrateCloudProfile, syncCloudGifts]);

  const myStories = useMemo(
    () => stories.filter((s) => s.authorId === viewerId || s.isHighlight),
    [stories, viewerId]
  );

  const myPosts = useMemo(
    () => posts.filter((p) => p.authorId === viewerId || p.bookmarkedByIds.includes(viewerId)),
    [posts, viewerId]
  );

  const myGifts = useMemo(
    () =>
      currentUserId
        ? gifts.filter((g) => g.recipientId === 'all' || g.recipientId === currentUserId)
        : [],
    [gifts, currentUserId]
  );

  const last7Days = useMemo(() => {
    const activeSet = new Set(historyDates ?? []);
    const out: Array<{ key: string; label: string; done: boolean; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = getLocalDateString(d);
      out.push({
        key,
        label: DAY_LABELS[d.getDay()] ?? 'T',
        done: activeSet.has(key),
        isToday: i === 0,
      });
    }
    return out;
  }, [historyDates]);

  const onlineScholars = getOnlineScholarCandidates(user?.id);

  async function saveProfileDetails() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await preferenceStorage.setItem(
        `${PROFILE_META_KEY}.${viewerId}`,
        JSON.stringify({
          university: university.trim(),
          major: major.trim(),
          bio: bio.trim(),
          coverPresetId,
          customCoverUrl,
        })
      );
      if (user) {
        if (name.trim().length >= 2 && name.trim() !== user.displayName) {
          const updated = await dependencies.updateDisplayName(name);
          useAuthStore.getState().setUser(updated);
        }
        await syncUserProgressToCloud({
          bio: bio.trim(),
          university: university.trim(),
          major: major.trim(),
          coverUrl: customCoverUrl,
        });
      }
      setEditModalOpen(false);
      setMessage('✅ Đã lưu và đồng bộ trang cá nhân lên đám mây!');
    } catch (error) {
      setMessage(errorMessage(error, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickPhotoAvatar() {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const picked = await dependencies.intake.pickSourceImages();
      const firstUri = picked[0];
      if (!firstUri) return;
      const finalUri =
        Platform.OS === 'web' ? await compressWebImageToDataUrl(firstUri, 240, 240) : firstUri;
      const updated = await dependencies.updateUserAvatar(finalUri);
      useAuthStore.getState().setUser(updated);
      setAvatarModalOpen(false);
      setMessage('✅ Đã cập nhật ảnh đại diện mới.');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể tải ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handlePickCoverPhoto() {
    try {
      const picked = await dependencies.intake.pickSourceImages();
      const firstUri = picked[0];
      if (!firstUri) return;
      const finalUri =
        Platform.OS === 'web' ? await compressWebImageToDataUrl(firstUri, 760, 260) : firstUri;
      setCustomCoverUrl(finalUri);
      await preferenceStorage.setItem(
        `${PROFILE_META_KEY}.${viewerId}`,
        JSON.stringify({ university, major, bio, coverPresetId, customCoverUrl: finalUri })
      );
      if (user) {
        void syncUserProgressToCloud({ coverUrl: finalUri });
      }
      setMessage('✅ Đã cập nhật ảnh bìa trang cá nhân!');
    } catch {
      setMessage('Không thể đổi ảnh bìa lúc này.');
    }
  }

  async function handleSelectPresetAvatar(bg: string) {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    try {
      const dataUri = createPresetAvatarDataUri(bg, initials);
      const updated = await dependencies.updateUserAvatar(dataUri);
      useAuthStore.getState().setUser(updated);
      setAvatarModalOpen(false);
      setMessage('✅ Đã đổi biểu tượng đại diện.');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể lưu ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleClaimGift(gift: AdminGiftItem) {
    const claimed = claimGift(gift.id, viewerId);
    if (!claimed) return;
    if (claimed.giftType === 'question_set' && claimed.questionSet) {
      const giftedSet = {
        ...claimed.questionSet,
        id: `gift-${claimed.id}`,
        title: `🎁 ${claimed.questionSet.title}`,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const,
      };
      await saveQuestionSet(dependencies.questionSets, giftedSet).catch(() => undefined);
      usePapyrusStore.getState().saveQuestionSet(giftedSet);
      setMessage(`🎁 Đã lưu bộ đề "${claimed.title}" vào Thư viện!`);
    } else if (claimed.giftType === 'study_document' && claimed.documentText) {
      usePapyrusStore.getState().saveSourceDocument({
        id: `gift-doc-${claimed.id}`,
        title: `🎁 ${claimed.title}`,
        text: claimed.documentText,
        createdAt: new Date().toISOString(),
      });
      setMessage(`📄 Đã lưu tài liệu "${claimed.title}"!`);
    } else if (claimed.giftType === 'vip_days') {
      useMembershipStore.getState().upgradeToVip();
      setMessage('👑 Đã kích hoạt đặc quyền VIP Archmage từ Admin!');
    } else if (claimed.giftType === 'streak_freeze') {
      useStreakStore.getState().addStreakFreeze(2);
      setMessage('❄️ Đã cộng +2 Bùa Đóng Băng Chuỗi!');
    }
    sfx.playLevelUp();
  }

  const handlePublishTimelinePost = () => {
    const clean = quickPostDraft.trim();
    if (!clean) return;
    addPost({
      authorId: viewerId,
      authorName: viewerName,
      authorHandle: `@${((user?.email ? user.email.split('@')[0] : viewerName) || 'scholar').toLowerCase().replace(/[^a-z0-9._]/g, '') || 'scholar'}`,
      authorAvatar: user?.avatarUrl ?? null,
      authorLevel: rankInfo.level,
      authorRoleBadge: `${rankInfo.badge} ${rankInfo.titleVi}`,
      threadParts: [clean],
      tags: ['TrangCáNhân', 'StudyWithMe'],
    });
    setQuickPostDraft('');
    addBonusXp(30);
    sfx.playLevelUp();
    setMessage('✨ Đã đăng bài viết lên Trang Cá Nhân & Bảng tin Cộng đồng (+30 XP)!');
  };

  const initials = viewerName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const activeCoverPreset = COVER_PRESETS.find((c) => c.id === coverPresetId) ?? COVER_PRESETS[0]!;
  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : '—';

  return (
    <Screen scroll={false}>
      <TopBar title="Trang cá nhân" />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* ── FACEBOOK-STYLE COVER PHOTO + OVERLAPPING AVATAR + IDENTITY HEADER ── */}
          <SmoothReveal>
            <Card style={styles.fbHeaderCard}>
              {/* Cover Banner */}
              <View
                style={[
                  styles.coverBanner,
                  Platform.OS === 'web' && !customCoverUrl
                    ? ({
                        backgroundImage: `linear-gradient(135deg, ${activeCoverPreset.c1} 0%, ${activeCoverPreset.c2} 100%)`,
                      } as object)
                    : { backgroundColor: activeCoverPreset.c1 },
                ]}
              >
                {customCoverUrl ? (
                  <Image source={{ uri: customCoverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : null}

                {/* Cover Switcher & Upload Controls */}
                <View style={styles.coverTopControls}>
                  {COVER_PRESETS.map((cp) => (
                    <Pressable
                      key={cp.id}
                      onPress={() => {
                        setCustomCoverUrl(null);
                        setCoverPresetId(cp.id);
                      }}
                      style={[
                        styles.coverColorDot,
                        {
                          backgroundColor: cp.c2,
                          borderColor: coverPresetId === cp.id && !customCoverUrl ? '#FFFFFF' : 'transparent',
                        },
                      ]}
                    />
                  ))}
                  <Pressable onPress={() => void handlePickCoverPhoto()} style={styles.changeCoverBtn}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' }}>Đổi ảnh bìa</Text>
                  </Pressable>
                </View>
              </View>

              {/* Overlapping Avatar + Identity */}
              <View style={styles.fbIdentityBody}>
                <View style={styles.avatarRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!user}
                    onPress={() => setAvatarModalOpen(true)}
                    style={styles.overlappingAvatarWrap}
                  >
                    {user?.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.fbAvatarImg} />
                    ) : (
                      <View style={[styles.fbAvatarImg, { backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFFFFF' }}>{initials}</Text>
                      </View>
                    )}
                    {user ? (
                      <View style={[styles.avatarCamBadge, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
                        <Ionicons name="camera" size={15} color={palette.ink} />
                      </View>
                    ) : null}
                  </Pressable>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <Badge tone="primary">
                      {rankInfo.badge} Cấp {rankInfo.level} · {rankInfo.titleVi}
                    </Badge>
                    {membershipTier === 'archmage' && <Badge tone="reward">👑 VIP ARCHMAGE</Badge>}
                  </View>
                </View>

                <Text style={[typography.heading, { color: palette.ink, marginTop: 8 }]}>{viewerName}</Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                  {user ? `Mã Học Giả: ${formatScholarCode(user.id)}` : 'Chế độ Khách (Đăng nhập để đồng bộ đa thiết bị)'}
                  {major || university ? ` · ${[major, university].filter(Boolean).join(' tại ')}` : ''}
                </Text>

                {bio ? (
                  <Text style={[typography.body, { color: palette.ink, marginTop: 6 }]}>{bio}</Text>
                ) : null}

                {/* Transparent Scholar Level & XP Bar (Clarifies Level 1..25+ explicitly!) */}
                <View style={[styles.levelBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo }}>
                      {rankInfo.badge} Cấp {rankInfo.level} ({rankInfo.titleVi}) → Cấp {rankInfo.level + 1}
                    </Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.inkMuted, fontVariant: ['tabular-nums'] }}>
                      {rankInfo.currentLevelXp} / {XP_PER_SCHOLAR_LEVEL} XP (Tổng {totalScore.toLocaleString('vi-VN')} XP)
                    </Text>
                  </View>
                  <ProgressBar progress={rankInfo.progress} tone="primary" />
                  <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                    💡 Quy tắc minh bạch: Mỗi 500 XP = +1 Cấp (Điểm danh +50 XP, Đăng bài +30 XP, Câu đố ngày +25 XP, Đấu trường +Điểm trận).
                  </Text>
                </View>

                {/* Facebook Action Buttons Row */}
                <View style={styles.fbActionRow}>
                  <View style={{ flex: 1.2, minWidth: 145 }}>
                    <Button icon="add-circle" onPress={() => setStoryComposerOpen(true)} fullWidth>
                      Thêm vào Tin
                    </Button>
                  </View>
                  <View style={{ flex: 1, minWidth: 135 }}>
                    <Button variant="secondary" icon="create-outline" onPress={() => setEditModalOpen(true)} fullWidth>
                      Chỉnh sửa hồ sơ
                    </Button>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Chia sẻ hồ sơ"
                    onPress={async () => {
                      if (!user) return;
                      const url = `https://papyrus-lyart-five.vercel.app/leaderboard?addFriend=${user.id}`;
                      await Share.share({ message: `Kết bạn với ${viewerName} trên Papyrus: ${url}` }).catch(() => undefined);
                    }}
                    style={[styles.moreSquareBtn, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <Ionicons name="share-social-outline" size={18} color={palette.ink} />
                  </Pressable>
                </View>

                {/* Story Highlights Strip on Profile */}
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[typography.label, { color: palette.inkMuted, marginBottom: 8 }]}>
                    TIN 24H & TIN NỔI BẬT TRÊN TRANG CÁ NHÂN
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    <Pressable
                      onPress={() => setStoryComposerOpen(true)}
                      style={[styles.highlightItem, { borderColor: palette.indigoBorder, backgroundColor: palette.paper }]}
                    >
                      <View style={[styles.highlightCircle, { backgroundColor: palette.indigoTint }]}>
                        <Ionicons name="add" size={22} color={palette.indigo} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }}>Mới</Text>
                    </Pressable>

                    {myStories.map((st) => (
                      <Pressable
                        key={st.id}
                        onPress={() => setViewingStory(st)}
                        style={[styles.highlightItem, { borderColor: st.gradient[1], backgroundColor: palette.paper }]}
                      >
                        <View style={[styles.highlightCircle, { backgroundColor: st.gradient[0] }]}>
                          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13 }}>✨</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink }} numberOfLines={1}>
                          {st.subtext?.replace('#', '') || 'Kỷ niệm'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Facebook Navigation Tabs */}
                <View style={[styles.fbTabsBar, { borderTopColor: palette.paperMuted }]}>
                  {(
                    [
                      { id: 'timeline', label: 'Bài viết' },
                      { id: 'about', label: 'Giới thiệu & Cấp' },
                      { id: 'friends', label: `Bạn bè (${onlineScholars.length})` },
                      { id: 'vault', label: `Kho quà (${myGifts.length})` },
                    ] as const
                  ).map((tb) => {
                    const active = activeTab === tb.id;
                    return (
                      <Pressable
                        key={tb.id}
                        onPress={() => setActiveTab(tb.id)}
                        style={[
                          styles.fbTabItem,
                          active && { borderBottomWidth: 3, borderBottomColor: palette.indigo },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: active ? '900' : '700',
                            color: active ? palette.indigo : palette.inkMuted,
                          }}
                        >
                          {tb.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Card>
          </SmoothReveal>

          {message ? (
            <Card style={{ marginTop: spacing.sm, padding: spacing.sm, borderColor: palette.indigo }}>
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', textAlign: 'center' }]}>
                {message}
              </Text>
            </Card>
          ) : null}

          {/* ── TAB 1: FACEBOOK TIMELINE (COMPOSER + POSTS + THREADS) ── */}
          {activeTab === 'timeline' && (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {/* Intro Summary Card */}
              <Card style={{ gap: 6 }}>
                <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>Chi tiết học thuật</Text>
                <View style={styles.introLine}>
                  <Ionicons name="flame" size={17} color="#F59E0B" />
                  <Text style={[typography.caption, { color: palette.ink }]}>
                    Chuỗi học tập riêng của tài khoản: <Text style={{ fontWeight: '800' }}>{currentStreak} ngày</Text> (Kỷ lục {longestStreak} ngày)
                  </Text>
                  {!todayCompleted && (
                    <Pressable
                      onPress={() => {
                        const r = checkInToday();
                        if (r.streakUpdated) {
                          addBonusXp(50);
                          sfx.playLevelUp();
                          setMessage(`🔥 Điểm danh thành công (+50 XP)! Chuỗi đạt ${r.newStreak} ngày.`);
                        }
                      }}
                      style={[styles.inlineCheckInBtn, { backgroundColor: '#F59E0B' }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#0F172A' }}>Điểm danh</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.introLine}>
                  <Ionicons name="trophy-outline" size={17} color={palette.indigo} />
                  <Text style={[typography.caption, { color: palette.ink }]}>
                    Hạng Đấu Trường: <Text style={{ fontWeight: '800' }}>{eloTier.labelVi} ({eloRating} ELO)</Text> · Tỉ lệ thắng {winRate}
                  </Text>
                </View>
                {(university || major) && (
                  <View style={styles.introLine}>
                    <Ionicons name="school-outline" size={17} color={palette.mint} />
                    <Text style={[typography.caption, { color: palette.ink }]}>
                      Học chuyên ngành {[major, university].filter(Boolean).join(' tại ')}
                    </Text>
                  </View>
                )}
              </Card>

              {/* Facebook "What's on your mind?" Post Composer */}
              <Card style={{ gap: 10 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>ĐĂNG BÀI LÊN DÒNG THỜI GIAN CÁ NHÂN</Text>
                <TextInput
                  value={quickPostDraft}
                  onChangeText={setQuickPostDraft}
                  multiline
                  placeholder={`${viewerName} ơi, bạn vừa học được điều gì tâm đắc hôm nay?`}
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.timelineInput,
                    { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                  ]}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      icon="send"
                      disabled={!quickPostDraft.trim()}
                      onPress={handlePublishTimelinePost}
                      fullWidth
                    >
                      Đăng bài (+30 XP)
                    </Button>
                  </View>
                  <Button variant="secondary" icon="layers-outline" onPress={() => router.push('/community')}>
                    Soạn Chuỗi Thread Mẫu
                  </Button>
                </View>
              </Card>

              <Text style={[typography.title, { color: palette.ink, marginTop: spacing.xs }]}>
                Bài viết của bạn & Bài đã lưu ({myPosts.length})
              </Text>
              {myPosts.length === 0 ? (
                <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <Ionicons name="newspaper-outline" size={32} color={palette.inkMuted} />
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 6 }]}>
                    Bạn chưa đăng bài viết nào. Hãy viết suy nghĩ đầu tiên ở ô phía trên nhé!
                  </Text>
                </Card>
              ) : (
                myPosts.map((p) => (
                  <ThreadPostCard
                    key={p.id}
                    post={p}
                    viewerId={viewerId}
                    isFollowing={followingAuthorIds.includes(p.authorId)}
                    onToggleFollow={toggleFollowAuthor}
                    onReact={(pid, key) => togglePostReaction(pid, key, viewerId)}
                    onVotePoll={(pid, oid) => votePostPoll(pid, oid, viewerId)}
                    onToggleBookmark={(pid) => toggleBookmarkPost(pid, viewerId)}
                    onToggleRepost={(pid) => toggleRepost(pid, viewerId)}
                    onComment={(pid, txt) =>
                      addComment(pid, { id: viewerId, name: viewerName, avatar: user?.avatarUrl ?? null }, txt)
                    }
                    onOpenQuiz={(setId) => router.push({ pathname: '/study/[setId]', params: { setId } })}
                  />
                ))
              )}
            </View>
          )}

          {/* ── TAB 2: ABOUT, LEVEL SYSTEM EXPLANATION, STREAK & ELO ── */}
          {activeTab === 'about' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 8 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>
                  🎓 HỆ THỐNG CẤP BẬC HỌC GIẢ LÀ GÌ?
                </Text>
                <Text style={[typography.caption, { color: palette.ink, lineHeight: 20 }]}>
                  Mỗi tài khoản sở hữu lộ trình tích lũy XP độc lập và đồng bộ đám mây (cứ <Text style={{ fontWeight: '800' }}>500 XP = tăng 1 Cấp</Text>):
                </Text>
                {[
                  { lv: 'Cấp 1 – 2', name: '🌱 Tân Học Giả', xp: '0 – 999 XP' },
                  { lv: 'Cấp 3 – 5', name: '📜 Học Giả Tinh Thông', xp: '1.000 – 2.499 XP' },
                  { lv: 'Cấp 6 – 9', name: '⚔️ Hiệp Sĩ Tri Thức', xp: '2.500 – 4.499 XP' },
                  { lv: 'Cấp 10 – 14', name: '🔮 Pháp Sư Hàn Lâm', xp: '4.500 – 6.999 XP' },
                  { lv: 'Cấp 15 – 24', name: '👑 Đại Học Sĩ Hoàng Gia', xp: '7.000 – 11.999 XP' },
                  { lv: 'Cấp 25+', name: '🌟 Huyền Thoại Papyrus', xp: 'Từ 12.000 XP trở lên' },
                ].map((row) => (
                  <View
                    key={row.lv}
                    style={[styles.rankLadderRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: palette.indigo, width: 92 }}>{row.lv}</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: palette.ink, flex: 1 }}>{row.name}</Text>
                    <Text style={{ fontSize: 11, color: palette.inkMuted }}>{row.xp}</Text>
                  </View>
                ))}
              </Card>

              {/* 7-Day Streak Chart */}
              <Card>
                <Text style={[typography.label, { color: palette.gold }]}>
                  🔥 LỊCH SỬ ĐIỂM DANH 7 NGÀY GẦN NHẤT (RIÊNG TÀI KHOẢN NÀY)
                </Text>
                <View style={styles.weekRow}>
                  {last7Days.map((d) => (
                    <View key={d.key} style={styles.weekCol}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: d.done ? 38 : 12,
                            backgroundColor: d.done ? '#F59E0B' : palette.paperMuted,
                          },
                        ]}
                      />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: d.isToday ? palette.indigo : palette.inkMuted }}>
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Category ELOs */}
              <Card>
                <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.sm }]}>
                  ⚔️ ELO ĐỐI KHÁNG 1V1 THEO CHUYÊN NGÀNH (ĐỈNH {eloPeak} ELO · KỶ LỤC {bestScore} ĐIỂM)
                </Text>
                <View style={styles.catEloGrid}>
                  {DUEL_CATEGORIES.map((cat) => (
                    <View key={cat.id} style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
                        {cat.icon} {cat.label}
                      </Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '900', color: palette.indigo }}>
                        {categoryElos[cat.id] ?? eloRating}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          )}

          {/* ── TAB 3: FRIENDS & DIRECT MESSENGER ── */}
          {activeTab === 'friends' && (
            <Card style={{ marginTop: spacing.md, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  Bạn bè & Học giả Trực tuyến ({onlineScholars.length})
                </Text>
                <Button variant="secondary" icon="person-add-outline" onPress={() => router.push('/leaderboard')}>
                  Tìm thêm bạn bè
                </Button>
              </View>
              {onlineScholars.length === 0 ? (
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  Hiện chưa có học giả khác trực tuyến cùng lúc. Bấm «Tìm thêm bạn bè» để sao chép Link mời bạn bè!
                </Text>
              ) : (
                onlineScholars.map((os) => (
                  <View
                    key={os.id}
                    style={[styles.friendRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>{os.displayName}</Text>
                      <Text style={[typography.caption, { color: palette.inkMuted }]}>
                        🟢 Trực tuyến · {os.eloRating} ELO · {os.totalScore} XP
                      </Text>
                    </View>
                    <Button
                      icon="chatbubble-ellipses-outline"
                      onPress={() =>
                        router.push({
                          pathname: '/community',
                          params: { tab: 'messenger', dmUserId: os.id, dmName: os.displayName },
                        })
                      }
                    >
                      Nhắn tin
                    </Button>
                  </View>
                ))
              )}
            </Card>
          )}

          {/* ── TAB 4: ADMIN GIFTS & USER QUESTION SETS ── */}
          {activeTab === 'vault' && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Card style={{ gap: 8 }}>
                <Text style={[typography.label, { color: palette.gold }]}>
                  🎁 HỘP QUÀ & HỌC LIỆU TỪ QUẢN TRỊ VIÊN ({myGifts.length})
                </Text>
                {myGifts.length === 0 ? (
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    {user
                      ? 'Chưa có quà tặng mới nào gửi tới tài khoản của bạn.'
                      : 'Đăng nhập để nhận quà tặng và học liệu từ Admin.'}
                  </Text>
                ) : (
                  myGifts.map((gift) => {
                    const isClaimed = gift.claimedByIds.includes(viewerId);
                    return (
                      <View
                        key={gift.id}
                        style={[styles.friendRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]}>{gift.title}</Text>
                          {!!gift.message && (
                            <Text style={[typography.caption, { color: palette.inkMuted }]}>{gift.message}</Text>
                          )}
                        </View>
                        {isClaimed ? (
                          <Badge tone="success">✓ Đã nhận</Badge>
                        ) : (
                          <Button variant="reward" onPress={() => void handleClaimGift(gift)}>
                            Nhận ngay
                          </Button>
                        )}
                      </View>
                    );
                  })
                )}
              </Card>

              <Card style={{ gap: 8 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>
                  📚 KHO BỘ ĐỀ HỌC TẬP ({questionSets.length})
                </Text>
                {questionSets.slice(0, 6).map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: s.id } })}
                    style={[styles.friendRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                        {s.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                        {s.subject} · {s.questions.length} câu hỏi
                      </Text>
                    </View>
                    <Ionicons name="play-circle" size={24} color={palette.indigo} />
                  </Pressable>
                ))}
              </Card>
            </View>
          )}

          {!user && (
            <View style={{ marginTop: spacing.lg }}>
              <Button icon="log-in-outline" onPress={() => router.push('/auth')} fullWidth>
                Đăng nhập để đồng bộ Trang Cá Nhân đa thiết bị
              </Button>
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalOpen} transparent animationType="fade" onRequestClose={() => setEditModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={{ width: '100%', maxWidth: 460, gap: 10, backgroundColor: palette.paper }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[typography.title, { color: palette.ink }]}>✏️ Chỉnh sửa Trang Cá Nhân</Text>
              <Pressable onPress={() => setEditModalOpen(false)}>
                <Ionicons name="close" size={22} color={palette.inkMuted} />
              </Pressable>
            </View>
            {user && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tên hiển thị..."
                placeholderTextColor={palette.inkMuted}
                style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
              />
            )}
            <TextInput
              value={university}
              onChangeText={setUniversity}
              placeholder="Trường Đại học / Học viện..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />
            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Chuyên ngành học tập..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.input, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Tiểu sử / Châm ngôn học tập..."
              placeholderTextColor={palette.inkMuted}
              style={[styles.input, { minHeight: 70, color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
            />
            <Button disabled={busy} onPress={() => void saveProfileDetails()} fullWidth>
              {busy ? 'Đang lưu & đồng bộ…' : 'Lưu thay đổi'}
            </Button>
          </Card>
        </View>
      </Modal>

      {/* Avatar Picker Modal */}
      <Modal visible={avatarModalOpen} transparent animationType="fade" onRequestClose={() => setAvatarModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarModalOpen(false)}>
          <Pressable style={{ width: '100%', maxWidth: 420 }} onPress={() => undefined}>
            <Card style={{ padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.paper }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <Text style={[typography.title, { color: palette.ink }]}>Cập nhật ảnh đại diện</Text>
                <Pressable onPress={() => setAvatarModalOpen(false)}>
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>
              <Button icon="image-outline" disabled={avatarBusy} onPress={() => void handlePickPhotoAvatar()} fullWidth>
                {avatarBusy ? 'Đang tải ảnh…' : 'Chọn ảnh từ thiết bị'}
              </Button>
              <View style={styles.presetGrid}>
                {AVATAR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.id}
                    disabled={avatarBusy}
                    onPress={() => void handleSelectPresetAvatar(preset.bg)}
                    style={[styles.presetItem, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
                  >
                    <View style={[styles.presetCircle, { backgroundColor: preset.bg }]}>
                      <Ionicons name={preset.icon} size={20} color={preset.fg} />
                    </View>
                    <Text style={{ fontSize: 11, color: palette.ink }} numberOfLines={1}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Story Modals right on Profile */}
      <StoryViewerModal
        story={viewingStory}
        viewerId={viewerId}
        onClose={() => setViewingStory(null)}
        onReact={(sid, emo) => reactToStory(sid, emo, viewerId)}
      />
      <StoryComposerModal
        visible={storyComposerOpen}
        onClose={() => setStoryComposerOpen(false)}
        onPublish={(data) => {
          addStory({
            authorId: viewerId,
            authorName: viewerName,
            authorAvatar: user?.avatarUrl ?? null,
            authorLevel: rankInfo.level,
            badgeLabel: `${rankInfo.badge} ${rankInfo.titleVi}`,
            ...data,
          });
          addBonusXp(20);
          sfx.playLevelUp();
          setMessage('✨ Đã đăng Tin Story mới lên Trang Cá Nhân & Cộng đồng (+20 XP)!');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  fbHeaderCard: { padding: 0, overflow: 'hidden' },
  coverBanner: {
    height: 176,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 12,
  },
  coverTopControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 10, 36, 0.62)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  coverColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  changeCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
  },
  fbIdentityBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    marginTop: -46,
    gap: 8,
  },
  overlappingAvatarWrap: { position: 'relative' },
  fbAvatarImg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#0F172A',
  },
  avatarCamBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBox: {
    marginTop: spacing.md,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 6,
  },
  fbActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  moreSquareBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightItem: {
    width: 74,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 5,
  },
  highlightCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbTabsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    borderTopWidth: 1,
    gap: 4,
  },
  fbTabItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  introLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlineCheckInBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  timelineInput: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  rankLadderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    height: 60,
  },
  weekCol: { alignItems: 'center', gap: 6, flex: 1 },
  weekBar: { width: 18, borderRadius: 6 },
  catEloGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catEloChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 130,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 8, 24, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  presetItem: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  presetCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
