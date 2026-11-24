import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { radii, spacing, typography } from '@/core/theme/tokens';

/**
 * Native developer update banner via expo-updates.
 * Silently checks for OTA updates and surfaces a crisp 1-tap reload bar.
 */
export function AppUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);
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

  if (!updateReady) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Ionicons name="sparkles" size={18} color="#FDE68A" />
        <Text style={[typography.caption, styles.copy]} numberOfLines={2}>
          Nhà phát triển đã có bản cập nhật mới. Vui lòng tải lại ứng dụng!
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 48,
    left: spacing.md,
    right: spacing.md,
    zIndex: 999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: radii.md,
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
