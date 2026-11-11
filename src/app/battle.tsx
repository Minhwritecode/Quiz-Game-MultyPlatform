import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, IconTile, Screen, usePalette } from '@/shared/ui';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import type { Battle } from '@/features/room-battle/domain/battle';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';

export default function BattleScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [sets, setSets] = useState<{ id: string; title: string }[]>([]);
  const [roomMode, setRoomMode] = useState<'survival' | 'speed'>('survival');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const roomKey = `papyrus.battle.${user?.id ?? 'guest'}`;

  useEffect(() => {
    let active = true;
    setRoomId(null);
    setBattle(null);
    setSets([]);
    if (user) {
      void AsyncStorage.getItem(roomKey).then((id) => {
        if (active) setRoomId(id);
      });
      void dependencies.battle
        .sets()
        .then((value: { id: string; title: string }[]) => {
          if (active) setSets(value);
        })
        .catch((e: { message?: string }) => {
          if (active) setError(String(e.message ?? 'Unknown error'));
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id, roomKey]);

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    let fetching = false;

    const refresh = async () => {
      if (fetching || AppState.currentState === 'background') return;
      fetching = true;
      try {
        const next = await dependencies.battle.snapshot(roomId);
        if (active) {
          setBattle(next);
          setError('');
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t.battle.reconnecting);
      } finally {
        fetching = false;
      }
    };

    const heartbeat = () => {
      void dependencies.battle
        .heartbeat(roomId)
        .then(refresh)
        .catch(() => {
          if (active) setError(t.battle.lostConnection);
        });
    };

    heartbeat();
    const unsubscribe = dependencies.battle.subscribe(roomId, () => void refresh());
    const poll = setInterval(() => void refresh(), 1500);
    const lease = setInterval(heartbeat, 10000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') heartbeat();
    });

    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(lease);
      unsubscribe();
      appState.remove();
    };
  }, [roomId, t.battle.lostConnection, t.battle.reconnecting]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const enter = async (id: string) => {
    await AsyncStorage.setItem(roomKey, id);
    setRoomId(id);
  };

  const leave = async () => {
    if (roomId) await dependencies.battle.leave(roomId);
    await AsyncStorage.removeItem(roomKey);
    setRoomId(null);
    setBattle(null);
  };

  const me = battle?.players.find((p) => p.userId === user?.id);
  const question = battle?.question;

  return (
    <Screen bottomNav>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.label, { color: palette.indigo }]}>{t.battle.badge}</Text>
          <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
            {t.battle.title} ⚔️
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
            {t.battle.sub}
          </Text>
        </View>
      </View>

      {/* Error Banner */}
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: palette.dangerTint, borderColor: palette.danger }]}>
          <Ionicons name="alert-circle" size={18} color={palette.danger} />
          <Text style={[typography.caption, { color: palette.danger, flex: 1 }]}>{error}</Text>
        </View>
      )}

      {/* Not Signed In */}
      {!user && (
        <Card style={styles.notAuthCard}>
          <IconTile icon="lock-closed-outline" tint="primary" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            {language === 'vi' ? 'Đăng nhập để vào phòng đấu' : 'Sign in to join battles'}
          </Text>
          <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
            {language === 'vi'
              ? 'Tính năng thi đấu thời gian thực yêu cầu tài khoản để lưu bảng điểm và tranh tài cùng bạn bè.'
              : 'Realtime battle arena requires an account to store match history and compete with friends.'}
          </Text>
          <View style={{ marginTop: spacing.lg, width: '100%' }}>
            <Button icon="log-in-outline" onPress={() => router.push('/auth')} fullWidth>
              {language === 'vi' ? 'Đăng nhập ngay' : 'Sign in now'}
            </Button>
          </View>
        </Card>
      )}

      {/* Lobby - Join or Create */}
      {user && !roomId && (
        <View style={styles.lobbySections}>
          {/* Instant Survival Arena Card */}
          <Card style={{ backgroundColor: palette.dangerTint, borderColor: palette.dangerBorder, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon="skull-outline" tint="danger" />
              <View style={{ flex: 1 }}>
                <Text style={[typography.title, { color: palette.ink }]}>{t.survival.title}</Text>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  {language === 'vi'
                    ? 'Chơi ngay chế độ sinh tồn 3 mạng đấu cùng 3 AI Bot hoặc luyện tập cá nhân!'
                    : 'Play 3-lives survival mode immediately with 3 AI Bots or solo practice!'}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: spacing.md }}>
              <Button variant="danger" icon="flame" onPress={() => router.push('/games/survival')} fullWidth>
                {language === 'vi' ? 'Vào Đấu trường Sinh tồn ngay' : 'Enter Survival Arena Now'}
              </Button>
            </View>
          </Card>

          {/* Join Room */}
          <Card style={styles.cardSection}>
            <Text style={[typography.title, { color: palette.ink }]}>{t.battle.enterPin}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {language === 'vi'
                ? 'Nhập mã PIN 6 ký tự do bạn bè chia sẻ để tham gia ngay:'
                : 'Enter the 6-character room PIN code shared by your host:'}
            </Text>
            <TextInput
              accessibilityLabel="Room code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              maxLength={6}
              placeholder={t.battle.pinPlaceholder}
              placeholderTextColor={palette.inkMuted}
              style={[
                styles.pinInput,
                { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
              ]}
            />
            <Button
              icon="arrow-forward"
              disabled={busy || !/^[a-z0-9]{6}$/i.test(code.trim())}
              onPress={() =>
                void run(async () => {
                  const room = await dependencies.rooms.join(code.trim().toUpperCase());
                  await enter(room.id);
                })
              }
              fullWidth
            >
              {t.battle.joinRoom}
            </Button>
          </Card>

          {/* Create Room */}
          <Card style={styles.cardSection}>
            <Text style={[typography.title, { color: palette.ink }]}>{t.battle.createRoom}</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
              {language === 'vi'
                ? 'Chọn chế độ đấu và bộ câu hỏi từ đám mây của bạn để làm đề thi:'
                : 'Select battle mode and synced question set to host a match:'}
            </Text>

            {/* Mode Selector Pill Buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: spacing.md }}>
              <Pressable
                onPress={() => setRoomMode('survival')}
                style={[
                  styles.modePill,
                  {
                    backgroundColor: roomMode === 'survival' ? palette.dangerTint : palette.paper,
                    borderColor: roomMode === 'survival' ? palette.danger : palette.paperMuted,
                  },
                ]}
              >
                <Ionicons name="heart" size={16} color={roomMode === 'survival' ? palette.danger : palette.inkMuted} />
                <Text
                  style={[
                    typography.caption,
                    {
                      fontWeight: '700',
                      color: roomMode === 'survival' ? palette.danger : palette.ink,
                    },
                  ]}
                >
                  {t.survival.modeSurvival}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setRoomMode('speed')}
                style={[
                  styles.modePill,
                  {
                    backgroundColor: roomMode === 'speed' ? palette.indigoTint : palette.paper,
                    borderColor: roomMode === 'speed' ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Ionicons name="flash" size={16} color={roomMode === 'speed' ? palette.indigo : palette.inkMuted} />
                <Text
                  style={[
                    typography.caption,
                    {
                      fontWeight: '700',
                      color: roomMode === 'speed' ? palette.indigo : palette.ink,
                    },
                  ]}
                >
                  {t.survival.modeSpeed}
                </Text>
              </Pressable>
            </View>

            {sets.length === 0 ? (
              <View style={styles.noSetsNotice}>
                <Text style={[typography.caption, { color: palette.inkMuted }]}>
                  {language === 'vi'
                    ? 'Bạn chưa có bộ câu hỏi nào được đồng bộ lên đám mây.'
                    : 'You have no question sets synced to your cloud account yet.'}
                </Text>
                <Button variant="secondary" icon="cloud-upload" onPress={() => router.push('/sync')}>
                  {language === 'vi' ? 'Đồng bộ bộ câu hỏi ngay' : 'Sync question sets now'}
                </Button>
              </View>
            ) : (
              <View style={styles.setsList}>
                {sets.map((set) => (
                  <Button
                    key={set.id}
                    disabled={busy}
                    variant="secondary"
                    icon="play"
                    onPress={() =>
                      void run(async () => {
                        const room = await dependencies.rooms.create({
                          setId: set.id,
                          questionCount: 10,
                          secondsPerQuestion: 15,
                          mode: roomMode,
                        });
                        await enter(room.id);
                      })
                    }
                  >
                    {language === 'vi' ? `Tạo phòng: ${set.title}` : `Host: ${set.title}`}
                  </Button>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {/* Restoring Room */}
      {roomId && !battle && (
        <Card style={styles.restoringCard}>
          <Ionicons name="refresh" size={28} color={palette.indigo} />
          <Text style={[typography.body, { color: palette.ink, marginTop: spacing.sm }]}>
            {t.battle.reconnecting}
          </Text>
        </Card>
      )}

      {/* Active Battle Arena */}
      {battle && (
        <View style={styles.battleArena}>
          {/* Room PIN & Status */}
          <Card color={palette.indigo} style={styles.battleHero}>
            <Text style={[typography.label, { color: '#C7D2FE' }]}>{t.battle.roomCode}</Text>
            <Text style={[typography.display, { color: palette.white, letterSpacing: 6, fontSize: 40 }]}>
              {battle.code}
            </Text>
            <Badge tone="reward">
              {battle.phase === 'waiting'
                ? (language === 'vi' ? 'ĐANG CHỜ NGƯỜI CHƠI' : 'WAITING FOR PLAYERS')
                : battle.phase === 'question_open'
                ? (language === 'vi' ? 'ĐANG THI ĐẤU' : 'LIVE BATTLE')
                : (language === 'vi' ? 'KẾT THÚC' : 'FINISHED')}
            </Badge>

            <View style={styles.battleHeroButtons}>
              <Button
                variant="reward"
                icon="share-social"
                onPress={() =>
                  void Share.share({
                    message: `Tham gia phòng thi đấu Papyrus với mã: ${battle.code}\nLink: papyrus://battle?code=${battle.code}`,
                  })
                }
              >
                {t.battle.shareCode}
              </Button>

              {battle.phase === 'waiting' && (
                <Button
                  disabled={busy}
                  variant={me?.ready ? 'secondary' : 'primary'}
                  icon={me?.ready ? 'checkmark-circle' : 'time'}
                  onPress={() => void run(() => dependencies.battle.heartbeat(roomId!, !me?.ready))}
                >
                  {me?.ready
                    ? (language === 'vi' ? 'Đã sẵn sàng' : 'Ready')
                    : (language === 'vi' ? 'Tôi sẵn sàng' : 'I am ready')}
                </Button>
              )}

              {battle.phase === 'waiting' && battle.hostId === user?.id && (
                <Button
                  disabled={busy || battle.players.length < 2 || battle.players.some((p) => !p.ready || !p.connected)}
                  variant="success"
                  icon="play"
                  onPress={() => void run(() => dependencies.battle.start(roomId!))}
                >
                  {t.battle.startGame}
                </Button>
              )}
            </View>
          </Card>

          {/* Active Question */}
          {question && battle.phase !== 'finished' && (
            <Card style={styles.activeQuestionCard}>
              <View style={styles.questionHeader}>
                <Badge tone="primary">
                  {language === 'vi' ? `CÂU ${question.position + 1}` : `Q ${question.position + 1}`}
                </Badge>
                {battle.answered && (
                  <Badge tone="success">
                    {language === 'vi' ? 'ĐÃ TRẢ LỜI' : 'ANSWERED'}
                  </Badge>
                )}
              </View>

              <Text style={[typography.heading, { color: palette.ink, marginVertical: spacing.md }]}>
                {question.content}
              </Text>

              <View style={styles.battleOptions}>
                {question.options.map((option, index) => (
                  <Button
                    key={index}
                    variant={battle.answered ? (question.correctIndex === index ? 'success' : 'ghost') : 'secondary'}
                    disabled={busy || battle.answered || battle.phase !== 'question_open'}
                    onPress={() =>
                      void run(async () => {
                        await dependencies.battle.answer(roomId!, question.position, index);
                        setBattle(await dependencies.battle.snapshot(roomId!));
                      })
                    }
                    fullWidth
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </Button>
                ))}
              </View>

              {battle.answered && (
                <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.sm }]}>
                  {language === 'vi'
                    ? 'Đáp án của bạn đã được ghi nhận. Đang chờ kết quả từ đối thủ…'
                    : 'Your answer is locked in. Waiting for other players…'}
                </Text>
              )}

              {question.explanation && battle.phase !== 'question_open' && (
                <Text style={[typography.caption, { color: palette.ink, marginTop: spacing.md }]}>
                  {question.explanation}
                </Text>
              )}
            </Card>
          )}

          {/* Live Leaderboard */}
          <Card style={styles.leaderboardCard}>
            <Text style={[typography.title, { color: palette.ink }]}>
              {battle.phase === 'finished'
                ? (language === 'vi' ? '🏆 BẢNG VÀNG CHUNG CUỘC' : '🏆 FINAL STANDINGS')
                : (language === 'vi' ? '⚡ BẢNG ĐIỂM TRỰC TIẾP' : '⚡ LIVE SCOREBOARD')}
            </Text>
            <View style={styles.playersList}>
              {battle.players.map((p, i) => (
                <View
                  key={p.userId}
                  style={[
                    styles.playerRow,
                    {
                      backgroundColor: p.userId === user?.id ? palette.indigoTint : palette.paper,
                      borderColor: palette.paperMuted,
                    },
                  ]}
                >
                  <View style={styles.playerRank}>
                    <Text style={{ fontWeight: '800', color: i === 0 ? palette.gold : palette.ink }}>
                      {i === 0 ? '🥇 1' : i === 1 ? '🥈 2' : i === 2 ? '🥉 3' : `${i + 1}`}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
                      {p.name} {p.userId === battle.hostId && (language === 'vi' ? '(Chủ phòng)' : '(Host)')} {p.userId === user?.id && (language === 'vi' ? '(Bạn)' : '(You)')}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted }]}>
                      {p.connected
                        ? p.ready
                          ? (language === 'vi' ? 'Sẵn sàng' : 'Ready')
                          : (language === 'vi' ? 'Chưa sẵn sàng' : 'Not ready')
                        : (language === 'vi' ? 'Mất kết nối' : 'Disconnected')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[typography.title, { color: palette.indigo }]}>
                      {p.score} {language === 'vi' ? 'điểm' : 'pts'}
                    </Text>
                    {battle.mode === 'survival' && (
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                        <Ionicons name={(p.lives ?? 3) >= 1 ? 'heart' : 'heart-dislike'} size={14} color={(p.lives ?? 3) >= 1 ? '#EF4444' : '#94A3B8'} />
                        <Ionicons name={(p.lives ?? 3) >= 2 ? 'heart' : 'heart-dislike'} size={14} color={(p.lives ?? 3) >= 2 ? '#EF4444' : '#94A3B8'} />
                        <Ionicons name={(p.lives ?? 3) >= 3 ? 'heart' : 'heart-dislike'} size={14} color={(p.lives ?? 3) >= 3 ? '#EF4444' : '#94A3B8'} />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}

      {/* Leave Button */}
      {roomId && (
        <View style={{ marginTop: spacing.md, marginBottom: spacing.xxl }}>
          <Button disabled={busy} variant="danger" icon="exit-outline" onPress={() => void run(leave)} fullWidth>
            {t.battle.leaveRoom}
          </Button>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, marginBottom: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  notAuthCard: { alignItems: 'center', padding: spacing.xxl, borderRadius: radii.md },
  lobbySections: { gap: spacing.md, marginBottom: spacing.xl },
  cardSection: { padding: spacing.lg, borderRadius: radii.md },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  pinInput: {
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radii.md,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    marginVertical: spacing.md,
  },
  noSetsNotice: { gap: spacing.sm, marginTop: spacing.md },
  setsList: { gap: spacing.sm, marginTop: spacing.md },
  restoringCard: { alignItems: 'center', padding: spacing.xxl, borderRadius: radii.md },
  battleArena: { gap: spacing.md },
  battleHero: {
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 0,
    gap: spacing.xs,
  },
  battleHeroButtons: { gap: spacing.sm, marginTop: spacing.md, width: '100%' },
  activeQuestionCard: { padding: spacing.lg, borderRadius: radii.md },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  battleOptions: { gap: spacing.sm },
  leaderboardCard: { padding: spacing.lg, borderRadius: radii.md },
  playersList: { gap: spacing.xs, marginTop: spacing.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  playerRank: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
