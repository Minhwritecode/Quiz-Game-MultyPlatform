import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import { roomApi } from '@/features/multiplayer/services/room.api';
import type { RoomData } from '@/features/multiplayer/domain/models';

export default function LobbyRoomScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode, nickname } = useLocalSearchParams<{ roomCode: string; nickname?: string }>();

  const [room, setRoom] = useState<RoomData | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomCode);

    void roomApi.get(roomCode).then(setRoom);

    const onParticipantsUpdated = () => {
      void roomApi.get(roomCode).then(setRoom);
    };

    const onQuizStarted = () => {
      router.replace({
        pathname: '/multiplayer/question/[roomCode]',
        params: { roomCode },
      });
    };

    socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);
    socket.on(SOCKET_EVENTS.QUIZ_STARTED, onQuizStarted);

    return () => {
      socket.off(SOCKET_EVENTS.PARTICIPANTS_UPDATED, onParticipantsUpdated);
      socket.off(SOCKET_EVENTS.QUIZ_STARTED, onQuizStarted);
    };
  }, [roomCode, router]);

  return (
    <Screen scroll={false}>
      <TopBar title="Phòng chờ trận đấu" />

      <View style={styles.container}>
        <FlatList
          data={room?.players || [{ playerId: 'me', nickname: nickname || 'Bạn', score: 0 }]}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={{ paddingBottom: 60 }}
          ListHeaderComponent={
            <>
              <Card style={styles.statusCard}>
                <ActivityIndicator size="large" color={palette.indigo} />
                <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.md, textAlign: 'center' }]}>
                  Đang chờ chủ phòng bắt đầu...
                </Text>
                <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                  Bạn đã vào phòng thi đấu mã: <Text style={{ color: palette.indigo, fontWeight: '800' }}>{roomCode}</Text>
                </Text>

                <View style={styles.badgeRow}>
                  <Badge tone="reward">Biệt danh: {nickname || 'Người chơi'}</Badge>
                  <Badge tone="success">Đã sẵn sàng ⚡</Badge>
                </View>
              </Card>

              <View style={styles.sectionHeader}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  Người chơi trong phòng ({room?.players.length || 1})
                </Text>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <Card style={styles.playerCard}>
              <View style={styles.playerLeft}>
                <View style={[styles.avatarWrap, { backgroundColor: palette.indigo }]}>
                  <Text style={styles.avatarText}>{item.nickname.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[typography.title, { color: palette.ink, fontSize: 16, flex: 1 }]} numberOfLines={1}>
                  {item.nickname}
                </Text>
              </View>
              <Badge tone="success">Đang kết nối</Badge>
            </Card>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
  statusCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
