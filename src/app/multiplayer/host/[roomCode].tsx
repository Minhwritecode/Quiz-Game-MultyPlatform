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
import { gameApi, roomApi } from '@/composition/platform';
import { socket, SOCKET_EVENTS } from '@/features/multiplayer/services/socket';
import type { RoomData } from '@/features/multiplayer/domain/models';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';
import { RoomQrCodeModal } from '@/features/multiplayer/components/RoomQrCodeModal';

export default function HostRoomScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [readTimeSec, setReadTimeSec] = useState<0 | 3 | 5 | 10>(3);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const autoAdvance = useMultiplayerStore((s) => s.autoAdvance);
  const autoAdvanceDelaySec = useMultiplayerStore((s) => s.autoAdvanceDelaySec);
  const setAutoAdvance = useMultiplayerStore((s) => s.setAutoAdvance);
  const setAutoAdvanceDelaySec = useMultiplayerStore((s) => s.setAutoAdvanceDelaySec);

  const handleKickPlayer = (playerId: string, nickname: string) => {
    Alert.alert('Mời rời phòng', `Bạn muốn mời "${nickname}" ra khỏi phòng đấu?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Mời ra',
        style: 'destructive',
        onPress: () => {
          setRoom((prev) =>
            prev ? { ...prev, players: prev.players.filter((p) => p.playerId !== playerId) } : prev
          );
        },
      },
    ]);
  };

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
          if (!roomCode) return;
          gameApi.endQuiz(roomCode);
          router.replace({
            pathname: '/multiplayer/results/[roomCode]',
            params: { roomCode },
          });
        },
      },
    ]);
  };

  return (
    <Screen scroll={false}>
      <TopBar title="Chủ phòng Live (Host)" />

      <View style={styles.container}>
        <FlatList
          data={room?.players || []}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={{ paddingBottom: 60 }}
          ListHeaderComponent={
            <>
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
                  <Badge tone="primary">
                    {room?.players.length || 0} / {maxPlayers} Người chơi
                  </Badge>
                  <Badge tone="neutral">{timePerQuestion}s / câu</Badge>
                </View>

                {room?.status === 'waiting' && (
                  <View style={[styles.configBox, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
                    <View style={styles.configRow}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                        👥 Tối đa (2–10)
                      </Text>
                      <View style={styles.stepperWrap}>
                        <Pressable
                          onPress={() => setMaxPlayers((n) => Math.max(2, n - 1))}
                          disabled={maxPlayers <= 2}
                          style={[styles.stepBtn, { backgroundColor: palette.paperMuted, opacity: maxPlayers <= 2 ? 0.4 : 1 }]}
                        >
                          <Ionicons name="remove" size={16} color={palette.ink} />
                        </Pressable>
                        <Text style={[typography.title, { color: palette.indigo, minWidth: 26, textAlign: 'center', fontSize: 15 }]}>
                          {maxPlayers}
                        </Text>
                        <Pressable
                          onPress={() => setMaxPlayers((n) => Math.min(10, n + 1))}
                          disabled={maxPlayers >= 10}
                          style={[styles.stepBtn, { backgroundColor: palette.paperMuted, opacity: maxPlayers >= 10 ? 0.4 : 1 }]}
                        >
                          <Ionicons name="add" size={16} color={palette.ink} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.configRow}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>⏱ Thời gian/câu</Text>
                      <View style={styles.timeChips}>
                        {[15, 20, 30, 45].map((sec) => (
                          <Pressable
                            key={sec}
                            onPress={() => setTimePerQuestion(sec)}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: timePerQuestion === sec ? palette.indigo : palette.paperMuted,
                              },
                            ]}
                          >
                            <Text style={{ color: timePerQuestion === sec ? '#FFFFFF' : palette.ink, fontSize: 12, fontWeight: '700' }}>
                              {sec}s
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={styles.configRow}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>👀 Thời gian đọc đề</Text>
                      <View style={styles.timeChips}>
                        {([0, 3, 5, 10] as const).map((sec) => (
                          <Pressable
                            key={sec}
                            onPress={() => setReadTimeSec(sec)}
                            style={[
                              styles.timeChip,
                              {
                                backgroundColor: readTimeSec === sec ? palette.indigo : palette.paperMuted,
                              },
                            ]}
                          >
                            <Text style={{ color: readTimeSec === sec ? '#FFFFFF' : palette.ink, fontSize: 12, fontWeight: '700' }}>
                              {sec === 0 ? 'Tắt' : `${sec}s`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View style={styles.configRow}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                        🎉 Biểu cảm trực tiếp (Reactions)
                      </Text>
                      <Pressable
                        onPress={() => setReactionsEnabled((v) => !v)}
                        style={[
                          styles.timeChip,
                          { backgroundColor: reactionsEnabled ? palette.mint : palette.paperMuted },
                        ]}
                      >
                        <Text style={{ color: reactionsEnabled ? '#FFFFFF' : palette.ink, fontSize: 12, fontWeight: '700' }}>
                          {reactionsEnabled ? 'Đang bật' : 'Đã tắt'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.configRow}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700', flex: 1 }]}>
                        ⏩ Tự động qua câu (Auto-advance)
                      </Text>
                      <View style={styles.timeChips}>
                        <Pressable
                          onPress={() => setAutoAdvance(!autoAdvance)}
                          style={[
                            styles.timeChip,
                            { backgroundColor: autoAdvance ? palette.indigo : palette.paperMuted },
                          ]}
                        >
                          <Text style={{ color: autoAdvance ? '#FFFFFF' : palette.ink, fontSize: 12, fontWeight: '700' }}>
                            {autoAdvance ? 'Bật' : 'Tắt'}
                          </Text>
                        </Pressable>
                        {autoAdvance &&
                          ([3, 5, 8] as const).map((sec) => (
                            <Pressable
                              key={sec}
                              onPress={() => setAutoAdvanceDelaySec(sec)}
                              style={[
                                styles.timeChip,
                                {
                                  backgroundColor:
                                    autoAdvanceDelaySec === sec ? palette.mint : palette.paperMuted,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: autoAdvanceDelaySec === sec ? '#FFFFFF' : palette.ink,
                                  fontSize: 12,
                                  fontWeight: '700',
                                }}
                              >
                                {sec}s
                              </Text>
                            </Pressable>
                          ))}
                      </View>
                    </View>
                  </View>
                )}

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
                      onPress={() => setQrModalOpen(true)}
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

              {/* PARTICIPANTS LIST HEADER */}
              <View style={styles.sectionHeader}>
                <Text style={[typography.title, { color: palette.ink }]}>
                  Danh sách người chơi ({room?.players.length || 0})
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
                <View style={styles.playerInfo}>
                  <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]} numberOfLines={1}>
                    {item.nickname} {item.isHost ? '👑 (Host)' : ''}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    Trạng thái: Đã kết nối
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={[styles.playerScore, { color: palette.indigo }]}>
                  {item.score} đ
                </Text>
                {!item.isHost && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mời ${item.nickname} rời phòng`}
                    onPress={() => handleKickPlayer(item.playerId, item.nickname)}
                    style={[styles.kickBtn, { backgroundColor: palette.dangerTint }]}
                  >
                    <Ionicons name="person-remove-outline" size={16} color={palette.danger} />
                  </Pressable>
                )}
              </View>
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
        <RoomQrCodeModal
          visible={qrModalOpen}
          roomCode={roomCode || 'LIVE'}
          onClose={() => setQrModalOpen(false)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' },
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
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  shareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
  },
  flexBtn: {
    flex: 1,
    minWidth: 140,
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
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
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
  configBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  timeChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm },
  kickBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
