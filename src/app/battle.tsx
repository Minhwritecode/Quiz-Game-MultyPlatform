import { errorMessage } from '@/core/domain/failure';
import Constants from 'expo-constants';
import { roomInvite } from '@/features/room-battle/domain/invite';
import { InviteQr, ScanRoomQr } from '@/features/room-battle/presentation/RoomQr';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Animated, AppState, Easing, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { preferenceStorage } from '@/composition/preferences';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, IconTile, Screen, TopBar, usePalette } from '@/shared/ui';
import { dependencies } from '@/composition/dependencies';
import { roomApi } from '@/composition/platform';
import { seedQuestionSets } from '@/composition/preferences';
import { useAuthStore } from '@/core/state/useAuthStore';
import type { Battle } from '@/features/room-battle/domain/battle';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';
import { GameEnvironment } from '@/shared/GameEnvironment';
import { CharacterAvatar } from '@/shared/CharacterAvatar';
import { sfx } from '@/core/audio/sfx';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';

import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { TurnPvpArena } from '@/features/room-battle/components/TurnPvpArena';
import { RankedDuelArena } from '@/features/room-battle/components/RankedDuelArena';
import { LiveReactionsBar } from '@/features/room-battle/components/LiveReactionsBar';
import { ReportQuestionButton } from '@/shared/ReportQuestionButton';
import { parseBattleInviteParams } from '@/features/room-battle/domain/pendingInvite';

const PENDING_INVITE_STORAGE_KEY = 'papyrus.battle.pending_invite';

const SCHOLAR_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#06B6D4'];

/** Simple pure-RN confetti: 20 coloured squares burst from top then fade */
function ConfettiOverlay({ visible }: { visible: boolean }) {
  const COLORS = ['#4F46E5', '#FBBF24', '#10B981', '#F43F5E', '#06B6D4', '#8B5CF6'];
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      x: 5 + (i % 10) * 9.5,
      y: new Animated.Value(0),
      op: new Animated.Value(1),
      color: COLORS[i % COLORS.length],
      rot: new Animated.Value(0),
      size: 8 + (i % 5) * 3,
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;
    const useNative = Platform.OS !== 'web';
    const anims = particles.map((p) => {
      p.y.setValue(0);
      p.op.setValue(1);
      p.rot.setValue(0);
      return Animated.parallel([
        Animated.timing(p.y, { toValue: 1, duration: 2000 + Math.random() * 800, useNativeDriver: useNative, easing: Easing.out(Easing.quad) }),
        Animated.timing(p.op, { toValue: 0, duration: 2400, delay: 400, useNativeDriver: useNative }),
        Animated.timing(p.rot, { toValue: 1, duration: 2000, useNativeDriver: useNative }),
      ]);
    });
    Animated.stagger(80, anims).start();
  }, [visible, particles]);

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: 2,
            opacity: p.op,
            transform: [
              { translateY: p.y.interpolate({ inputRange: [0, 1], outputRange: [0, 500] }) },
              { rotate: p.rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function BattleScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const localQuestionSets = usePapyrusStore((s) => s.questionSets);
  const recordGameResult = usePapyrusStore((s) => s.recordGameResult);
  const isVip = useMembershipStore((state) => state.tier === 'archmage');
  const params = useLocalSearchParams<{ code?: string; invite?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [connectionBanner, setConnectionBanner] = useState<'connected' | 'reconnecting' | 'forfeited'>('connected');
  useEffect(() => {
    if (params.code && /^[a-z0-9]{6}$/i.test(params.code)) setCode(params.code.toUpperCase());
  }, [params.code]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [sets, setSets] = useState<{ id: string; title: string }[]>([]);
  const [roomMode, setRoomMode] = useState<'survival' | 'speed' | 'turn_pvp'>('survival');
  const [arenaTab, setArenaTab] = useState<'rooms' | 'duel_1v1' | 'arcade'>('rooms');
  const [turnPvpActive, setTurnPvpActive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(15);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [setCategoryFilter, setSetCategoryFilter] = useState<'all' | 'it' | 'stem' | 'humanities' | 'mine'>('all');
  const [setSearchQuery, setSetSearchQuery] = useState('');
  const [showAllSets, setShowAllSets] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!battle?.question || battle.phase !== 'question_open') { setRemainingSeconds(null); return; }
    const deadline = Date.parse(battle.question.closesAt);
    const serverNow = Date.parse(battle.serverTime);
    const receivedAt = Date.now();
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((deadline - serverNow - (Date.now() - receivedAt)) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [battle]);
  // Record game result + show confetti when finished
  useEffect(() => {
    if (battle?.phase !== 'finished' || recordedRef.current) return;
    recordedRef.current = true;
    const mePlayer = battle.players.find((p) => p.userId === user?.id);
    const myScore = mePlayer?.score ?? 0;
    const isWin = battle.players.length > 0 && battle.players[0]?.userId === user?.id;
    recordGameResult(myScore, isWin);
    setShowConfetti(true);
    const tid = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(tid);
  }, [battle?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomOwner = user?.id ?? 'guest';

  useEffect(() => {
    let active = true;
    setRoomId(null);
    setBattle(null);
    const availableLocal = localQuestionSets.length > 0 ? localQuestionSets : seedQuestionSets;
    setSets(availableLocal.map((s) => ({ id: s.id, title: s.title })));

    if (user) {
      void dependencies.battleSession
        .load(roomOwner)
        .then((id) => {
          if (active) setRoomId(id);
        })
        .catch(() => undefined);
      void dependencies.battle
        .sets()
        .then((cloudValue: { id: string; title: string }[]) => {
          if (!active) return;
          const byTitle = new Set(cloudValue.map((c) => c.title.toLowerCase()));
          const merged = [
            ...cloudValue,
            ...availableLocal
              .filter((loc) => !byTitle.has(loc.title.toLowerCase()))
              .map((loc) => ({ id: loc.id, title: loc.title })),
          ];
          setSets(merged);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [user?.id, roomOwner, localQuestionSets]);

  // Handle deep-link room/duel invites reliably when app is opened, resumed, or unauthenticated
  useEffect(() => {
    const parsed = parseBattleInviteParams({ code: params.code, invite: params.invite });
    if (parsed) {
      if (!user) {
        void preferenceStorage.setItem(PENDING_INVITE_STORAGE_KEY, JSON.stringify(parsed));
      } else if (parsed.kind === 'duel') {
        setArenaTab('duel_1v1');
      } else {
        setArenaTab('rooms');
        setCode(parsed.code);
      }
      return;
    }
    if (user) {
      void preferenceStorage.getItem(PENDING_INVITE_STORAGE_KEY).then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw) as { kind?: string; code?: string };
          if (saved.kind === 'duel') setArenaTab('duel_1v1');
          else if (saved.code) {
            setArenaTab('rooms');
            setCode(saved.code);
          }
        } catch {
          // Ignore malformed invite cache
        }
        void preferenceStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
      });
    }
  }, [params.code, params.invite, user]);

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
          const myState = next.players.find((p) => p.userId === user?.id);
          if (myState?.forfeited || myState?.connectionState === 'forfeited') {
            setConnectionBanner('forfeited');
          } else if (myState?.connectionState === 'reconnecting') {
            setConnectionBanner('reconnecting');
          } else {
            setConnectionBanner('connected');
          }
          setError('');
        }
      } catch (e) {
        if (active) {
          setConnectionBanner('reconnecting');
          setError(errorMessage(e, t.battle.reconnecting));
        }
      } finally {
        fetching = false;
      }
    };

    const heartbeat = () => {
      void dependencies.battle
        .heartbeat(roomId)
        .then(refresh)
        .catch((err) => {
          if (!active) return;
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('seat_forfeited')) {
            setConnectionBanner('forfeited');
            setError('Hết thời gian giữ chỗ 30 giây — bạn đã bị tính bỏ cuộc trong trận này.');
          } else {
            setConnectionBanner('reconnecting');
            setError(t.battle.lostConnection);
          }
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

  useEffect(() => {
    if (battle?.phase === 'finished') {
      useStreakStore.getState().recordActivity('battle');
    }
  }, [battle?.phase]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const enter = async (id: string) => {
    await dependencies.battleSession.save(roomOwner, id);
    setRoomId(id);
  };

  const leave = async () => {
    if (roomId) await dependencies.battle.leave(roomId);
    await dependencies.battleSession.clear(roomOwner);
    setRoomId(null);
    setBattle(null);
  };

  const me = battle?.players.find((p) => p.userId === user?.id);
  const question = battle?.question;

  const enrichedSets = useMemo(() => {
    const sourcePool = localQuestionSets.length > 0 ? localQuestionSets : seedQuestionSets;
    return sets.map((s) => {
      const matched = sourcePool.find((loc) => loc.id === s.id || loc.title === s.title);
      const subj = matched?.subject || 'Đại học';
      const qCount = matched?.questions.length ?? 10;
      const isSeed = String(matched?.id || s.id).startsWith('seed-');
      const hay = `${s.title} ${subj}`.toLowerCase();
      let cat: 'it' | 'stem' | 'humanities' | 'mine' = 'it';
      if (!isSeed) cat = 'mine';
      else if (/(vật lý|hóa|sinh|toán|lượng tử|di truyền)/i.test(hay)) cat = 'stem';
      else if (/(lịch sử|văn học|sử|triết|văn)/i.test(hay)) cat = 'humanities';
      return { ...s, subject: subj, qCount, cat, isSeed };
    });
  }, [localQuestionSets, sets]);

  const filteredBattleSets = useMemo(() => {
    const q = setSearchQuery.trim().toLowerCase();
    return enrichedSets.filter((item) => {
      if (setCategoryFilter !== 'all' && item.cat !== setCategoryFilter) return false;
      if (q && !`${item.title} ${item.subject}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enrichedSets, setCategoryFilter, setSearchQuery]);

  const inActiveMatch = Boolean(roomId || turnPvpActive);

  const arenaBody = (
    <>
        {/* Connection & 30s Seat-Hold Status Banner */}
        {roomId && connectionBanner !== 'connected' && (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: connectionBanner === 'forfeited' ? palette.dangerTint : '#FEF3C7',
                borderColor: connectionBanner === 'forfeited' ? palette.danger : '#F59E0B',
              },
            ]}
          >
            <Ionicons
              name={connectionBanner === 'forfeited' ? 'close-circle' : 'wifi-outline'}
              size={18}
              color={connectionBanner === 'forfeited' ? palette.danger : '#D97706'}
            />
            <Text
              style={[
                typography.caption,
                { color: connectionBanner === 'forfeited' ? palette.danger : '#92400E', flex: 1, fontWeight: '700' },
              ]}
            >
              {connectionBanner === 'forfeited'
                ? '🔴 Hết quyền giữ chỗ 30 giây — Trận đấu đã ghi nhận bỏ cuộc.'
                : '🟡 Mất kết nối — Đang nối lại (Server giữ chỗ tối đa 30 giây)...'}
            </Text>
          </View>
        )}

        {/* Error Banner */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: palette.dangerTint, borderColor: palette.danger }]}>
            <Ionicons name="alert-circle" size={18} color={palette.danger} />
            <Text style={[typography.caption, { color: palette.danger, flex: 1 }]}>{error}</Text>
          </View>
        )}

        {/* Segmented Arena Switcher (Rooms, 1v1 ELO, Arcade 3D — clean labels, zero ellipsis on 375px) */}
        {!roomId && !turnPvpActive && (
          <View style={[styles.arenaTabs, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: arenaTab === 'rooms' }}
              onPress={() => setArenaTab('rooms')}
              style={[styles.arenaTabBtn, arenaTab === 'rooms' && { backgroundColor: palette.indigo }]}
            >
              <Ionicons name="people-outline" size={14} color={arenaTab === 'rooms' ? palette.onPrimary : palette.inkMuted} />
              <Text style={[typography.caption, { color: arenaTab === 'rooms' ? palette.onPrimary : palette.inkMuted, fontWeight: '800' }]} numberOfLines={1}>
                {language === 'vi' ? 'Phòng nhóm' : 'Rooms'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: arenaTab === 'duel_1v1' }}
              onPress={() => setArenaTab('duel_1v1')}
              style={[styles.arenaTabBtn, arenaTab === 'duel_1v1' && { backgroundColor: palette.indigo }]}
            >
              <Ionicons name="trophy-outline" size={14} color={arenaTab === 'duel_1v1' ? palette.onPrimary : palette.inkMuted} />
              <Text style={[typography.caption, { color: arenaTab === 'duel_1v1' ? palette.onPrimary : palette.inkMuted, fontWeight: '800' }]} numberOfLines={1}>
                {language === 'vi' ? '1v1 ELO' : '1v1 ELO'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: arenaTab === 'arcade' }}
              onPress={() => setArenaTab('arcade')}
              style={[styles.arenaTabBtn, arenaTab === 'arcade' && { backgroundColor: palette.indigo }]}
            >
              <Ionicons name="cube-outline" size={14} color={arenaTab === 'arcade' ? palette.onPrimary : palette.inkMuted} />
              <Text style={[typography.caption, { color: arenaTab === 'arcade' ? palette.onPrimary : palette.inkMuted, fontWeight: '800' }]} numberOfLines={1}>
                {language === 'vi' ? 'Arcade 3D' : '3D Modes'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Dedicated 3D & Non-Quiz Arcade Modes Hub (Clean IconTile, zero duplicate emojis) */}
        {!roomId && !turnPvpActive && arenaTab === 'arcade' ? (
          <View style={styles.lobbySections}>
            <Card onPress={() => router.push('/games/archer')} style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="flame" tint="fire" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Badge tone="fire">BẮN CUNG 3D</Badge>
                  <Text style={[typography.title, { color: palette.ink, marginTop: 4 }]}>
                    Cung Thủ Diệt Thiên Thạch 3D
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={2}>
                    Ngắm bắn tên lửa Phượng Hoàng hoặc gõ cổ ngữ hạ thiên thạch bay theo khái niệm đúng.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
              </View>
            </Card>

            <Card onPress={() => router.push('/games/alchemy')} style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="flask-outline" tint="success" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Badge tone="success">PHÂN LOẠI 3D</Badge>
                  <Text style={[typography.title, { color: palette.ink, marginTop: 4 }]}>
                    Giả Kim Thuật Phân Loại 3D
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={2}>
                    Ném tinh thể kiến thức vào đúng 3 lò giả kim 3D để tích chuỗi Combo.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
              </View>
            </Card>

            <Card onPress={() => router.push('/games/survival')} style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="skull-outline" tint="danger" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title, { color: palette.ink }]}>{t.survival.title}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                    Đứng trực diện trên sàn đấu 3D: trả lời đúng bắn tên lửa hạ Golem, sai bị Golem hất đá chôn vùi!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
              </View>
            </Card>

            <Card onPress={() => router.push('/games/match')} style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="extension-puzzle-outline" tint="reward" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title, { color: palette.ink }]}>{t.home.featMatchTitle}</Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                    {language === 'vi'
                      ? 'Ghép cặp câu hỏi & đáp án trong Thư viện Cổ 3D để ghi nhớ sâu.'
                      : 'Pair questions and answers inside the 3D Grand Archives.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
              </View>
            </Card>

            <Card onPress={() => setTurnPvpActive(true)} style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconTile icon="swap-horizontal-outline" tint="primary" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.title, { color: palette.ink }]}>
                    {language === 'vi' ? 'PvP Theo lượt (Luyện nhanh)' : 'Turn-Based PvP Arena'}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                    {language === 'vi'
                      ? 'Đấu nhanh 4 người theo lượt với AI đối thủ, chơi ngay cả khi chưa tạo phòng.'
                      : 'Quick 4-player turn-based showdown ready anytime.'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
              </View>
            </Card>
          </View>
        ) : null}

        {/* 1v1 Ranked Matchmaking & Unrated Friend Duel */}
        {!roomId && !turnPvpActive && arenaTab === 'duel_1v1' ? (
          <RankedDuelArena
            playerName={user?.displayName || 'Bạn'}
            onMatchFinished={(score, isWin) => {
              recordGameResult(score, isWin);
              if (isWin) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);
              }
            }}
          />
        ) : null}

        {/* Turn-Based PvP Mode Active */}
        {turnPvpActive ? (
          <TurnPvpArena
            playerName={user?.displayName || 'Bạn'}
            secondsPerQuestion={secondsPerQuestion}
            totalRounds={Math.min(Math.max(3, questionCount), 8)}
            maxPlayers={maxPlayers}
            onFinish={(score, isWin) => {
              recordGameResult(score, isWin);
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 3000);
            }}
            onExit={() => setTurnPvpActive(false)}
          />
        ) : null}

        {/* Unified Smart Room PIN Hub (Streamlined PIN + QR Row + Clear Disabled State) */}
        {!turnPvpActive && arenaTab === 'rooms' && !roomId && (
          <View style={styles.lobbySections}>
            <Card style={[styles.cardSection, { borderColor: palette.indigoBorder, borderWidth: 1.5 }]}>
              <Badge tone="primary">CHƠI NGAY · MÃ PIN 6 KÝ TỰ & QR</Badge>
              <Text style={[typography.title, { color: palette.ink, marginTop: 8 }]}>
                Tham gia Phòng Đấu
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                Nhập mã PIN hoặc quét QR để vào ngay phòng Kahoot Live hoặc Colosseum ELO.
              </Text>

              <View style={styles.pinEntryRow}>
                <TextInput
                  accessibilityLabel="Room code"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={6}
                  placeholder={t.battle.pinPlaceholder}
                  placeholderTextColor={palette.inkMuted}
                  style={[
                    styles.pinInput,
                    { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                  ]}
                />
                <ScanRoomQr onCode={setCode} compact />
              </View>

              <Button
                icon="flash"
                variant={busy || code.trim().length < 4 ? 'ghost' : 'reward'}
                disabled={busy || code.trim().length < 4}
                onPress={() => {
                  const cleanPin = code.trim().toUpperCase();
                  if (user && /^[A-Z0-9]{6}$/.test(cleanPin)) {
                    void run(async () => {
                      try {
                        const room = await dependencies.rooms.join(cleanPin);
                        await enter(room.id);
                      } catch {
                        router.push({
                          pathname: '/multiplayer/join',
                          params: { room: cleanPin },
                        });
                      }
                    });
                    return;
                  }
                  router.push({
                    pathname: '/multiplayer/join',
                    params: { room: cleanPin },
                  });
                }}
                fullWidth
              >
                Vào phòng đấu
              </Button>

              <View style={{ borderTopWidth: 1, borderTopColor: palette.paperMuted, marginTop: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <Text style={[typography.caption, { color: palette.inkMuted, flex: 1, minWidth: 150 }]}>
                  Mở phòng phát mã PIN/QR cho bạn học?
                </Text>
                <Button
                  variant="secondary"
                  icon="megaphone-outline"
                  onPress={async () => {
                    const sourcePool = localQuestionSets.length > 0 ? localQuestionSets : seedQuestionSets;
                    const firstSet = sourcePool[0];
                    if (!firstSet) return;
                    const created = await roomApi.create(firstSet.id, user?.displayName || 'Chủ phòng');
                    router.push({ pathname: '/multiplayer/host/[roomCode]', params: { roomCode: created.roomCode } });
                  }}
                >
                  Mở Kahoot 1 Chạm
                </Button>
              </View>
            </Card>

            {!user ? (
              <Card style={styles.guestCloudCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile icon="lock-closed-outline" tint="primary" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.title, { color: palette.ink }]}>
                      Phòng Colosseum Cloud (2–12 người)
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      Đăng nhập để lưu lịch sử trận đấu & bảng điểm ELO.
                    </Text>
                  </View>
                </View>
                <Button icon="log-in-outline" onPress={() => router.push('/auth')} fullWidth>
                  {language === 'vi' ? 'Đăng nhập tài khoản' : 'Sign in'}
                </Button>
              </Card>
            ) : (
              /* Create Cloud Colosseum Room */
              <Card style={styles.cardSection}>
              <Text style={[typography.title, { color: palette.ink }]}>{t.battle.createRoom}</Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {language === 'vi'
                  ? 'Chọn chế độ đấu và bộ câu hỏi từ đám mây của bạn để làm đề thi:'
                  : 'Select battle mode and synced question set to host a match:'}
              </Text>

              {/* Mode Selector Pill Buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: spacing.md }}>
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
                    numberOfLines={1}
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
                    numberOfLines={1}
                  >
                    {t.survival.modeSpeed}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setRoomMode('turn_pvp')}
                  style={[
                    styles.modePill,
                    {
                      backgroundColor: roomMode === 'turn_pvp' ? palette.goldTint : palette.paper,
                      borderColor: roomMode === 'turn_pvp' ? palette.gold : palette.paperMuted,
                    },
                  ]}
                >
                  <Ionicons name="swap-horizontal" size={16} color={roomMode === 'turn_pvp' ? palette.gold : palette.inkMuted} />
                  <Text
                    style={[
                      typography.caption,
                      {
                        fontWeight: '700',
                        color: roomMode === 'turn_pvp' ? palette.gold : palette.ink,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {language === 'vi' ? 'PvP theo lượt' : 'Turn PvP'}
                  </Text>
                </Pressable>
              </View>

              {/* Structured Match Config: Questions / Time / Max Players (2-10) */}
              <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
                {language === 'vi' ? 'Số câu hỏi' : 'Question count'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 12 }}>
                {[5, 10, 15].map((value) => (
                  <Button key={value} variant={questionCount === value ? 'primary' : 'secondary'} onPress={() => setQuestionCount(value)}>
                    {String(value)}
                  </Button>
                ))}
              </View>

              <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
                {language === 'vi' ? 'Thời gian mỗi câu' : 'Seconds per question'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 12 }}>
                {[10, 15, 30].map((value) => (
                  <Button key={value} variant={secondsPerQuestion === value ? 'primary' : 'secondary'} onPress={() => setSecondsPerQuestion(value)}>
                    {value}s
                  </Button>
                ))}
              </View>

              <View style={[styles.stepperRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
                    {language === 'vi' ? 'Số người chơi tối đa' : 'Max players'}
                  </Text>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>
                    {language === 'vi' ? 'Tùy chỉnh từ 2 đến 10 người' : 'Configurable from 2 to 10 players'}
                  </Text>
                </View>
                <View style={styles.stepperControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Giảm số người tối đa"
                    onPress={() => setMaxPlayers((p) => Math.max(2, p - 1))}
                    disabled={maxPlayers <= 2}
                    style={[styles.stepBtn, { backgroundColor: palette.paperMuted, opacity: maxPlayers <= 2 ? 0.45 : 1 }]}
                  >
                    <Ionicons name="remove" size={18} color={palette.ink} />
                  </Pressable>
                  <Text style={[typography.title, { color: palette.indigo, minWidth: 28, textAlign: 'center' }]}>
                    {maxPlayers}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tăng số người tối đa"
                    onPress={() => setMaxPlayers((p) => Math.min(10, p + 1))}
                    disabled={maxPlayers >= 10}
                    style={[styles.stepBtn, { backgroundColor: palette.paperMuted, opacity: maxPlayers >= 10 ? 0.45 : 1 }]}
                  >
                    <Ionicons name="add" size={18} color={palette.ink} />
                  </Pressable>
                </View>
              </View>

              {roomMode === 'turn_pvp' ? (
                <View style={{ marginTop: spacing.md }}>
                  <Button variant="reward" icon="swap-horizontal" onPress={() => setTurnPvpActive(true)} fullWidth>
                    {language === 'vi' ? 'Bắt đầu PvP chọn chủ đề theo lượt' : 'Start Turn-Based PvP Match'}
                  </Button>
                </View>
              ) : sets.length === 0 ? (
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
                <View style={{ marginTop: spacing.md, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
                      📚 Chọn Bộ Đề Mở Phòng Kahoot hoặc Colosseum ({filteredBattleSets.length})
                    </Text>
                  </View>

                  {/* Search & Structured Category Filter for Kahoot / Colosseum Sets */}
                  <TextInput
                    value={setSearchQuery}
                    onChangeText={setSetSearchQuery}
                    placeholder="Tìm nhanh tên môn hoặc bộ đề..."
                    placeholderTextColor={palette.inkMuted}
                    style={{
                      minHeight: 42,
                      borderWidth: 1,
                      borderColor: palette.paperMuted,
                      backgroundColor: palette.paper,
                      borderRadius: radii.sm,
                      paddingHorizontal: 12,
                      color: palette.ink,
                      fontSize: 13.5,
                    }}
                  />

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(
                      [
                        { id: 'all', label: 'Tất cả bộ đề' },
                        { id: 'it', label: '💻 CNTT & AI' },
                        { id: 'stem', label: '🔬 Lý · Hóa · Sinh' },
                        { id: 'humanities', label: '🏛️ Sử & Văn học' },
                        { id: 'mine', label: '✨ Đề của tôi' },
                      ] as const
                    ).map((cat) => {
                      const active = setCategoryFilter === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => {
                            setSetCategoryFilter(cat.id);
                            setShowAllSets(false);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: radii.pill,
                            borderWidth: 1,
                            backgroundColor: active ? palette.indigo : palette.paper,
                            borderColor: active ? palette.indigo : palette.paperMuted,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: active ? '#FFFFFF' : palette.ink,
                            }}
                          >
                            {cat.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={{ gap: 8 }}>
                    {(showAllSets ? filteredBattleSets : filteredBattleSets.slice(0, 6)).map((set) => (
                      <View
                        key={set.id}
                        style={{
                          padding: 12,
                          borderRadius: radii.md,
                          borderWidth: 1,
                          borderColor: palette.paperMuted,
                          backgroundColor: palette.paper,
                          gap: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[typography.body, { color: palette.ink, fontWeight: '800' }]} numberOfLines={2}>
                              {set.title}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: palette.inkMuted, marginTop: 2 }}>
                              {set.subject} · {set.qCount} câu hỏi
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Pressable
                            disabled={busy}
                            accessibilityRole="button"
                            onPress={async () => {
                              const created = await roomApi.create(set.id, user?.displayName || 'Chủ phòng');
                              router.push({
                                pathname: '/multiplayer/host/[roomCode]',
                                params: { roomCode: created.roomCode },
                              });
                            }}
                            style={{
                              flex: 1,
                              minWidth: 125,
                              minHeight: 40,
                              paddingHorizontal: 12,
                              borderRadius: radii.sm,
                              backgroundColor: palette.goldTint,
                              borderWidth: 1,
                              borderColor: palette.gold,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                            }}
                          >
                            <Ionicons name="flash" size={14} color={palette.gold} />
                            <Text style={{ color: palette.gold, fontWeight: '900', fontSize: 12 }}>Mở Kahoot Live</Text>
                          </Pressable>

                          <Pressable
                            disabled={busy}
                            accessibilityRole="button"
                            onPress={() =>
                              void run(async () => {
                                if (!useMembershipStore.getState().canCreateBattle()) {
                                  Alert.alert(
                                    'Đạt giới hạn tạo phòng hôm nay',
                                    'Học Giả Tập Sự được tạo tối đa 3 phòng đấu/ngày. Bạn có thể nâng cấp lên VIP để tạo phòng không giới hạn!'
                                  );
                                  return;
                                }
                                const sourcePool = localQuestionSets.length > 0 ? localQuestionSets : seedQuestionSets;
                                const fullLocal = sourcePool.find(
                                  (item) => item.id === set.id || item.title === set.title
                                );
                                const cloudSetId = fullLocal
                                  ? await dependencies.battle.ensureCloudSet(fullLocal)
                                  : set.id;
                                const room = await dependencies.rooms.create({
                                  setId: cloudSetId,
                                  questionCount: Math.min(questionCount, fullLocal?.questions.length ?? questionCount),
                                  secondsPerQuestion,
                                  mode: roomMode,
                                  maxPlayers,
                                });
                                useMembershipStore.getState().consumeBattle();
                                await enter(room.id);
                              })
                            }
                            style={{
                              flex: 1,
                              minWidth: 135,
                              minHeight: 40,
                              paddingHorizontal: 12,
                              borderRadius: radii.sm,
                              backgroundColor: palette.indigo,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                            }}
                          >
                            <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
                              Phòng Colosseum ({maxPlayers}P)
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>

                  {filteredBattleSets.length > 6 && (
                    <Pressable
                      onPress={() => setShowAllSets((v) => !v)}
                      style={{ alignSelf: 'center', paddingVertical: 8 }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: palette.indigo }}>
                        {showAllSets
                          ? '▲ Thu gọn danh sách bộ đề'
                          : `▼ Xem thêm ${filteredBattleSets.length - 6} bộ đề khác`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </Card>
            )}
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
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Badge tone="reward">
                  {battle.phase === 'waiting'
                    ? (language === 'vi' ? 'ĐANG CHỜ NGƯỜI CHƠI' : 'WAITING FOR PLAYERS')
                    : battle.phase === 'question_open'
                      ? (language === 'vi' ? 'ĐANG THI ĐẤU' : 'LIVE BATTLE')
                      : (language === 'vi' ? 'KẾT THÚC' : 'FINISHED')}
                </Badge>
                <Badge tone="primary">
                  {battle.players.length}/{battle.maxPlayers ?? maxPlayers} {language === 'vi' ? 'người' : 'players'}
                </Badge>
              </View>

              {/* 3D Colosseum Scholars Arena Display */}
              <View style={styles.arenaScholarsRow}>
                {battle.players.slice(0, 4).map((p, idx) => {
                  let action: 'idle' | 'attack' | 'hurt' | 'victory' = 'idle';
                  if (battle.phase === 'finished') {
                    action = idx === 0 ? 'victory' : 'idle';
                  } else if (battle.answered && p.userId === user?.id) {
                    action = 'attack';
                  } else if (battle.mode === 'survival' && (p.lives ?? 3) < 3) {
                    action = 'hurt';
                  }

                  return (
                    <View key={p.userId} style={styles.scholarContainer}>
                      <CharacterAvatar
                        color={SCHOLAR_COLORS[idx % SCHOLAR_COLORS.length]}
                        name={p.name}
                        action={action}
                        size={48}
                        showName={true}
                        isDisconnected={!p.connected}
                        reconnectCountdown={30}
                        hasGoldenAura={p.userId === user?.id && isVip}
                      />
                      {p.userId === battle.hostId && (
                        <View style={styles.hostCrown}>
                          <Text style={{ fontSize: 11 }}>👑</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {battle.phase === 'waiting' && <InviteQr code={battle.code} />}
              <View style={styles.battleHeroButtons}>
                <Button
                  variant="reward"
                  icon="share-social"
                  onPress={() =>
                    void Share.share({
                      message: `Tham gia phòng thi đấu Papyrus với mã: ${battle.code}\nLink: ${roomInvite(battle.code, Constants.expoConfig?.scheme)}`,
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Badge tone="primary">
                      {language === 'vi' ? `CÂU ${question.position + 1}` : `Q ${question.position + 1}`}
                    </Badge>
                    {remainingSeconds !== null && <Badge tone={remainingSeconds <= 5 ? "danger" : "neutral"}>{remainingSeconds}s</Badge>}
                    {battle.answered && (
                      <Badge tone="success">
                        {language === 'vi' ? 'ĐÃ TRẢ LỜI' : 'ANSWERED'}
                      </Badge>
                    )}
                  </View>
                  <ReportQuestionButton
                    questionKey={`battle-${battle.id}-${question.position}`}
                    questionContent={question.content}
                  />
                </View>

                <Text style={[typography.heading, { color: palette.ink, marginVertical: spacing.md }]}>
                  {question.content}
                </Text>

                {question.codeSnippet ? (
                  <View style={[styles.codeBlock, { backgroundColor: palette.ink === '#0F172A' ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={[styles.codeText, { color: palette.ink === '#0F172A' ? '#94A3B8' : '#334155' }]}>
                      {question.codeSnippet}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.battleOptions}>
                  {question.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={battle.answered ? (question.correctIndex === index ? 'success' : 'ghost') : 'secondary'}
                      disabled={busy || battle.answered || remainingSeconds === 0 || battle.phase !== 'question_open'}
                      onPress={() =>
                        void run(async () => {
                          sfx.playSpellCast();
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
                    <View style={{ marginRight: 8 }}>
                      <CharacterAvatar
                        color={SCHOLAR_COLORS[i % SCHOLAR_COLORS.length]}
                        name={p.name}
                        action={battle.phase === 'finished' && i === 0 ? 'victory' : 'idle'}
                        size={36}
                        showName={false}
                        isDisconnected={!p.connected}
                        hasGoldenAura={p.userId === user?.id && isVip}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: palette.ink, fontWeight: '700' }]}>
                        {p.name} {p.userId === battle.hostId && (language === 'vi' ? '(Chủ phòng)' : '(Host)')} {p.userId === user?.id && (language === 'vi' ? (isVip ? '(Bạn 👑 VIP)' : '(Bạn)') : (isVip ? '(You 👑 VIP)' : '(You)'))}
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

            {battle.phase === 'finished' && (
              <LiveReactionsBar label={language === 'vi' ? 'Gửi biểu cảm mừng chung cuộc 🎉' : 'Send end-of-match reactions 🎉'} />
            )}
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
    </>
  );

  return (
    <Screen bottomNav>
      <TopBar title={t.battle.title} />
      {inActiveMatch ? (
        <GameEnvironment gameMode="battle" enable3DToggle={false}>
          {arenaBody}
        </GameEnvironment>
      ) : (
        <View style={styles.lobbyBody}>{arenaBody}</View>
      )}
      <ConfettiOverlay visible={showConfetti} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  arenaScholarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginVertical: spacing.md,
    flexWrap: 'wrap',
  },
  scholarContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  hostCrown: {
    position: 'absolute',
    top: -6,
    right: -4,
  },
  header: { paddingTop: spacing.sm, marginBottom: spacing.md },
  headerBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(6, 10, 36, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.25)',
  },
  arenaTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: 4,
  },
  arenaTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  lobbyBody: { gap: spacing.xs },
  guestCloudCard: { padding: spacing.lg, borderRadius: radii.md, gap: spacing.md },
  pinEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: spacing.md,
  },
  lobbySections: { gap: spacing.md, marginBottom: spacing.xl },
  cardSection: { padding: spacing.lg, borderRadius: radii.md },
  modePill: {
    flexGrow: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    paddingHorizontal: spacing.sm,
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
  codeBlock: {
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
});
