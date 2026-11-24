import { errorMessage } from '@/core/domain/failure';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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
import { Badge, Button, Card, ProgressBar, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { DUEL_CATEGORIES, getEloTier } from '@/features/room-battle/domain/elo';

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
      <Text style={[typography.heading, { color: accent, fontSize: 21 }]} numberOfLines={1}>
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
  const palette = usePalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.lg * 2, 520);

  const gamesPlayed = usePapyrusStore((s) => s.gamesPlayed);
  const totalScore = usePapyrusStore((s) => s.totalScore);
  const bestScore = usePapyrusStore((s) => s.bestScore);
  const wins = usePapyrusStore((s) => s.wins);
  const eloRating = usePapyrusStore((s) => s.eloRating);
  const eloPeak = usePapyrusStore((s) => s.eloPeak);
  const lastEloDelta = usePapyrusStore((s) => s.lastEloDelta);
  const categoryElos = usePapyrusStore((s) => s.categoryElos);
  const hydrateCloudProfile = usePapyrusStore((s) => s.hydrateCloudProfile);
  const eloTier = getEloTier(eloRating);

  useEffect(() => {
    if (user?.id) {
      void hydrateCloudProfile();
    }
  }, [user?.id, hydrateCloudProfile]);

  const [name, setName] = useState(user?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const updated = await dependencies.updateDisplayName(name);
      useAuthStore.getState().setUser(updated);
      setMessage('Đã cập nhật tên hiển thị thành công.');
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
      setMessage('Đã cập nhật ảnh đại diện mới.');
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
      setMessage('Đã đổi biểu tượng đại diện.');
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể lưu ảnh đại diện.'));
    } finally {
      setAvatarBusy(false);
    }
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

  return (
    <Screen scroll={false}>
      <TopBar title="Hồ sơ cá nhân" />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* Hero Profile Card with Editable Avatar */}
          <Card style={styles.heroProfileCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi ảnh đại diện"
              disabled={!user}
              onPress={() => setAvatarModalOpen(true)}
              style={({ pressed }) => [
                styles.avatarPressable,
                { opacity: pressed ? 0.85 : 1 },
              ]}
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
            {user?.email ? (
              <Text
                selectable
                style={[typography.caption, { color: palette.inkMuted, marginTop: 4, textAlign: 'center' }]}
              >
                {user.email}
              </Text>
            ) : null}

            <View style={styles.badgeRow}>
              <Badge tone="primary">Cấp {scholarLevel}</Badge>
              <View style={[styles.eloBadgeRow, { backgroundColor: palette.paper, borderColor: eloTier.color }]}>
                <Text style={{ fontSize: 15 }}>{eloTier.badge}</Text>
                <Text style={[typography.caption, { color: eloTier.color, fontWeight: '800' }]}>
                  {eloTier.labelVi} · {eloRating} ELO
                </Text>
                {lastEloDelta !== 0 ? (
                  <Text
                    style={[
                      typography.caption,
                      { color: lastEloDelta > 0 ? palette.mint : palette.danger, fontWeight: '800' },
                    ]}
                  >
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
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
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

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatBox label="Điểm tổng" value={totalScore.toLocaleString('vi-VN')} accent={palette.indigo} />
            <StatBox label="Kỷ lục" value={bestScore.toLocaleString('vi-VN')} accent={palette.gold} />
            <StatBox label="Trận đấu" value={gamesPlayed} accent={palette.mint} />
            <StatBox label="Tỉ lệ thắng" value={winRate} accent={palette.danger} />
          </View>

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
                    <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                      {rating}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Edit display name */}
          {user ? (
            <Card style={{ marginTop: spacing.md, width: '100%' }}>
              <Text style={[typography.label, { color: palette.ink }]}>TÊN HIỂN THỊ</Text>
              <TextInput
                accessibilityLabel="Tên hiển thị"
                value={name}
                onChangeText={setName}
                maxLength={60}
                editable={!busy}
                autoComplete="name"
                style={[
                  styles.input,
                  {
                    borderColor: palette.paperMuted,
                    color: palette.ink,
                    backgroundColor: palette.paper,
                  },
                ]}
                placeholderTextColor={palette.inkMuted}
                placeholder="Nhập tên hiển thị…"
              />
              <Text style={[typography.caption, { color: palette.inkMuted, marginBottom: spacing.md }]}>
                Tên và ảnh đại diện hiển thị trên bảng xếp hạng và phòng đấu trực tuyến.
              </Text>
              <Button
                disabled={busy || name.trim().length < 2 || name.trim() === user.displayName}
                onPress={() => void save()}
                fullWidth
              >
                {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </Button>
            </Card>
          ) : (
            <View style={{ marginTop: spacing.xl, width: '100%' }}>
              <Button onPress={() => router.push('/auth')} fullWidth>
                Đăng nhập để đồng bộ hồ sơ
              </Button>
            </View>
          )}

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
      <Modal
        visible={avatarModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAvatarModalOpen(false)}>
          <Pressable style={styles.modalWrap} onPress={() => undefined}>
            <Card style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={[typography.title, { color: palette.ink }]}>Cập nhật ảnh đại diện</Text>
                <Pressable onPress={() => setAvatarModalOpen(false)} hitSlop={8} accessibilityRole="button">
                  <Ionicons name="close" size={22} color={palette.inkMuted} />
                </Pressable>
              </View>

              <Button
                icon="image-outline"
                disabled={avatarBusy}
                onPress={() => void handlePickPhotoAvatar()}
                fullWidth
              >
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
                      {
                        backgroundColor: palette.paper,
                        borderColor: palette.paperMuted,
                        opacity: pressed ? 0.75 : 1,
                      },
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
  container: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroProfileCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatarPressable: {
    position: 'relative',
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#6366F1',
  },
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
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  eloBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  xpWrap: {
    width: '100%',
    marginTop: spacing.lg,
    gap: 6,
  },
  xpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  changeAvatarLink: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  catEloGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  catEloChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: 10,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 120,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
    marginVertical: spacing.md,
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalWrap: { width: '100%', maxWidth: 420 },
  modalCard: { padding: spacing.lg, borderRadius: radii.lg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetItem: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  presetCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
