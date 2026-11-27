import { createElement, memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppIcon } from '@/shared/AppIcon';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

const ASTRAL_MORPH_ICONS: Array<{
  icon: 'sparkles' | 'diamond-outline' | 'book-outline' | 'prism-outline';
  accent: string;
  radius: number;
}> = [
  { icon: 'sparkles', accent: '#818CF8', radius: 20 },
  { icon: 'diamond-outline', accent: '#22D3EE', radius: 28 },
  { icon: 'book-outline', accent: '#A78BFA', radius: 16 },
  { icon: 'prism-outline', accent: '#34D399', radius: 24 },
];

/**
 * 1. PAGE / TAB / NAVIGATION LOADER (`PapyrusMorphLoader`)
 * Strictly used ONLY for route loading & tab transitions (completely separate from network skeletons!).
 * Silky liquid-glass orbital rings + semantic <progress> conic trail on Web + reduced-motion 6s slowdown.
 */
export const PapyrusMorphLoader = memo(function PapyrusMorphLoader({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const palette = usePalette();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [idx, setIdx] = useState(0);
  const outerSpin = useRef(new Animated.Value(0)).current;
  const innerFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((p) => (p + 1) % ASTRAL_MORPH_ICONS.length);
    }, 950);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    outerSpin.setValue(0);
    const useNative = Platform.OS !== 'web';
    const duration = reduceMotion ? 6000 : 1650;
    const spinLoop = Animated.loop(
      Animated.timing(outerSpin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: useNative,
      })
    );
    spinLoop.start();

    if (reduceMotion) {
      innerFloat.setValue(0);
      return () => spinLoop.stop();
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(innerFloat, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
        Animated.timing(innerFloat, {
          toValue: 0,
          duration: 720,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: useNative,
        }),
      ])
    );
    floatLoop.start();

    return () => {
      spinLoop.stop();
      floatLoop.stop();
    };
  }, [innerFloat, outerSpin, reduceMotion]);

  const current = ASTRAL_MORPH_ICONS[idx]!;
  const ringSize = compact ? 52 : 68;
  const coreSize = compact ? 34 : 44;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label || 'Đang chuyển trang'}
      style={[styles.loaderRoot, compact && { paddingVertical: spacing.sm }]}
    >
      <View style={{ width: ringSize + 16, height: ringSize + 16, alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft Ambient Aura */}
        <Animated.View
          style={{
            position: 'absolute',
            width: ringSize + 12,
            height: ringSize + 12,
            borderRadius: (ringSize + 12) / 2,
            backgroundColor: current.accent,
            opacity: innerFloat.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.24] }),
            transform: [
              {
                scale: innerFloat.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }),
              },
            ],
          }}
        />

        {/* Semantic Indeterminate Conic Ring on Web / Smooth Native Orbital Arc */}
        {Platform.OS === 'web' ? (
          createElement('progress', {
            'aria-label': label || 'Đang tải trang',
            className: 'papyrus-spinner',
            style: {
              width: `${ringSize}px`,
              height: `${ringSize}px`,
              position: 'absolute',
            },
          })
        ) : (
          <Animated.View
            style={[
              styles.nativeArcRing,
              {
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderTopColor: current.accent,
                borderRightColor: 'rgba(56, 189, 248, 0.45)',
                borderBottomColor: 'rgba(148, 163, 184, 0.12)',
                borderLeftColor: 'rgba(148, 163, 184, 0.12)',
                transform: [
                  {
                    rotate: outerSpin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
        )}

        {/* Liquid-Glass Morphing Core */}
        <Animated.View
          style={[
            styles.prismCore,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: compact ? Math.round(current.radius * 0.72) : current.radius,
              borderColor: `${current.accent}66`,
              transform: [
                {
                  scale: innerFloat.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] }),
                },
              ],
            },
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  transition: 'border-radius 420ms cubic-bezier(0.22, 1, 0.36, 1), border-color 420ms ease',
                } as unknown as ViewStyle)
              : undefined,
          ]}
        >
          <AppIcon name={current.icon} size={compact ? 17 : 21} color={current.accent} />
        </Animated.View>
      </View>

      {label ? (
        <Text
          style={[
            typography.caption,
            { color: palette.inkMuted, fontWeight: '700', marginTop: 8, textAlign: 'center' },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
});

const WaveSkeletonBar = memo(function WaveSkeletonBar({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const wave = useRef(new Animated.Value(0.32)).current;

  useEffect(() => {
    if (reduceMotion) {
      wave.setValue(0.5);
      return;
    }
    const useNative = Platform.OS !== 'web';
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 0.78, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(wave, { toValue: 0.28, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, wave]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: palette.paperMuted,
          opacity: wave,
        },
        style,
      ]}
    />
  );
});

export type SkeletonVariant = 'study' | 'leaderboard' | 'library' | 'dashboard';

/**
 * 2. WEAK / OFFLINE NETWORK DATA SKELETON (`PapyrusPageSkeleton` / `PapyrusNetworkSkeleton`)
 * Strictly separated from the Page/Tab Loader!
 * Used ONLY for online-dependent data sections when the connection is offline (`!isOnline`)
 * or experiencing slow network latency (> 650ms).
 */
export const PapyrusPageSkeleton = memo(function PapyrusPageSkeleton({
  variant = 'library',
  label,
  immediate = false,
}: {
  variant?: SkeletonVariant;
  label?: string;
  immediate?: boolean;
}) {
  const palette = usePalette();
  const isOnline = useRouteRefreshStore((s) => s.isOnline);
  const [slowNetworkReached, setSlowNetworkReached] = useState(() => !isOnline || immediate);

  useEffect(() => {
    if (!isOnline || immediate) {
      setSlowNetworkReached(true);
      return;
    }
    // Only display Skeleton if online data takes > 650ms (weak/slow connection), otherwise show sleek Loader
    const timer = setTimeout(() => setSlowNetworkReached(true), 650);
    return () => clearTimeout(timer);
  }, [immediate, isOnline]);

  if (!slowNetworkReached && isOnline) {
    return <PapyrusMorphLoader compact label={label} />;
  }

  return (
    <View style={styles.skeletonRoot}>
      <View
        style={[
          styles.networkHintPill,
          {
            backgroundColor: isOnline ? palette.indigoTint : palette.goldTint,
            borderColor: isOnline ? palette.indigoBorder : palette.gold,
          },
        ]}
      >
        <AppIcon
          name={isOnline ? 'cellular-outline' : 'cloud-offline-outline'}
          size={15}
          color={isOnline ? palette.indigo : palette.gold}
        />
        <Text
          style={{
            fontSize: 11.5,
            fontWeight: '800',
            color: isOnline ? palette.indigoDeep : palette.gold,
            flex: 1,
          }}
        >
          {!isOnline
            ? 'Đang ngoại tuyến — hiển thị khung chờ dữ liệu trực tuyến'
            : label || 'Mạng hơi chậm — đang đồng bộ dữ liệu trực tuyến…'}
        </Text>
      </View>

      {variant === 'dashboard' && (
        <View style={styles.kpiRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.skelCard,
                { flex: 1, minWidth: 140, backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
              ]}
            >
              <WaveSkeletonBar width="50%" height={10} radius={5} />
              <WaveSkeletonBar width="72%" height={24} radius={7} style={{ marginTop: 10 }} />
              <WaveSkeletonBar width="100%" height={7} radius={4} style={{ marginTop: 12 }} />
            </View>
          ))}
        </View>
      )}

      {variant === 'study' && (
        <View style={[styles.skelCard, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
          <WaveSkeletonBar width="100%" height={150} radius={14} />
          <WaveSkeletonBar width="82%" height={18} radius={7} style={{ marginTop: 14 }} />
          {[0, 1, 2].map((k) => (
            <WaveSkeletonBar key={k} width="100%" height={44} radius={11} style={{ marginTop: 10 }} />
          ))}
        </View>
      )}

      {(variant === 'leaderboard' || variant === 'library') &&
        [0, 1, 2, 3].map((row) => (
          <View
            key={row}
            style={[
              styles.skelRow,
              { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
            ]}
          >
            <WaveSkeletonBar width={42} height={42} radius={21} />
            <View style={{ flex: 1, gap: 7 }}>
              <WaveSkeletonBar width="68%" height={13} radius={6} />
              <WaveSkeletonBar width="42%" height={10} radius={5} />
            </View>
            <WaveSkeletonBar width={58} height={24} radius={12} />
          </View>
        ))}
    </View>
  );
});

export const PapyrusNetworkSkeleton = PapyrusPageSkeleton;

const styles = StyleSheet.create({
  loaderRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  nativeArcRing: {
    position: 'absolute',
    borderWidth: 3,
  },
  prismCore: {
    backgroundColor: 'rgba(15, 23, 52, 0.86)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonRoot: {
    width: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  networkHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skelCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
