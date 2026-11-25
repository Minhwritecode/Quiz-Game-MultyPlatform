import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/core/theme/tokens';
import {
  acknowledgeWebBuildUpdate,
  checkWebAppVersionUpdate,
  markWebUpdateReloaded,
  wasWebUpdateRecentlyReloaded,
} from '@/composition/platform';

/**
 * Web/PWA live developer update detector anchored safely above the Bottom Dock.
 * Uses session baseline build tracking + reload cooldown so it NEVER loops after reloading.
 */
export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;

    const triggerUpdate = (worker?: ServiceWorker | null) => {
      if (!active || wasWebUpdateRecentlyReloaded()) return;
      if (worker) waitingWorkerRef.current = worker;
      setUpdateAvailable(true);
      setDismissed(false);
    };

    // Prime baseline build ID on startup (returns false on initial call)
    void checkWebAppVersionUpdate();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (!reg || !active) return;
          if (reg.waiting && navigator.serviceWorker.controller && !wasWebUpdateRecentlyReloaded()) {
            triggerUpdate(reg.waiting);
          }
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                triggerUpdate(installing);
              }
            });
          });
          void reg.update().catch(() => undefined);
        })
        .catch(() => undefined);
    }

    const pollVersion = () => {
      void checkWebAppVersionUpdate().then((hasNewer) => {
        if (hasNewer && active) triggerUpdate(null);
      });
    };

    const timer = window.setInterval(pollVersion, 90_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') pollVersion();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleReload = () => {
    markWebUpdateReloaded();
    setDismissed(true);
    setUpdateAvailable(false);

    const worker = waitingWorkerRef.current;
    if (worker && 'serviceWorker' in navigator) {
      let reloaded = false;
      const doReload = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
      worker.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(doReload, 500);
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    acknowledgeWebBuildUpdate();
    setDismissed(true);
    setUpdateAvailable(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconPill}>
          <Ionicons name="rocket" size={16} color="#FDE68A" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.caption, styles.title]} numberOfLines={1}>
            Đã có bản cập nhật mới từ nhà phát triển!
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Chạm Tải lại để nhận tính năng mới nhất ngay.
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleReload} style={styles.reloadBtn}>
          <Ionicons name="refresh" size={13} color="#0F172A" />
          <Text style={styles.reloadText}>Tải lại</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo cập nhật"
          hitSlop={8}
          onPress={handleDismiss}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color="#CBD5E1" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'fixed' as unknown as 'absolute',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)' as unknown as number,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(15, 23, 66, 0.96)',
    borderWidth: 1.5,
    borderColor: '#818CF8',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    boxShadow: '0 12px 32px rgba(6, 10, 36, 0.65)',
  } as object,
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  sub: { color: '#CBD5E1', fontSize: 11, marginTop: 1 },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  reloadText: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  closeBtn: { padding: 4 },
});
