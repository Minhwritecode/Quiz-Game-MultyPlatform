import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { useNotificationStore } from '@/features/notifications/state/useNotificationStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef, type PropsWithChildren, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, palettes, radii, shadows, spacing, typography } from '@/core/theme/tokens';
import { useI18n } from '@/core/i18n';
import { NotificationBell } from '@/features/notifications/presentation/NotificationBell';

export type IconName = keyof typeof Ionicons.glyphMap;

export function usePalette() {
  const system = useColorScheme();
  const theme = usePapyrusStore((state) => state.theme);
  return palettes[(theme === 'system' ? system : theme) === 'dark' ? 'dark' : 'light'];
}

/**
 * Minimal, clean green/red connectivity indicator dot (replaces noisy Offline/Online pills).
 */
export const OnlineStatusDot = memo(function OnlineStatusDot({ size = 9 }: { size?: number }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true
  );
  const pulse = useRef(new Animated.Value(0.35)).current;
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  const palette = usePalette();

  useEffect(() => {
    if (reduceMotion || !online) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.25, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [online, pulse, reduceMotion]);

  const dotColor = online ? palette.mint : palette.danger;
  return (
    <View
      accessibilityLabel={online ? 'Đang kết nối mạng' : 'Mất kết nối mạng'}
      style={{
        width: size + 8,
        height: size + 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          backgroundColor: dotColor,
          opacity: online ? pulse.interpolate({ inputRange: [0.25, 1], outputRange: [0.18, 0.45] }) : 0.25,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dotColor,
        }}
      />
    </View>
  );
});

/**
 * Lightweight GPU-only smooth entrance animation (transform + opacity only, honors reduceMotion).
 */
export const SmoothReveal = memo(function SmoothReveal({
  children,
  delay = 0,
  style,
}: PropsWithChildren<{ delay?: number; style?: ViewStyle | ViewStyle[] }>) {
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      delay,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [delay, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

function navigateWithViewTransition(runNav: () => void, reduceMotion: boolean) {
  if (
    Platform.OS === 'web' &&
    !reduceMotion &&
    typeof document !== 'undefined' &&
    'startViewTransition' in document &&
    typeof (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } })
      .startViewTransition === 'function'
  ) {
    const vt = (
      document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
    ).startViewTransition(() => {
      runNav();
    });
    vt.finished.finally(() => {
      const mainHeading = document.getElementById('papyrus-route-focus');
      mainHeading?.focus?.({ preventScroll: true });
    });
    return;
  }
  runNav();
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    requestAnimationFrame(() => {
      document.getElementById('papyrus-route-focus')?.focus?.({ preventScroll: true });
    });
  }
}

export function Screen({
  children,
  scroll = true,
  bottomNav = false,
  transparent = false,
  maxWidth: maxWidthProp,
  scrollResetKey,
  contentStyle,
  onPullRefresh,
}: PropsWithChildren<{
  scroll?: boolean;
  bottomNav?: boolean;
  transparent?: boolean;
  maxWidth?: number;
  scrollResetKey?: string | number;
  contentStyle?: object;
  onPullRefresh?: () => Promise<void> | void;
}>) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && width >= 900;
  const maxWidth = maxWidthProp ?? (width >= 900 ? 1160 : 760);
  const bottomBarHeight = 62 + Math.max(6, insets.bottom);

  const [refreshing, setRefreshing] = useState(false);
  const [pullVisible, setPullVisible] = useState(false);
  const pullVisibleRef = useRef(false);
  const pullOffsetRef = useRef(0);
  const pullAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const scrollYRef = useRef(0);
  const startTouchYRef = useRef<number | null>(null);
  const idleDecayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollResetKey === undefined) return;
    scrollYRef.current = 0;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  }, [scrollResetKey]);

  const resetPullVisual = () => {
    startTouchYRef.current = null;
    pullOffsetRef.current = 0;
    pullAnim.setValue(0);
    if (pullVisibleRef.current) {
      pullVisibleRef.current = false;
      setPullVisible(false);
    }
    if (idleDecayTimerRef.current) {
      clearTimeout(idleDecayTimerRef.current);
      idleDecayTimerRef.current = null;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
  };

  const triggerInPlaceRefresh = async () => {
    if (refreshing) return;
    resetPullVisual();
    setRefreshing(true);
    try {
      const uid = useAuthStore.getState().user?.id;
      useStreakStore.getState().refreshStreakStatus();
      useRouteRefreshStore.getState().bumpRouteRefresh();
      await Promise.race([
        Promise.all([
          usePapyrusStore.getState().hydrateCloudProfile().catch(() => undefined),
          uid ? useNotificationStore.getState().syncCloudGifts(uid).catch(() => undefined) : Promise.resolve(),
          Promise.resolve(onPullRefresh?.()).catch(() => undefined),
        ]),
        new Promise<void>((resolve) => setTimeout(resolve, 1400)),
      ]);
    } finally {
      setTimeout(() => setRefreshing(false), 220);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
    if (!scroll) return;
    const handleGlobalRelease = () => {
      const pulled = pullOffsetRef.current;
      if (pulled > 0 || startTouchYRef.current !== null) {
        resetPullVisual();
        if (pulled >= 56) {
          void triggerInPlaceRefresh();
        }
      }
    };
    window.addEventListener('touchend', handleGlobalRelease, { passive: true });
    window.addEventListener('touchcancel', handleGlobalRelease, { passive: true });
    window.addEventListener('pointerup', handleGlobalRelease, { passive: true });
    window.addEventListener('pointercancel', handleGlobalRelease, { passive: true });
    window.addEventListener('blur', handleGlobalRelease);
    return () => {
      window.removeEventListener('touchend', handleGlobalRelease);
      window.removeEventListener('touchcancel', handleGlobalRelease);
      window.removeEventListener('pointerup', handleGlobalRelease);
      window.removeEventListener('pointercancel', handleGlobalRelease);
      window.removeEventListener('blur', handleGlobalRelease);
      if (idleDecayTimerRef.current) clearTimeout(idleDecayTimerRef.current);
    };
  }, [scroll]); // eslint-disable-line react-hooks/exhaustive-deps

  const webTouchHandlers =
    Platform.OS === 'web' && scroll
      ? ({
          onTouchStart: (e: { touches?: Array<{ clientY: number }> }) => {
            if (scrollYRef.current <= 2 && e.touches?.[0]) {
              startTouchYRef.current = e.touches[0].clientY;
            } else {
              resetPullVisual();
            }
          },
          onTouchMove: (e: { touches?: Array<{ clientY: number }> }) => {
            if (startTouchYRef.current === null || scrollYRef.current > 2 || !e.touches?.[0]) {
              if (pullOffsetRef.current > 0) resetPullVisual();
              return;
            }
            const dy = e.touches[0].clientY - startTouchYRef.current;
            if (dy > 16) {
              const next = Math.min(88, Math.round(dy * 0.52));
              pullOffsetRef.current = next;
              pullAnim.setValue(next);
              const shouldShow = next >= 24;
              if (shouldShow !== pullVisibleRef.current) {
                pullVisibleRef.current = shouldShow;
                setPullVisible(shouldShow);
              }
              if (idleDecayTimerRef.current) clearTimeout(idleDecayTimerRef.current);
              idleDecayTimerRef.current = setTimeout(() => {
                resetPullVisual();
              }, 520);
            } else if (pullOffsetRef.current !== 0) {
              resetPullVisual();
            }
          },
          onTouchEnd: () => {
            const pulled = pullOffsetRef.current;
            resetPullVisual();
            if (pulled >= 56) {
              void triggerInPlaceRefresh();
            }
          },
          onTouchCancel: () => {
            resetPullVisual();
          },
        } as object)
      : undefined;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: transparent ? 'transparent' : palette.paper }]}
      edges={['top', 'left', 'right']}
    >
      {bottomNav && desktopWeb && <DesktopNav />}

      {/* Minimalist silent orbital pull indicator (driven by Animated.Value — zero scroll layout shift!) */}
      {(pullVisible || refreshing) && (
        <View pointerEvents="none" style={styles.pullBannerWrap}>
          <Animated.View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: palette.paperRaised,
              borderWidth: 1.5,
              borderColor: palette.indigo,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing
                ? 1
                : pullAnim.interpolate({
                    inputRange: [0, 56, 88],
                    outputRange: [0.25, 1, 1],
                  }),
              transform: [
                {
                  translateY: refreshing
                    ? 10
                    : pullAnim.interpolate({
                        inputRange: [0, 88],
                        outputRange: [0, 18],
                      }),
                },
                {
                  rotate: refreshing
                    ? '0deg'
                    : pullAnim.interpolate({
                        inputRange: [0, 88],
                        outputRange: ['0deg', '320deg'],
                      }),
                },
              ],
            }}
          >
            <Ionicons name="sync" size={16} color={palette.indigo} />
          </Animated.View>
        </View>
      )}

      {scroll ? (
        <ScrollView
          ref={scrollViewRef}
          {...webTouchHandlers}
          style={[
            styles.scrollViewport,
            Platform.OS === 'web'
              ? ({ overscrollBehaviorY: 'contain' } as unknown as ViewStyle)
              : undefined,
          ]}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            scrollYRef.current = y;
            if (y > 4 && pullOffsetRef.current > 0) {
              resetPullVisual();
            }
          }}
          refreshControl={
            Platform.OS === 'web' ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void triggerInPlaceRefresh()}
                tintColor={palette.indigo}
                colors={[palette.indigo]}
              />
            )
          }
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: bottomNav && !desktopWeb ? bottomBarHeight + spacing.xl : spacing.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View
            nativeID="papyrus-route-focus"
            style={[styles.content, { maxWidth }, contentStyle]}
          >
            {children}
          </View>
          {bottomNav && desktopWeb && <AppFooter />}
        </ScrollView>
      ) : (
        <View
          nativeID="papyrus-route-focus"
          style={[
            styles.content,
            styles.nonScrollContent,
            {
              maxWidth,
              paddingBottom: bottomNav && !desktopWeb ? bottomBarHeight : 0,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
      {bottomNav && !desktopWeb && <BottomNav />}
    </SafeAreaView>
  );
}

export const TopBar = memo(function TopBar({
  title,
  subtitle,
  onBack,
  action,
  right,
  lightContent = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
  right?: ReactNode;
  lightContent?: boolean;
}) {
  const palette = usePalette();
  const router = useRouter();
  const hapticsEnabled = usePapyrusStore((s) => s.haptics);
  const fg = lightContent ? '#F3EFE0' : palette.ink;
  const surfaceBg = lightContent ? 'rgba(18, 21, 31, 0.88)' : palette.paperRaised;
  const borderCol = lightContent ? 'rgba(123, 164, 255, 0.32)' : palette.paperMuted;
  const backBg = lightContent ? 'rgba(28, 63, 148, 0.34)' : palette.indigoTint;
  const backBorder = lightContent ? 'rgba(123, 164, 255, 0.42)' : palette.indigoBorder;

  const handleBack = () => {
    if (hapticsEnabled && Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => undefined);
    }
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <View
      style={[
        styles.topBar,
        shadows.card,
        {
          backgroundColor: surfaceBg,
          borderColor: borderCol,
        },
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            } as unknown as ViewStyle)
          : undefined,
      ]}
    >
      <Pressable
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={handleBack}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.iconButton,
          {
            backgroundColor: hovered || pressed ? palette.indigo : backBg,
            borderColor: backBorder,
            borderWidth: 1,
            transform: pressed ? [{ scale: 0.93 }] : undefined,
          },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined,
        ]}
      >
        {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => (
          <Ionicons
            name="arrow-back"
            size={20}
            color={hovered || pressed ? palette.onPrimary : lightContent ? '#F3EFE0' : palette.indigoDeep}
          />
        )}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typography.title, { color: fg, fontWeight: '800' }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 11,
              color: lightContent ? 'rgba(224,231,255,0.78)' : palette.inkMuted,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.topAction}>{right ?? action ?? <OnlineStatusDot />}</View>
    </View>
  );
});

export const BrandMark = memo(function BrandMark({ size = 46 }: { size?: number }) {
  const iconSize = Math.round(size * 0.5);
  const badgeSize = Math.max(12, Math.round(size * 0.28));
  return (
    <View
      style={[
        styles.brandMark,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.26),
          backgroundColor: '#1C3F94',
          borderWidth: 1,
          borderColor: 'rgba(228, 220, 198, 0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        },
      ]}
    >
      <Ionicons name="bookmarks" size={iconSize} color="#FFFDF8" />
      <View
        style={{
          position: 'absolute',
          top: Math.round(size * 0.11),
          right: Math.round(size * 0.11),
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          backgroundColor: '#D98A1E',
          borderWidth: 1.5,
          borderColor: '#1C3F94',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name="sparkles" size={Math.round(badgeSize * 0.56)} color="#FFFDF8" />
      </View>
    </View>
  );
});

export function Eyebrow({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.xs }]}>{children}</Text>;
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const palette = usePalette();
  return (
    <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Text style={[typography.display, { color: palette.ink }]}>{title}</Text>
      {subtitle && (
        <Text style={[typography.body, { color: palette.inkMuted, marginTop: spacing.sm, maxWidth: 640 }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const OUTER_CARD_STYLE_KEYS = new Set([
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'alignSelf',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
]);

function splitCardPressStyles(rawStyle: StyleProp<ViewStyle> | object | undefined): {
  outerStyle: ViewStyle | undefined;
  innerStyle: ViewStyle | undefined;
} {
  const flat = StyleSheet.flatten(rawStyle as StyleProp<ViewStyle>) as ViewStyle | undefined;
  if (!flat) return { outerStyle: undefined, innerStyle: undefined };

  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue;
    if (OUTER_CARD_STYLE_KEYS.has(key)) outer[key] = value;
    else inner[key] = value;
  }

  return {
    outerStyle: Object.keys(outer).length > 0 ? (outer as ViewStyle) : undefined,
    innerStyle: Object.keys(inner).length > 0 ? (inner as ViewStyle) : undefined,
  };
}

export function Card({
  children,
  style,
  containerStyle,
  color,
  onPress,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle> | object;
  containerStyle?: StyleProp<ViewStyle>;
  color?: string;
  onPress?: () => void;
}>) {
  const palette = usePalette();
  const baseVisual = [
    styles.card,
    shadows.card,
    { backgroundColor: color ?? palette.paperRaised, borderColor: palette.paperMuted },
  ];

  if (!onPress) {
    return <View style={[...baseVisual, containerStyle, style as StyleProp<ViewStyle>]}>{children}</View>;
  }

  const { outerStyle, innerStyle } = splitCardPressStyles(style);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          borderRadius: radii.md,
          transform: pressed ? [{ scale: 0.985 }] : hovered ? [{ translateY: -2 }] : undefined,
          opacity: pressed ? 0.92 : 1,
        },
        outerStyle,
        containerStyle,
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined,
      ]}
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <View
          style={[
            ...baseVisual,
            { flexGrow: 1 },
            innerStyle,
            hovered ? { borderColor: palette.indigoBorder } : undefined,
          ]}
        >
          {children}
        </View>
      )}
    </Pressable>
  );
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = false,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'reward';
  size?: 'sm' | 'md';
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
}) {
  const palette = usePalette();
  const configs = {
    primary: { bg: palette.indigo, border: palette.indigo, fg: palette.onPrimary, bbWidth: 2 },
    secondary: { bg: palette.indigoTint, border: palette.indigoBorder, fg: palette.indigoDeep, bbWidth: 1 },
    success: { bg: palette.mint, border: palette.mint, fg: palette.onMint, bbWidth: 2 },
    reward: { bg: palette.gold, border: palette.gold, fg: palette.onGold, bbWidth: 2 },
    danger: { bg: palette.dangerTint, border: palette.dangerBorder, fg: palette.danger, bbWidth: 1 },
    ghost: { bg: 'transparent', border: palette.paperMuted, fg: palette.ink, bbWidth: 1 },
  };
  const cfg = configs[variant] ?? configs.primary;
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      accessibilityState={{ disabled }}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        size === 'sm' ? { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12 } : undefined,
        {
          backgroundColor: cfg.bg,
          borderColor: hovered && !disabled ? palette.indigo : cfg.border,
          borderBottomWidth: cfg.bbWidth,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.45 : pressed ? 0.86 : hovered ? 0.95 : 1,
          transform:
            !reduceMotion && !disabled
              ? pressed
                ? [{ translateY: 1 }, { scale: 0.99 }]
                : hovered
                ? [{ translateY: -1 }]
                : undefined
              : undefined,
        },
        Platform.OS === 'web' && !disabled ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined,
      ]}
    >
      {icon && <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={cfg.fg} />}
      <Text
        style={[
          typography.body,
          { color: cfg.fg, fontWeight: '800', fontSize: size === 'sm' ? 12.5 : undefined },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export const ProgressBar = memo(function ProgressBar({
  progress,
  tone = 'primary',
}: {
  progress: number;
  tone?: 'primary' | 'success' | 'fire' | 'reward';
}) {
  const palette = usePalette();
  const fillColors = {
    primary: palette.indigo,
    success: palette.mint,
    fire: palette.fire,
    reward: palette.gold,
  };
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.progressTrack, { backgroundColor: palette.paperMuted }]}
    >
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fillColors[tone] }]} />
    </View>
  );
});

export const Badge = memo(function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'reward' | 'danger' | 'primary' | 'fire';
}) {
  const palette = usePalette();
  const bg = {
    neutral: palette.paperMuted,
    success: palette.mintTint,
    reward: palette.goldTint,
    danger: palette.dangerTint,
    primary: palette.indigoTint,
    fire: palette.fireTint,
  }[tone];
  const fg = {
    neutral: palette.inkMuted,
    success: palette.mint,
    reward: palette.gold,
    danger: palette.danger,
    primary: palette.indigoDeep,
    fire: palette.fire,
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[typography.label, { color: fg, fontSize: 11 }]}>{children}</Text>
    </View>
  );
});

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[typography.title, { color: palette.ink }]}>{title}</Text>
      {action && (
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
            opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
          })}
        >
          <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const StatCard = memo(function StatCard({
  value,
  label,
  icon,
  tone = 'primary',
}: {
  value: string;
  label: string;
  icon: IconName;
  tone?: 'primary' | 'success' | 'reward' | 'fire';
}) {
  const palette = usePalette();
  const toneColor = {
    primary: palette.indigo,
    success: palette.mint,
    reward: palette.gold,
    fire: palette.fire,
  }[tone];
  return (
    <Card style={styles.statCard}>
      <Ionicons name={icon} size={22} color={toneColor} />
      <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.sm, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
});

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  message,
}: {
  icon: IconName;
  title: string;
  message: string;
}) {
  const palette = usePalette();
  return (
    <Card style={styles.emptyState}>
      <Ionicons name={icon} size={34} color={palette.indigo} />
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: palette.inkMuted, textAlign: 'center', marginTop: spacing.sm }]}>
        {message}
      </Text>
    </Card>
  );
});

export const BottomNav = memo(function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const items = useMemo<
    Array<{
      route: '/' | '/sets' | '/community' | '/battle' | '/leaderboard' | '/settings';
      label: string;
      icon: IconName;
    }>
  >(
    () => [
      { route: '/', label: t.nav.home, icon: 'home-outline' },
      { route: '/sets', label: t.nav.library, icon: 'library-outline' },
      { route: '/community', label: t.nav.community, icon: 'people-circle-outline' },
      { route: '/battle', label: t.nav.battle, icon: 'game-controller-outline' },
      { route: '/leaderboard', label: t.nav.rank, icon: 'trophy-outline' },
      { route: '/settings', label: t.nav.settings, icon: 'settings-outline' },
    ],
    [t.nav.home, t.nav.library, t.nav.community, t.nav.battle, t.nav.rank, t.nav.settings]
  );

  const hapticsEnabled = usePapyrusStore((s) => s.haptics);
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);

  const webDockStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 80,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'max(4px, env(safe-area-inset-bottom))',
        } as unknown as ViewStyle)
      : undefined;

  return (
    <View
      style={[
        styles.bottomNav,
        {
          backgroundColor: palette.paperRaised,
          borderTopColor: palette.paperMuted,
          paddingBottom: Platform.OS === 'web' ? 4 : Math.max(4, insets.bottom),
        },
        webDockStyle,
      ]}
    >
      {items.map((item) => {
        const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
        return (
          <Pressable
            key={item.route}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            {...(Platform.OS === 'web' && active ? ({ 'aria-current': 'page' } as object) : {})}
            onPress={() => {
              if (active) return;
              if (hapticsEnabled && Platform.OS !== 'web') {
                void Haptics.selectionAsync().catch(() => undefined);
              }
              navigateWithViewTransition(() => router.replace(item.route), reduceMotion);
            }}
            style={({ pressed }) => [
              styles.navItem,
              active ? { backgroundColor: palette.indigoTint } : undefined,
              pressed ? { opacity: 0.78, transform: [{ scale: 0.96 }] } : undefined,
            ]}
          >
            {active ? <View style={[styles.navActiveBar, { backgroundColor: palette.indigo }]} /> : null}
            <Ionicons
              name={active ? (item.icon.replace('-outline', '') as IconName) : item.icon}
              size={21}
              color={active ? palette.indigo : palette.inkMuted}
            />
            <Text
              numberOfLines={1}
              style={[
                typography.label,
                {
                  fontSize: 10,
                  color: active ? palette.indigo : palette.inkMuted,
                  marginTop: 2,
                  letterSpacing: 0.2,
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export const DesktopNav = memo(function DesktopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const palette = usePalette();
  const { language, toggleLanguage, t } = useI18n();
  const openAssistant = useAssistantUiStore((s) => s.openAssistant);

  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const items = useMemo<
    Array<{ route: '/' | '/sets' | '/community' | '/battle' | '/leaderboard'; label: string }>
  >(
    () => [
      { route: '/', label: t.nav.home },
      { route: '/sets', label: t.nav.library },
      { route: '/community', label: t.nav.community },
      { route: '/battle', label: t.nav.battle },
      { route: '/leaderboard', label: t.nav.rank },
    ],
    [t.nav.home, t.nav.library, t.nav.community, t.nav.battle, t.nav.rank]
  );

  return (
    <View style={[styles.desktopNavShell, { borderBottomColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
      <View style={styles.desktopNav}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Papyrus home"
          onPress={() => router.replace('/')}
          style={styles.desktopBrand}
        >
          <BrandMark size={38} />
          <View>
            <Text style={[typography.title, { color: palette.ink }]}>Papyrus</Text>
            <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11 }]}>
              From Ancient Scroll to AI Power
            </Text>
          </View>
        </Pressable>

        <View style={styles.desktopNavLinks}>
          {items.map((item) => {
            const active = item.route === '/' ? pathname === '/' : pathname.startsWith(item.route);
            return (
              <Pressable
                key={item.route}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                {...(Platform.OS === 'web' && active ? ({ 'aria-current': 'page' } as object) : {})}
                onPress={() => {
                  if (active) return;
                  navigateWithViewTransition(() => router.replace(item.route), reduceMotion);
                }}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.desktopNavLink,
                  active && { backgroundColor: palette.indigoTint },
                  !active && hovered && { backgroundColor: palette.paperMuted },
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: active ? palette.indigoDeep : palette.inkMuted, fontWeight: active ? '800' : '700' },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.desktopNavActions}>
          <OnlineStatusDot />
          <NotificationBell />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Papybot AI"
            onPress={() => openAssistant()}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.desktopSettings,
              {
                borderColor: hovered ? palette.indigo : palette.paperMuted,
                backgroundColor: hovered ? palette.indigoTint : 'transparent',
              },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={19} color={palette.indigo} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch language"
            onPress={toggleLanguage}
            style={[styles.desktopSettings, { borderColor: palette.paperMuted }]}
          >
            <Text style={[typography.label, { color: palette.indigo, fontSize: 11 }]}>
              {language === 'vi' ? 'VI' : 'EN'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={language === 'vi' ? 'Hồ sơ' : 'Profile'}
            onPress={() => router.push('/profile')}
            style={[styles.desktopSettings, { borderColor: palette.paperMuted }]}
          >
            <Ionicons name="person-outline" size={19} color={palette.inkMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t.nav.settings}
            onPress={() => router.replace('/settings')}
            style={[styles.desktopSettings, { borderColor: palette.paperMuted }]}
          >
            <Ionicons name="settings-outline" size={19} color={palette.inkMuted} />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/create/scan')}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.desktopCta,
              { backgroundColor: palette.indigo, opacity: hovered ? 0.92 : 1 },
            ]}
          >
            <Ionicons name="sparkles-outline" size={17} color={palette.onPrimary} />
            <Text style={[typography.caption, { color: palette.onPrimary, fontWeight: '800' }]}>
              {t.home.createAiBtn}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const AppFooter = memo(function AppFooter() {
  const palette = usePalette();
  const router = useRouter();
  const { language } = useI18n();
  return (
    <View style={[styles.footer, { borderTopColor: palette.paperMuted }]}>
      <View style={styles.footerBrand}>
        <BrandMark size={26} />
        <Text style={[typography.caption, { color: palette.inkMuted }]}>
          Papyrus · From Ancient Scroll to AI Power
        </Text>
      </View>
      <View style={styles.footerLinks}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {language === 'vi' ? 'Quyền riêng tư' : 'Privacy'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/sync')}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {language === 'vi' ? 'Đồng bộ' : 'Sync'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/settings')}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            {language === 'vi' ? 'Cài đặt' : 'Settings'}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push('/admin')}>
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            Admin
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export const IconTile = memo(function IconTile({
  icon,
  tint = 'primary',
}: {
  icon: IconName;
  tint?: 'primary' | 'success' | 'reward' | 'danger' | 'fire';
}) {
  const palette = usePalette();
  const bg = {
    primary: palette.indigoTint,
    success: palette.mintTint,
    reward: palette.goldTint,
    danger: palette.dangerTint,
    fire: palette.fireTint,
  }[tint];
  const fg = {
    primary: palette.indigo,
    success: palette.mint,
    reward: palette.gold,
    danger: palette.danger,
    fire: palette.fire,
  }[tint];
  return (
    <View style={[styles.iconTile, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={fg} />
    </View>
  );
});

export const uiColors = { colors, spacing, radii, typography };

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0 },
  scrollViewport: { flex: 1, width: '100%', minHeight: 0 },
  pullBannerWrap: {
    position: 'absolute',
    top: 8,
    left: spacing.md,
    right: spacing.md,
    zIndex: 95,
    alignItems: 'center',
  },
  pullBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  scroll: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  content: { width: '100%' },
  nonScrollContent: { flex: 1, minHeight: 0, alignSelf: 'center', paddingHorizontal: spacing.lg },
  topBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    zIndex: 40,
  },
  topAction: { marginLeft: 'auto', minWidth: 36, alignItems: 'flex-end', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandMark: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.md, borderCurve: 'continuous', borderWidth: 1, padding: spacing.lg },
  button: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  statCard: { flex: 1, minWidth: 140, padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 58,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 5,
    paddingHorizontal: spacing.xs,
  },
  navActiveBar: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  desktopNavShell: { width: '100%', alignItems: 'center', borderBottomWidth: 1 },
  desktopNav: {
    width: '100%',
    maxWidth: 1160,
    minHeight: 70,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  desktopBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  desktopNavLinks: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  desktopNavLink: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopNavActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'flex-end' },
  desktopSettings: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopCta: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  navItem: {
    flex: 1,
    maxWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  iconTile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  progressTrack: { height: 10, borderRadius: radii.pill, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: radii.pill },
  footer: {
    width: '100%',
    maxWidth: 1160,
    marginTop: spacing.xxxl,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footerBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
