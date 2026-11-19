import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { roomApi } from '@/features/multiplayer/services/room.api';
import { useMultiplayerStore } from '@/features/multiplayer/state/useMultiplayerStore';

export default function JoinRoomScreen() {
  const router = useRouter();
  const palette = usePalette();
  const params = useLocalSearchParams<{ room?: string }>();
  const setPlayerInfo = useMultiplayerStore((state) => state.setPlayerInfo);
  const setCurrentRoom = useMultiplayerStore((state) => state.setCurrentRoom);

  const [roomCode, setRoomCode] = useState((params.room || '').toUpperCase());
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanNick = nickname.trim();

    if (!cleanCode) {
      Alert.alert('Chưa nhập mã', 'Vui lòng nhập mã phòng 6 ký tự.');
      return;
    }
    if (!cleanNick) {
      Alert.alert('Chưa nhập tên', 'Vui lòng nhập biệt danh để người khác nhận ra bạn.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await roomApi.join(cleanCode, cleanNick);
      setPlayerInfo(cleanCode, cleanNick);
      setCurrentRoom(result.room);

      router.push({
        pathname: '/multiplayer/lobby/[roomCode]',
        params: { roomCode: cleanCode, nickname: cleanNick },
      });
    } catch {
      Alert.alert('Lỗi', 'Không tìm thấy phòng hoặc không thể tham gia lúc này.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Tham gia phòng Quiz" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <View style={styles.headerBox}>
          <View style={[styles.iconWrap, { backgroundColor: palette.indigo }]}>
            <Ionicons name="game-controller-outline" size={32} color={palette.white} />
          </View>
          <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.sm }]}>
            Nhập mã phòng trực tiếp
          </Text>
          <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
            Nhập mã phòng được chia sẻ bởi chủ phòng (Host) để cùng thi đấu thời gian thực.
          </Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.inputWrap}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
              MÃ PHÒNG (ROOM CODE)
            </Text>
            <TextInput
              value={roomCode}
              onChangeText={(text) => setRoomCode(text.toUpperCase())}
              placeholder="VD: 8A2F9B"
              placeholderTextColor={palette.inkMuted}
              autoCapitalize="characters"
              maxLength={8}
              style={[
                styles.codeInput,
                { color: palette.indigo, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
              ]}
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700' }]}>
              BIỆT DANH CỦA BẠN (NICKNAME)
            </Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="VD: Phù Thủy Tri Thức..."
              placeholderTextColor={palette.inkMuted}
              maxLength={20}
              style={[
                styles.nickInput,
                { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
              ]}
            />
          </View>

          <View style={styles.joinBtn}>
            <Button
              variant="reward"
              icon="enter-outline"
              onPress={handleJoin}
              disabled={isLoading}
            >
              {isLoading ? 'Đang kết nối vào phòng...' : 'Vào phòng ngay'}
            </Button>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.inkMuted, flex: 1 }]}>
              Không cần đăng nhập! Người chơi chỉ cần mã phòng và biệt danh để tham gia ngay.
            </Text>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingBottom: 40,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: spacing.xl,
    borderRadius: radii.lg,
  },
  inputWrap: {
    marginBottom: spacing.lg,
  },
  codeInput: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  nickInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  joinBtn: {
    marginTop: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
});
