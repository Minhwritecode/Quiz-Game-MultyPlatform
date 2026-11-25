import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, TopBar, usePalette } from '@/shared/ui';
import { radii } from '@/core/theme/tokens';
import { useAuthStore } from '@/core/state/useAuthStore';
import { dependencies } from '@/composition/dependencies';
import { FriendsDiscoveryHub } from '@/features/community/presentation/FriendsDiscoveryHub';

export default function FriendsScreen() {
  const router = useRouter();
  const palette = usePalette();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ addFriend?: string }>();

  useEffect(() => {
    if (params.addFriend && user && params.addFriend !== user.id) {
      void dependencies.leaderboard.addFriend(params.addFriend).catch(() => undefined);
    }
  }, [params.addFriend, user]);

  return (
    <Screen bottomNav>
      <TopBar
        title="Tìm Bạn Bè & Kết Nối"
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/leaderboard')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radii.pill,
              backgroundColor: palette.goldTint,
            }}
          >
            <Ionicons name="trophy" size={14} color={palette.gold} />
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.gold }}>Bảng xếp hạng</Text>
          </Pressable>
        }
      />
      <FriendsDiscoveryHub />
    </Screen>
  );
}
