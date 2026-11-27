import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '@/core/theme/tokens';

/**
 * Native developer update banner anchored safely above the Bottom Nav
 * so it NEVER collides with the status bar clock or TopBar.
 */
export function AppUpdateBanner() {
  const insets = useSafeAreaInsets();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let active = true;
    void Updates.checkForUpdateAsync()
      .then(async (res) => {
        if (!active || !res.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (active) setUpdateReady(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!updateReady || dismissed) return null;

  return (
    <View style={[styles.wrap, { bottom: Math.max(76, insets.bottom + 72) }]}>
      <View style={styles.card}>
        <AppIcon name="sparkles" size={18} color="#FDE68A" />
        <Text style={[typography.caption, styles.copy]} numberOfLines={2}>
          Nhà phát triển đã có bản cập nhật mới. Chạm Tải lại ngay!
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={reloading}
          onPress={() => {
            setReloading(true);
            void Updates.reloadAsync().catch(() => setReloading(false));
          }}
          style={styles.reloadBtn}
        >
          <Text style={styles.reloadText}>{reloading ? '...' : 'Tải lại'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={8} onPress={() => setDismissed(true)}>
          <AppIcon name="close" size={16} color="#CBD5E1" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1E1B4B',
    borderWidth: 1.5,
    borderColor: '#818CF8',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  copy: { flex: 1, color: '#F8FAFC', fontWeight: '700' },
  reloadBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  reloadText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
});
