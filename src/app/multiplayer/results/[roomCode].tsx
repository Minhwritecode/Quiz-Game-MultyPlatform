import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';
import type { LeaderboardPlayer } from '@/features/multiplayer/domain/models';

export default function MultiplayerResultsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  const finalResults = useMultiplayerStore((state) => state.finalResults);
  const reset = useMultiplayerStore((state) => state.reset);

  const displayResults: LeaderboardPlayer[] =
    finalResults.length > 0
      ? finalResults
      : [
          { playerId: 'r1', nickname: 'Anh Minh 👑', score: 480 },
          { playerId: 'r2', nickname: 'Lan Chi', score: 360 },
          { playerId: 'r3', nickname: 'Tuấn Khang', score: 250 },
        ];

  const handleFinish = () => {
    reset();
    router.replace('/');
  };

  return (
    <Screen scroll={false}>
      <TopBar title="Kết quả chung cuộc" />

      <View style={styles.container}>
        <FlatList
          data={displayResults}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={{ paddingBottom: 60 }}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={[styles.trophyWrap, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ fontSize: 44 }}>🏆</Text>
              </View>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.sm, textAlign: 'center' }]}>
                Trận đấu Hoàn tất!
              </Text>
              <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 2 }]}>
                Bảng vàng vinh danh những người chơi xuất sắc nhất
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isTop1 = index === 0;
            const isTop2 = index === 1;
            const isTop3 = index === 2;

            return (
              <Card
                style={[
                  styles.resultCard,
                  isTop1 && { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: 'rgba(245, 158, 11, 0.08)' },
                  isTop2 && { borderColor: '#94A3B8', borderWidth: 1.5 },
                  isTop3 && { borderColor: '#F97316', borderWidth: 1.5 },
                ]}
              >
                <View style={styles.left}>
                  <Text style={styles.medal}>
                    {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : '🎯'}
                  </Text>
                  <View style={styles.playerMeta}>
                    <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]} numberOfLines={1}>
                      {item.nickname}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      Hạng #{index + 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.right}>
                  <Text style={[styles.score, { color: isTop1 ? '#F59E0B' : palette.indigo }]}>
                    {item.score}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>điểm</Text>
                </View>
              </Card>
            );
          }}
        />

        <View style={styles.footer}>
          <Button variant="reward" icon="home-outline" onPress={handleFinish}>
            Về Trang chủ Papyrus
          </Button>
          <Button
            variant="secondary"
            icon="people-outline"
            onPress={() => router.replace('/multiplayer/join')}
          >
            Vào phòng đấu khác
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.md },
  trophyWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  playerMeta: {
    flex: 1,
    minWidth: 0,
  },
  medal: {
    fontSize: 28,
  },
  right: {
    alignItems: 'flex-end',
  },
  score: {
    fontSize: 20,
    fontWeight: '900',
  },
  footer: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
