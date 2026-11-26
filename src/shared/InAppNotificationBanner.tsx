import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { usePalette } from '@/shared/ui';
import { radii, shadows, spacing, typography } from '@/core/theme/tokens';

/**
 * Non-intrusive Top Drop-Down Toast Banner for incoming messages/notifications
 * when the user is actively viewing another tab/section inside the app (zero sound in-app!).
 */
export const InAppNotificationBanner = memo(function InAppNotificationBanner() {
  const router = useRouter();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const banner = useRouteRefreshStore((s) => s.banner);
  const dismiss = useRouteRefreshStore((s) => s.dismissDropBanner);
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const slideAnim = useRef(new Animated.Value(-96)).current;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!banner) {
      slideAnim.setValue(-96);
      return;
    }
    // Suppress background toast if a native modal <dialog> is currently open
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.querySelector('dialog:modal')) {
      return;
    }

    if (reduceMotion) {
      slideAnim.setValue(0);
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 260,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }

    if (paused) return;
    const timer = setTimeout(() => {
      dismiss();
    }, 4400);
    return () => clearTimeout(timer);
  }, [banner, dismiss, paused, reduceMotion, slideAnim]);

  return (
    <>
      {/* Pre-populated screen-reader announcement region */}
      <View
        accessible
        accessibilityLiveRegion="polite"
        style={styles.srOnly}
      >
        {banner ? (
          <Text>{`Thông báo mới: ${banner.title}. ${banner.body}`}</Text>
        ) : null}
      </View>

      {banner ? (
        <Animated.View
          accessibilityLabel="Thông báo mới"
          style={[
            styles.wrap,
            {
              top: Math.max(10, insets.top + 8),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.card,
              shadows.card,
              {
                backgroundColor: palette.paperRaised,
                borderColor: palette.indigo,
              },
              Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                  } as unknown as ViewStyle)
                : undefined,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onHoverIn={() => setPaused(true)}
              onHoverOut={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onPress={() => {
                const route = banner.actionRoute;
                const params = banner.actionParams;
                dismiss();
                if (params) {
                  router.push({ pathname: route as '/community', params });
                } else {
                  router.push(route as '/');
                }
              }}
              style={[
                styles.mainTap,
                Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined,
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: palette.indigo }]}>
                <Ionicons
                  name={
                    banner.kind === 'message'
                      ? 'chatbubble-ellipses'
                      : banner.kind === 'gift'
                      ? 'gift'
                      : 'notifications'
                  }
                  size={18}
                  color={palette.onPrimary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.caption, { color: palette.ink, fontWeight: '900' }]} numberOfLines={1}>
                  {banner.title}
                </Text>
                <Text style={{ fontSize: 12, color: palette.inkMuted, marginTop: 1 }} numberOfLines={2}>
                  {banner.body}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo"
              onHoverIn={() => setPaused(true)}
              onHoverOut={() => setPaused(false)}
              onPress={dismiss}
              hitSlop={10}
              style={[
                styles.closeBtn,
                Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined,
              ]}
            >
              <Ionicons name="close" size={18} color={palette.inkMuted} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 950,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  mainTap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
