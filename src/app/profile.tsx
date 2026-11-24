import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, ProgressBar, Screen, SmoothReveal, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useNotificationStore, type AdminGiftItem } from '@/features/notifications/state/useNotificationStore';
import { getLocalDateString } from '@/features/streak/domain/models';
import { dependencies } from '@/composition/dependencies';
import { preferenceStorage } from '@/composition/preferences';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import { DUEL_CATEGORIES, getEloTier } from '@/features/room-battle/domain/elo';
import { sfx } from '@/core/audio/sfx';

const PROFILE_META_KEY = 'papyrus.profile.meta.v1';
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

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

async function compressWebAvatarToDataUrl(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Unsupported platform'));
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      const minSide = Math.min(img.naturalWidth || size, img.naturalHeight || size);
      const sx = ((img.naturalWidth || size) - minSide) / 2;
      const sy = ((img.naturalHeight || size) - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'));
    img.src = uri;
  });
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  const palette = usePalette();
  return (
    <View style={[statStyles.box, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
      <Text style={[typography.heading, { color: accent, fontSize: 20, fontVariant: ['tabular-nums'] }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minWidth: 74,
  },
});

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const viewerId = user?.id ?? 'guest';
  const palette = usePalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.lg * 2, 600);

  const gamesPlayed = usePapyrusStore((s) => s.gamesPlayed);
  const totalScore = usePapyrusStore((s) => s.totalScore);
  const bestScore = usePapyrusStore((s) => s.bestScore);
  const wins = usePapyrusStore((s) => s.wins);
  const eloRating = usePapyrusStore((s) => s.eloRating);
  const eloPeak = usePapyrusStore((s) => s.eloPeak);
  const lastEloDelta = usePapyrusStore((s) => s.lastEloDelta);
  const categoryElos = usePapyrusStore((s) => s.categoryElos);
  const questionSetCount = usePapyrusStore((s) => s.questionSets.length);
  const hydrateCloudProfile = usePapyrusStore((s) => s.hydrateCloudProfile);
  const eloTier = getEloTier(eloRating);

  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const todayCompleted = useStreakStore((s) => s.todayCompleted);
  const historyDates = useStreakStore((s) => s.historyDates);
  const checkInToday = useStreakStore((s) => s.checkInToday);
  const membershipTier = useMembershipStore((s) => s.tier);

  const gifts = useNotificationStore((s) => s.gifts);
  const claimGift = useNotificationStore((s) => s.claimGift);
  const syncCloudGifts = useNotificationStore((s) => s.syncCloudGifts);

  const [name, setName] = useState(user?.displayName ?? '');
  const [university, setUniversity] = useState('');
  const [major, setMajor] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.id) {
      void hydrateCloudProfile();
      void syncCloudGifts(user.id);
    }
    void preferenceStorage.getItem(`${PROFILE_META_KEY}.${viewerId}`).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { university?: string; major?: string; bio?: string };
        setUniversity(parsed.university ?? '');
        setMajor(parsed.major ?? '');
        setBio(parsed.bio ?? '');
      } catch {
        // Ignore malformed meta
      }
    });
  }, [user?.id, viewerId, hydrateCloudProfile, syncCloudGifts]);

  const userId = user?.id ?? null;
  const myGifts = useMemo(
    () => gifts.filter((g) => g.recipientId === 'all' || (userId !== null && g.recipientId === userId)),
    [gifts, userId]
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

  const achievements = useMemo(
    () => [
      {
        id: 'scholar',
        title: 'Người Mở Cuộn',
        desc: 'Sở hữu ≥ 5 bộ câu hỏi',
        icon: 'book' as const,
        unlocked: questionSetCount >= 5,
        color: '#6366F1',
      },
      {
        id: 'streak',
        title: 'Ngọn Lửa Bền Bỉ',
        desc: 'Đạt chuỗi ≥ 3 ngày',
        icon: 'flame' as const,
        unlocked: longestStreak >= 3,
        color: '#F59E0B',
      },
      {
        id: 'duelist',
        title: 'Chiến Thần 1v1',
        desc: 'Thắng ít nhất 1 trận',
        icon: 'trophy' as const,
        unlocked: wins >= 1,
        color: '#10B981',
      },
      {
        id: 'elo',
        title: 'Tinh Anh ELO',
        desc: 'Đạt ≥ 1.300 ELO',
        icon: 'shield' as const,
        unlocked: eloPeak >= 1300,
        color: '#06B6D4',
      },
      {
        id: 'veteran',
        title: 'Bậc Thầy Đấu Trường',
        desc: 'Hoàn thành ≥ 10 trận',
        icon: 'medal' as const,
        unlocked: gamesPlayed >= 10,
        color: '#8B5CF6',
      },
      {
        id: 'vip',
        title: 'Đại Pháp Sư VIP',
        desc: 'Kích hoạt gói Archmage',
        icon: 'sparkles' as const,
        unlocked: membershipTier === 'archmage',
        color: '#EC4899',
      },
    ],
    [questionSetCount, longestStreak, wins, eloPeak, gamesPlayed, membershipTier]
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await preferenceStorage.setItem(
        `${PROFILE_META_KEY}.${viewerId}`,
        JSON.stringify({ university: university.trim(), major: major.trim(), bio: bio.trim() })
      );
      if (user && name.trim().length >= 2 && name.trim() !== user.displayName) {
        const updated = await dependencies.updateDisplayName(name);
        useAuthStore.getState().setUser(updated);
      }
      setMessage('✅ Đã lưu thông tin hồ sơ học giả thành công.');
    } catch (error) {
      setMessage(errorMessage(error, 'Không lưu được hồ sơ.'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickPhotoAvatar() {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    setMessage('');
    try {
      const picked = await dependencies.intake.pickSourceImages();
      const firstUri = picked[0];
      if (!firstUri) return;
      const finalUri =
        Platform.OS === 'web' ? await compressWebAvatarToDataUrl(firstUri) : firstUri;
      const updated = await dependencies.updateUserAvatar(finalUri);
      useAuthStore.getState().setUser(updated);
      setAvatarModalOpen(false);
      setMessage('✅ Đã cập nhật ảnh đại diện mới.');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể tải ảnh đại diện. Hãy chọn ảnh dung lượng nhỏ hơn.'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSelectPreset(bg: string) {
    if (!user || avatarBusy) return;
    setAvatarBusy(true);
    setMessage('');
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
      setMessage(`🎁 Đã lưu bộ đề "${claimed.title}" vào Thư viện của bạn!`);
    } else if (claimed.giftType === 'study_document' && claimed.documentText) {
      usePapyrusStore.getState().saveSourceDocument({
        id: `gift-doc-${claimed.id}`,
        title: `🎁 ${claimed.title}`,
        text: claimed.documentText,
        createdAt: new Date().toISOString(),
      });
      setMessage(`📄 Đã lưu tài liệu "${claimed.title}"! Vào Tạo Quiz AI để sử dụng ngay.`);
    } else if (claimed.giftType === 'vip_days') {
      useMembershipStore.getState().upgradeToVip();
      setMessage('👑 Đã kích hoạt đặc quyền VIP Archmage từ Admin!');
    } else if (claimed.giftType === 'streak_freeze') {
      useStreakStore.getState().addStreakFreeze(2);
      setMessage('❄️ Đã cộng +2 Bùa Đóng Băng Chuỗi!');
    }
    sfx.playLevelUp();
  }

  const initials = (user?.displayName ?? 'P')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : '—';
  const scholarLevel = Math.max(1, Math.floor(totalScore / 1000) + 1);
  const levelProgress = (totalScore % 1000) / 1000;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <Screen scroll={false}>
      <TopBar title="Hồ sơ học giả" />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* Hero Profile Card */}
          <SmoothReveal style={{ width: '100%' }}>
            <Card style={styles.heroProfileCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đổi ảnh đại diện"
                disabled={!user}
                onPress={() => setAvatarModalOpen(true)}
                style={({ pressed }) => [styles.avatarPressable, { opacity: pressed ? 0.85 : 1 }]}
              >
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarWrap, { backgroundColor: palette.indigo }]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                {user ? (
                  <View style={[styles.cameraBadge, { backgroundColor: palette.indigo, borderColor: palette.paperRaised }]}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>

              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.md, textAlign: 'center' }]}>
                {user?.displayName ?? 'Người học khách'}
              </Text>
              {(major || university) ? (
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700', marginTop: 2, textAlign: 'center' }]}>
                  {[major, university].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {user?.email ? (
                <Text selectable style={[typography.caption, { color: palette.inkMuted, marginTop: 2, textAlign: 'center' }]}>
                  {user.email}
                </Text>
              ) : null}
              {bio ? (
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 6, textAlign: 'center', fontStyle: 'italic' }]}>
                  “{bio}”
                </Text>
              ) : null}

              <View style={styles.badgeRow}>
                <Badge tone="primary">Cấp {scholarLevel}</Badge>
                {membershipTier === 'archmage' ? <Badge tone="reward">👑 VIP ARCHMAGE</Badge> : null}
                <View style={[styles.eloBadgeRow, { backgroundColor: palette.paper, borderColor: eloTier.color }]}>
                  <Text style={{ fontSize: 14 }}>{eloTier.badge}</Text>
                  <Text style={[typography.caption, { color: eloTier.color, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
                    {eloTier.labelVi} · {eloRating} ELO
                  </Text>
                  {lastEloDelta !== 0 ? (
                    <Text style={[typography.caption, { color: lastEloDelta > 0 ? palette.mint : palette.danger, fontWeight: '800' }]}>
                      ({lastEloDelta > 0 ? `+${lastEloDelta}` : lastEloDelta})
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Level XP Progress */}
              <View style={styles.xpWrap}>
                <View style={styles.xpLabelRow}>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Tiến độ lên Cấp {scholarLevel + 1}
                  </Text>
                  <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
                    {totalScore % 1000} / 1.000 XP · Đỉnh {eloPeak} ELO
                  </Text>
                </View>
                <ProgressBar progress={levelProgress} tone="primary" />
              </View>

              {user ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAvatarModalOpen(true)}
                  style={[styles.changeAvatarLink, { borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
                >
                  <Ionicons name="image-outline" size={16} color={palette.indigo} />
                  <Text style={[typography.caption, { color: palette.indigoDeep, fontWeight: '800' }]}>
                    Đổi ảnh đại diện
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          </SmoothReveal>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatBox label="Điểm tổng" value={totalScore.toLocaleString('vi-VN')} accent={palette.indigo} />
            <StatBox label="Kỷ lục" value={bestScore.toLocaleString('vi-VN')} accent={palette.gold} />
            <StatBox label="Trận đấu" value={gamesPlayed} accent={palette.mint} />
            <StatBox label="Tỉ lệ thắng" value={winRate} accent={palette.danger} />
          </View>

          {/* Daily Streak Check-In & 7-Day Activity Strip */}
          <SmoothReveal delay={60} style={{ width: '100%' }}>
            <Card style={{ marginTop: spacing.md, width: '100%' }}>
              <View style={styles.sectionTop}>
                <View>
                  <Text style={[typography.label, { color: palette.gold }]}>CHUỖI HỌC TẬP & ĐIỂM DANH</Text>
                  <Text style={[typography.title, { color: palette.ink, marginTop: 2, fontVariant: ['tabular-nums'] }]}>
                    🔥 {currentStreak} ngày hiện tại · Kỷ lục {longestStreak}
                  </Text>
                </View>
                {!todayCompleted ? (
                  <Button
                    variant="reward"
                    onPress={() => {
                      const res = checkInToday();
                      if (res.streakUpdated) {
                        sfx.playLevelUp();
                        setMessage(`🔥 Điểm danh thành công! Chuỗi học tập đạt ${res.newStreak} ngày.`);
                      }
                    }}
                  >
                    Điểm danh
                  </Button>
                ) : (
                  <Badge tone="success">✓ Đã điểm danh</Badge>
                )}
              </View>
              <View style={styles.weekRow}>
                {last7Days.map((d) => (
                  <View key={d.key} style={styles.weekCol}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: d.done ? 36 : 12,
                          backgroundColor: d.done ? '#F59E0B' : palette.paperMuted,
                        },
                      ]}
                    />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: d.isToday ? palette.indigo : palette.inkMuted }}>
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </SmoothReveal>

          {/* Gifted Sets & Documents from Admin */}
          <SmoothReveal delay={90} style={{ width: '100%' }}>
            <Card style={{ marginTop: spacing.md, width: '100%' }}>
              <View style={styles.sectionTop}>
                <Text style={[typography.label, { color: palette.gold }]}>
                  🎁 QUÀ TẶNG & TÀI LIỆU TỪ ADMIN ({myGifts.length})
                </Text>
              </View>
              {myGifts.length === 0 ? (
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
                  Chưa có bộ câu hỏi hoặc tài liệu nào được quản trị viên gửi tặng.
                </Text>
              ) : (
                <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                  {myGifts.map((gift) => {
                    const isClaimed = gift.claimedByIds.includes(viewerId);
                    return (
                      <View
                        key={gift.id}
                        style={[styles.giftCardRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]} numberOfLines={1}>
                            {gift.title}
                          </Text>
                          {!!gift.message && (
                            <Text style={[typography.caption, { color: palette.inkMuted }]} numberOfLines={2}>
                              {gift.message}
                            </Text>
                          )}
                        </View>
                        {isClaimed ? (
                          <Badge tone="success">Đã nhận</Badge>
                        ) : (
                          <Button variant="reward" onPress={() => void handleClaimGift(gift)}>
                            Nhận ngay
                          </Button>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </SmoothReveal>

          {/* Achievements Showcase */}
          <SmoothReveal delay={120} style={{ width: '100%' }}>
            <Card style={{ marginTop: spacing.md, width: '100%' }}>
              <View style={styles.sectionTop}>
                <Text style={[typography.label, { color: palette.indigo }]}>
                  HUY HIỆU THÀNH TÍCH ({unlockedCount}/{achievements.length})
                </Text>
              </View>
              <View style={styles.achGrid}>
                {achievements.map((ach) => (
                  <View
                    key={ach.id}
                    style={[
                      styles.achCard,
                      {
                        backgroundColor: palette.paper,
                        borderColor: ach.unlocked ? ach.color : palette.paperMuted,
                        opacity: ach.unlocked ? 1 : 0.52,
                      },
                    ]}
                  >
                    <View style={[styles.achIcon, { backgroundColor: ach.unlocked ? ach.color : palette.paperMuted }]}>
                      <Ionicons name={ach.icon} size={18} color={ach.unlocked ? '#FFFFFF' : palette.inkMuted} />
                    </View>
                    <Text style={[typography.caption, { color: palette.ink, fontWeight: '800' }]} numberOfLines={1}>
                      {ach.title}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: palette.inkMuted, textAlign: 'center' }} numberOfLines={2}>
                      {ach.desc}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </SmoothReveal>

          {/* Per-Category ELO Ratings */}
          <Card style={{ marginTop: spacing.md, width: '100%' }}>
            <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.sm }]}>
              ELO THEO CHUYÊN MÔN (1V1 DUEL)
            </Text>
            <View style={styles.catEloGrid}>
              {DUEL_CATEGORIES.map((cat) => {
                const rating = categoryElos[cat.id] ?? eloRating;
                return (
                  <View key={cat.id} style={[styles.catEloChip, { backgroundColor: palette.paper }]}>
                    <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]} numberOfLines={1}>
                      {cat.icon} {cat.label}
                    </Text>
                    <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
                      {rating}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Editable Academic Profile */}
          <Card style={{ marginTop: spacing.md, width: '100%', gap: spacing.xs }}>
            <Text style={[typography.label, { color: palette.indigo }]}>HỒ SƠ HỌC THUẬT CÁ NHÂN</Text>
            {user ? (
              <TextInput
                accessibilityLabel="Tên hiển thị"
                value={name}
                onChangeText={setName}
                maxLength={60}
                editable={!busy}
                style={[styles.input, { borderColor: palette.paperMuted, color: palette.ink, backgroundColor: palette.paper }]}
                placeholderTextColor={palette.inkMuted}
                placeholder="Tên hiển thị..."
              />
            ) : null}
            <TextInput
              accessibilityLabel="Trường Đại học"
              value={university}
              onChangeText={setUniversity}
              maxLength={80}
              editable={!busy}
              style={[styles.input, { borderColor: palette.paperMuted, color: palette.ink, backgroundColor: palette.paper }]}
              placeholderTextColor={palette.inkMuted}
              placeholder="Trường Đại học / Học viện (vd: VKU, Bách Khoa...)"
            />
            <TextInput
              accessibilityLabel="Chuyên ngành"
              value={major}
              onChangeText={setMajor}
              maxLength={80}
              editable={!busy}
              style={[styles.input, { borderColor: palette.paperMuted, color: palette.ink, backgroundColor: palette.paper }]}
              placeholderTextColor={palette.inkMuted}
              placeholder="Chuyên ngành (vd: Công nghệ thông tin, Văn học...)"
            />
            <TextInput
              accessibilityLabel="Giới thiệu bản thân"
              value={bio}
              onChangeText={setBio}
              maxLength={140}
              editable={!busy}
              style={[styles.input, { borderColor: palette.paperMuted, color: palette.ink, backgroundColor: palette.paper }]}
              placeholderTextColor={palette.inkMuted}
              placeholder="Khẩu hiệu học tập hoặc giới thiệu ngắn..."
            />
            <Button disabled={busy} onPress={() => void save()} fullWidth>
              {busy ? 'Đang lưu…' : 'Lưu hồ sơ học giả'}
            </Button>
          </Card>

          {!user ? (
            <View style={{ marginTop: spacing.lg, width: '100%' }}>
              <Button onPress={() => router.push('/auth')} fullWidth>
                Đăng nhập để đồng bộ hồ sơ lên Cloud
              </Button>
            </View>
          ) : null}

          {message ? (
            <Text
              accessibilityRole="alert"
              style={[typography.caption, { color: palette.indigo, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' }]}
            >
              {message}
            </Text>
          ) : null}

          <View style={{ height: spacing.xxl }} />
        </View>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal visible={avatarModalOpen} transparent animationType="fade" onRequestClose={() => setAvatarModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarModalOpen(false)}>
          <Pressable style={styles.modalWrap} onPress={() => undefined}>
            <Card style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={[typography.title, { color: palette.ink }]}>Cập nhật ảnh đại diện</Text>
                <Pressable onPress={() => setAvatarModalOpen(false)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <Button icon="image-outline" disabled={avatarBusy} onPress={() => void handlePickPhotoAvatar()} fullWidth>
                {avatarBusy ? 'Đang tải ảnh…' : 'Chọn ảnh từ thiết bị'}
              </Button>

              <Text style={[typography.label, { color: palette.inkMuted, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                HOẶC CHỌN BIỂU TƯỢNG HỌC GIẢ
              </Text>
              <View style={styles.presetGrid}>
                {AVATAR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="button"
                    disabled={avatarBusy}
                    onPress={() => void handleSelectPreset(preset.bg)}
                    style={({ pressed }) => [
                      styles.presetItem,
                      { backgroundColor: palette.paper, borderColor: palette.paperMuted, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <View style={[styles.presetCircle, { backgroundColor: preset.bg }]}>
                      <Ionicons name={preset.icon} size={22} color={preset.fg} />
                    </View>
                    <Text style={[typography.caption, { color: palette.ink, fontSize: 11.5 }]} numberOfLines={1}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  heroProfileCard: { width: '100%', alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  avatarPressable: { position: 'relative' },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#6366F1' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  eloBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  xpWrap: { width: '100%', marginTop: spacing.lg, gap: 6 },
  xpLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  changeAvatarLink: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: spacing.md, paddingTop: spacing.xs, height: 60 },
  weekCol: { alignItems: 'center', gap: 6, flex: 1 },
  weekBar: { width: 18, borderRadius: 6 },
  giftCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  achCard: { flexBasis: '30%', flexGrow: 1, minWidth: 96, alignItems: 'center', gap: 4, padding: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  achIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catEloGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  catEloChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: 10, flexBasis: '47%', flexGrow: 1, minWidth: 120 },
  input: { minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderRadius: radii.sm, marginVertical: 4, fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(6, 10, 36, 0.68)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalWrap: { width: '100%', maxWidth: 420 },
  modalCard: { padding: spacing.lg, borderRadius: radii.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  presetItem: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: 6, borderRadius: radii.sm, borderWidth: 1 },
  presetCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
