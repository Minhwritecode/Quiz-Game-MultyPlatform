import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { roomApi } from '@/features/multiplayer/services/room.api';
import { gameApi } from '@/features/multiplayer/services/game.api';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import type { RoomData } from '@/features/multiplayer/domain/models';

export default function HostRoomScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoom = useCallback(async () => {
    if (!roomCode) return;
    try {
      const data = await roomApi.get(roomCode);
      setRoom(data);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    let mounted = true;
    void roomApi.get(roomCode).then((data) => {
      if (mounted && data) {
        setRoom(data);
        setIsLoading(false);
      }
    });

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomCode);

    const onUpdated = () => {
      void loadRoom();
    };

    const onStarted = () => {
      router.push({
        pathname: '/multiplayer/question/[roomCode]',
        params: { roomCode },
      });
    };

    socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATED, onUpdated);
    socket.on(SOCKET_EVENTS.QUIZ_STARTED, onStarted);

    return () => {
      mounted = false;
      socket.off(SOCKET_EVENTS.PARTICIPANTS_UPDATED, onUpdated);
      socket.off(SOCKET_EVENTS.QUIZ_STARTED, onStarted);
    };
  }, [roomCode, loadRoom, router]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Tham gia phòng thi đấu trắc nghiệm Papyrus! Mã phòng: ${roomCode}`,
      });
    } catch {
      // Ignore
    }
  };

  const handleStart = () => {
    if (!roomCode) return;
    gameApi.startQuiz(roomCode);
    router.push({
      pathname: '/multiplayer/question/[roomCode]',
      params: { roomCode },
    });
  };

  const handlePause = () => {
    if (!roomCode) return;
    gameApi.pauseQuiz(roomCode);
    setRoom((prev) => (prev ? { ...prev, status: 'paused' } : null));
  };

  const handleResume = () => {
    if (!roomCode) return;
    gameApi.resumeQuiz(roomCode);
    setRoom((prev) => (prev ? { ...prev, status: 'live' } : null));
  };

  const handleEnd = () => {
    Alert.alert('Kết thúc phòng', 'Bạn có chắc chắn muốn kết thúc trận đấu ngay?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Kết thúc',
        style: 'destructive',
        onPress: () => {
          if (roomCode) gameApi.endQuiz(roomCode);
          router.replace('/multiplayer/results/' + roomCode);
        },
      },
    ]);
  };

  return (
    <Screen>
      <TopBar title="Chủ phòng Live (Host)" />

      <View style={styles.container}>
        {/* ROOM CODE DISPLAY CARD */}
        <Card style={styles.codeCard}>
          <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', letterSpacing: 1 }]}>
            MÃ PHÒNG CHIA SẺ
          </Text>

          <Text style={[styles.codeText, { color: palette.indigo }]}>{roomCode}</Text>

          <View style={styles.codeSubRow}>
            <Badge tone="success">
              {room?.status === 'waiting'
                ? 'Đang chờ người chơi'
                : room?.status === 'live'
                ? 'Đang diễn ra'
                : 'Tạm dừng'}
            </Badge>
            <Badge tone="primary">{room?.players.length || 0} Người tham gia</Badge>
          </View>

          <View style={styles.shareRow}>
            <View style={styles.flexBtn}>
              <Button variant="secondary" icon="share-social-outline" onPress={handleShare}>
                Chia sẻ mã
              </Button>
            </View>
            <View style={styles.flexBtn}>
              <Button
                variant="ghost"
                icon="qr-code-outline"
                onPress={() => Alert.alert('Mã QR', `Mã QR liên kết tới phòng: ${roomCode}`)}
              >
                Mã QR
              </Button>
            </View>
          </View>
        </Card>

        {/* HOST CONTROLS */}
        <View style={styles.controlsRow}>
          {room?.status === 'waiting' && (
            <View style={styles.flexBtn}>
              <Button icon="rocket-outline" variant="reward" onPress={handleStart}>
                🚀 Bắt đầu Quiz
              </Button>
            </View>
          )}

          {room?.status === 'live' && (
            <>
              <View style={styles.flexBtn}>
                <Button icon="pause-outline" variant="secondary" onPress={handlePause}>
                  ⏸ Tạm dừng
                </Button>
              </View>
              <View style={styles.flexBtn}>
                <Button icon="stop-outline" variant="ghost" onPress={handleEnd}>
                  🛑 Kết thúc
                </Button>
              </View>
            </>
          )}

          {room?.status === 'paused' && (
            <>
              <View style={styles.flexBtn}>
                <Button icon="play-outline" variant="reward" onPress={handleResume}>
                  ▶ Tiếp tục
                </Button>
              </View>
              <View style={styles.flexBtn}>
                <Button icon="stop-outline" variant="ghost" onPress={handleEnd}>
                  🛑 Kết thúc
                </Button>
              </View>
            </>
          )}
        </View>

        {/* PARTICIPANTS LIST */}
        <View style={styles.sectionHeader}>
          <Text style={[typography.title, { color: palette.ink }]}>
            Danh sách người chơi ({room?.players.length || 0})
          </Text>
        </View>

        <FlatList
          data={room?.players || []}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item, index }) => (
            <Card style={styles.playerCard}>
              <View style={styles.playerLeft}>
                <View style={[styles.avatarWrap, { backgroundColor: palette.indigo }]}>
                  <Text style={styles.avatarText}>{item.nickname.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
                    {item.nickname} {item.isHost ? '👑 (Host)' : ''}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Trạng thái: Đã kết nối
                  </Text>
                </View>
              </View>

              <Text style={[styles.playerScore, { color: palette.indigo }]}>
                {item.score} đ
              </Text>
            </Card>
          )}
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Ionicons name="people-outline" size={36} color={palette.inkMuted} />
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.sm }]}>
                Đang chờ người chơi quét mã hoặc nhập mã phòng...
              </Text>
            </Card>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  codeCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  codeText: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 6,
    marginVertical: spacing.xs,
  },
  codeSubRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  shareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  flexBtn: {
    flex: 1,
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
  playerScore: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
});
