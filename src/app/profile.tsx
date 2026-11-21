import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { dependencies } from '@/composition/dependencies';
import { DUEL_CATEGORIES, getEloTier } from '@/features/room-battle/domain/elo';

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
    <View style={[statStyles.box, { backgroundColor: palette.paperMuted }]}>
      <Text style={[typography.heading, { color: accent, fontSize: 22 }]} numberOfLines={1}>
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
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    minWidth: 70,
  },
});

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const palette = usePalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - spacing.lg * 2, 480);

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
  const [message, setMessage] = useState('');

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const updated = await dependencies.updateDisplayName(name);
      useAuthStore.getState().setUser(updated);
      setMessage('✅ Đã lưu hồ sơ.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được hồ sơ.');
    } finally {
      setBusy(false);
    }
  }

  const initials = (user?.displayName ?? 'P')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const winRate =
    gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : '—';

  return (
    <Screen>
      <TopBar title="Hồ sơ cá nhân" />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', maxWidth: maxW, alignSelf: 'center', width: '100%' }}>

          {/* ── Avatar circle ── */}
          <View style={[styles.avatarWrap, { backgroundColor: palette.indigo }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

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

          {/* ── Competitive ELO Rank Badge ── */}
          <View style={[styles.eloBadgeRow, { backgroundColor: palette.paperRaised, borderColor: eloTier.color }]}>
            <Text style={{ fontSize: 18 }}>{eloTier.badge}</Text>
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
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              · Đỉnh {eloPeak}
            </Text>
          </View>

          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            <StatBox label="Điểm tổng" value={totalScore.toLocaleString('vi-VN')} accent={palette.indigo} />
            <StatBox label="Kỷ lục" value={bestScore.toLocaleString('vi-VN')} accent={palette.gold} />
            <StatBox label="Trận đấu" value={gamesPlayed} accent={palette.mint} />
            <StatBox label="Tỉ lệ thắng" value={winRate} accent={palette.danger} />
          </View>

          {/* ── Per-Category ELO Ratings ── */}
          <Card style={{ marginTop: spacing.md, width: '100%' }}>
            <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.sm }]}>
              ELO THEO CHUYÊN MÔN (1V1 DUEL)
            </Text>
            <View style={styles.catEloGrid}>
              {DUEL_CATEGORIES.map((cat) => {
                const rating = categoryElos[cat.id] ?? eloRating;
                return (
                  <View key={cat.id} style={[styles.catEloChip, { backgroundColor: palette.paperMuted }]}>
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

          {/* ── Edit display name ── */}
          {user ? (
            <Card style={{ marginTop: spacing.xl, width: '100%' }}>
              <Text style={[typography.label, { color: palette.ink }]}>Tên hiển thị</Text>
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
                    borderColor: palette.inkMuted,
                    color: palette.ink,
                    backgroundColor: palette.paperMuted,
                  },
                ]}
                placeholderTextColor={palette.inkMuted}
                placeholder="Nhập tên hiển thị…"
              />
              <Text style={[typography.caption, { color: palette.inkMuted, marginBottom: spacing.md }]}>
                Tên hiển thị được lưu trong tài khoản. Email và thông tin đăng nhập không thay đổi.
              </Text>
              <Button
                disabled={busy || name.trim().length < 2 || name.trim() === user.displayName}
                onPress={() => void save()}
              >
                {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
              </Button>
            </Card>
          ) : (
            <View style={{ marginTop: spacing.xl, width: '100%' }}>
              <Button onPress={() => router.push('/auth')}>Đăng nhập</Button>
            </View>
          )}

          {message ? (
            <Text
              accessibilityRole="alert"
              style={[typography.caption, { color: palette.ink, marginTop: spacing.md, textAlign: 'center' }]}
            >
              {message}
            </Text>
          ) : null}

          <View style={{ height: spacing.xxl }} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  eloBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
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
    paddingVertical: 7,
    borderRadius: 10,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 120,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    marginVertical: spacing.md,
    fontSize: 16,
  },
});
