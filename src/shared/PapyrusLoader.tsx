import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

const MORPH_STAGES: Array<{
  icon: 'document-text' | 'diamond' | 'sparkles' | 'shield-checkmark';
  color: string;
  radius: number;
  tip: string;
}> = [
  { icon: 'document-text', color: '#6366F1', radius: 14, tip: 'Đang mở cuộn tri thức Papyrus…' },
  { icon: 'diamond', color: '#06B6D4', radius: 28, tip: 'Đang kết tinh bộ đề & thuật ngữ…' },
  { icon: 'sparkles', color: '#F59E0B', radius: 20, tip: 'Đang đồng bộ ma trận câu hỏi 3D…' },
  { icon: 'shield-checkmark', color: '#10B981', radius: 34, tip: 'Sẵn sàng bước vào Đấu trường!' },
];

/**
 * Signature multi-stage geometric morphing loader (Scroll -> Diamond -> Starburst -> Shield)
 * with GPU-only transform/opacity transitions and reduced-motion accessibility compliance.
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
  const [stageIdx, setStageIdx] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const morphScale = useRef(new Animated.Value(1)).current;
  const ringPulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIdx((prev) => (prev + 1) % MORPH_STAGES.length);
    }, 1100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // Slow down rotation significantly (8s) rather than stopping completely so users still perceive active progress
      morphScale.setValue(1);
      ringPulse.setValue(0.65);
      const slowSpin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      slowSpin.start();
      return () => slowSpin.stop();
    }
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(morphScale, {
          toValue: 1.14,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(morphScale, {
          toValue: 0.94,
          duration: 550,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 0.92, duration: 900, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      ])
    );
    spinLoop.start();
    breathLoop.start();
    haloLoop.start();
    return () => {
      spinLoop.stop();
      breathLoop.stop();
      haloLoop.stop();
    };
  }, [morphScale, reduceMotion, ringPulse, spinAnim]);

  const stage = MORPH_STAGES[stageIdx]!;
  const boxSize = compact ? 54 : 76;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label || stage.tip}
      style={[styles.loaderWrap, compact && { paddingVertical: spacing.md }]}
    >
      <View style={{ width: boxSize + 28, height: boxSize + 28, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer Orbiting Conic Halo */}
        <Animated.View
          style={[
            styles.outerHalo,
            {
              width: boxSize + 24,
              height: boxSize + 24,
              borderRadius: (boxSize + 24) / 2,
              borderColor: stage.color,
              opacity: ringPulse,
              transform: [
                {
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.orbitDot, { backgroundColor: stage.color }]} />
        </Animated.View>

        {/* Morphing Geometric Core */}
        <Animated.View
          style={[
            styles.morphCore,
            {
              width: boxSize,
              height: boxSize,
              borderRadius: stage.radius,
              backgroundColor: '#0F172A',
              borderColor: stage.color,
              transform: [
                { scale: morphScale },
                {
                  rotate: spinAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-180deg'],
                  }),
                },
              ],
            },
            Platform.OS === 'web'
              ? ({
                  transition: 'border-radius 450ms cubic-bezier(0.22, 1, 0.36, 1), border-color 450ms ease',
                } as unknown as ViewStyle)
              : undefined,
          ]}
        >
          <Ionicons name={stage.icon} size={compact ? 24 : 32} color={stage.color} />
        </Animated.View>
      </View>

      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm, textAlign: 'center' }]}>
        {label || stage.tip}
      </Text>
      {!compact && (
        <View style={styles.stageDots}>
          {MORPH_STAGES.map((s, idx) => (
            <View
              key={s.icon}
              style={[
                styles.stageDot,
                {
                  width: idx === stageIdx ? 20 : 7,
                  backgroundColor: idx === stageIdx ? stage.color : palette.paperMuted,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const ShimmerBlock = memo(function ShimmerBlock({
  width,
  height,
  radius = 12,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const palette = usePalette();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.92, duration: 780, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.38, duration: 780, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: palette.paperMuted,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
});

export type SkeletonVariant = 'study' | 'leaderboard' | 'library' | 'dashboard';

/**
 * Rich contextual Skeleton + Morphing Header screen for smooth perceived-zero-latency loading.
 */
export const PapyrusPageSkeleton = memo(function PapyrusPageSkeleton({
  variant = 'library',
  label,
}: {
  variant?: SkeletonVariant;
  label?: string;
}) {
  const palette = usePalette();

  return (
    <View style={styles.skeletonRoot}>
      <PapyrusMorphLoader compact label={label} />

      {variant === 'dashboard' && (
        <View style={styles.kpiRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.skelCard, { flex: 1, minWidth: 140, backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
            >
              <ShimmerBlock width="55%" height={11} radius={6} />
              <ShimmerBlock width="75%" height={26} radius={8} style={{ marginTop: 10 }} />
              <ShimmerBlock width="100%" height={8} radius={4} style={{ marginTop: 12 }} />
            </View>
          ))}
        </View>
      )}

      {variant === 'study' && (
        <View style={[styles.skelCard, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
          <ShimmerBlock width="100%" height={168} radius={16} />
          <ShimmerBlock width="85%" height={20} radius={8} style={{ marginTop: 16 }} />
          <ShimmerBlock width="65%" height={16} radius={8} style={{ marginTop: 8 }} />
          {[0, 1, 2, 3].map((k) => (
            <ShimmerBlock key={k} width="100%" height={48} radius={12} style={{ marginTop: 10 }} />
          ))}
        </View>
      )}

      {(variant === 'leaderboard' || variant === 'library') &&
        [0, 1, 2, 3, 4].map((row) => (
          <View
            key={row}
            style={[
              styles.skelRow,
              { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
            ]}
          >
            <ShimmerBlock width={44} height={44} radius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <ShimmerBlock width="72%" height={15} radius={6} />
              <ShimmerBlock width="46%" height={11} radius={6} />
            </View>
            <ShimmerBlock width={64} height={28} radius={14} />
          </View>
        ))}
    </View>
  );
});

const styles = StyleSheet.create({
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  outerHalo: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: -5,
  },
  morphCore: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  stageDot: {
    height: 7,
    borderRadius: 4,
  },
  skeletonRoot: {
    width: '100%',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
