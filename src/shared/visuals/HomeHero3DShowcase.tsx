import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AppIcon } from '@/shared/AppIcon';
import { Model3DView, type Model3DActionEffect, type Model3DType } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { useIsDarkTheme, usePalette } from '@/shared/ui';
import { radii, spacing } from '@/core/theme/tokens';

const SHOWCASE_MODELS: Array<{
  id: Model3DType;
  label: string;
  icon: 'sparkles' | 'school' | 'skull' | 'flame';
}> = [
  { id: 'royalScroll', label: 'Cuộn Papyrus', icon: 'sparkles' },
  { id: 'character', label: 'Học giả 3D', icon: 'school' },
  { id: 'bossGolem', label: 'Boss Golem', icon: 'skull' },
  { id: 'archerBow', label: 'Cung Lửa', icon: 'flame' },
];

/**
 * Interactive 3D showcase displayed by default inside Hero,
 * with balanced 2x2 switcher grid on mobile and Warm Paper / Night Ink framing.
 */
export const HomeHero3DShowcase = memo(function HomeHero3DShowcase({
  compact = false,
  reduceMotion = false,
}: {
  compact?: boolean;
  reduceMotion?: boolean;
}) {
  const palette = usePalette();
  const isDark = useIsDarkTheme();
  const [selected, setSelected] = useState<Model3DType>('royalScroll');
  const [effect, setEffect] = useState<Model3DActionEffect>('idle');
  const [pulse, setPulse] = useState(0);
  const effectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(effectTimeout.current), []);

  if (reduceMotion) return null;

  const playEffect = (next: 'attack' | 'victory', duration: number) => {
    clearTimeout(effectTimeout.current);
    setEffect(next);
    setPulse((p) => p + 1);
    effectTimeout.current = setTimeout(() => setEffect('idle'), duration);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View
        style={[
          styles.stageBox,
          {
            backgroundColor: isDark ? '#0B1633' : '#10234E',
            borderColor: palette.goldBorder,
          },
        ]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden={true}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="hero3d-aura" cx="50%" cy="48%" r="58%">
                <Stop offset="0%" stopColor="#F5B73B" stopOpacity={0.22} />
                <Stop offset="55%" stopColor="#3B6CE0" stopOpacity={0.14} />
                <Stop offset="100%" stopColor="#10234E" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero3d-aura)" />
            <Circle cx="50%" cy="50%" r="36%" stroke="#F5B73B" strokeWidth={1} strokeOpacity={0.14} fill="none" />
          </Svg>
        </View>
        <Model3DErrorBoundary>
          <Model3DView
            model={selected}
            height={compact ? 170 : 224}
            showcase
            autoRotate
            interactive
            actionEffect={effect}
            pulseTrigger={pulse}
            animationName={effect === 'attack' ? 'Cast_Spell' : effect === 'victory' ? 'Victory_Dance' : 'Idle'}
            style={styles.canvasFrame}
          />
        </Model3DErrorBoundary>

        <View
          style={[
            styles.dragHintPill,
            { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted },
          ]}
          pointerEvents="none"
        >
          <AppIcon name="move-outline" size={11} color={palette.inkMuted} />
          <Text style={[styles.dragHintText, { color: palette.inkMuted }]}>Xoay 360°</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kích hoạt hiệu ứng mô hình 3D"
          onPress={() => playEffect('attack', 950)}
          style={({ pressed }) => [
            styles.castPill,
            {
              backgroundColor: palette.goldTint,
              borderColor: palette.goldBorder,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <AppIcon name="sparkles" size={12} color={palette.gold} />
          <Text style={[styles.castText, { color: palette.gold }]}>Hiệu ứng</Text>
        </Pressable>
      </View>

      {/* Symmetrical 2x2 explicit rows (guaranteed 50/50 width alignment) */}
      <View style={styles.switcherGrid}>
        {[SHOWCASE_MODELS.slice(0, 2), SHOWCASE_MODELS.slice(2, 4)].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.switcherRow}>
            {row.map((item) => {
              const active = selected === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setSelected(item.id);
                    playEffect('victory', 850);
                  }}
                  style={[
                    styles.switchChip,
                    {
                      backgroundColor: active ? palette.indigoTint : palette.paper,
                      borderColor: active ? palette.indigoBorder : palette.paperMuted,
                    },
                  ]}
                >
                  <AppIcon
                    name={item.icon}
                    size={13}
                    color={active ? palette.indigo : palette.inkMuted}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.switchText,
                      {
                        color: active ? palette.indigoDeep : palette.inkMuted,
                        fontWeight: active ? '800' : '600',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: spacing.xs,
  },
  wrapCompact: {
    marginTop: spacing.sm,
  },
  stageBox: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  canvasFrame: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  dragHintPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dragHintText: {
    fontSize: 10,
    fontWeight: '700',
  },
  castPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  castText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  switcherGrid: {
    gap: 6,
  },
  switcherRow: {
    flexDirection: 'row',
    gap: 6,
  },
  switchChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  switchText: {
    fontSize: 11.5,
  },
});
