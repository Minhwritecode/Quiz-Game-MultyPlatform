import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Model3DView, type Model3DActionEffect, type Model3DType } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { radii, spacing } from '@/core/theme/tokens';

const SHOWCASE_MODELS: Array<{
  id: Model3DType;
  label: string;
  icon: 'school' | 'sparkles' | 'skull' | 'flame';
}> = [
  { id: 'character', label: 'Đại Pháp Sư 3D', icon: 'school' },
  { id: 'royalScroll', label: 'Cuộn Hoàng Gia', icon: 'sparkles' },
  { id: 'bossGolem', label: 'Boss Golem 3D', icon: 'skull' },
  { id: 'archerBow', label: 'Cung Lửa 3D', icon: 'flame' },
];

/**
 * Vibrant interactive 3D showcase rendered on BOTH Mobile & Desktop Home screens
 * using our full-color PBR Blender `.glb` RPG assets with live tap-to-cast animations.
 */
export const HomeHero3DShowcase = memo(function HomeHero3DShowcase({
  compact = false,
  reduceMotion = false,
}: {
  compact?: boolean;
  reduceMotion?: boolean;
}) {
  const [selected, setSelected] = useState<Model3DType>('character');
  const [effect, setEffect] = useState<Model3DActionEffect>('idle');
  const [pulse, setPulse] = useState(0);

  if (reduceMotion) return null;

  const triggerCast = () => {
    setEffect('attack');
    setPulse((p) => p + 1);
    setTimeout(() => setEffect('idle'), 950);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.stageBox}>
        <Model3DErrorBoundary>
          <Model3DView
            model={selected}
            height={compact ? 196 : 244}
            autoRotate
            interactive
            actionEffect={effect}
            pulseTrigger={pulse}
            animationName={effect === 'attack' ? 'Cast_Spell' : effect === 'victory' ? 'Victory_Dance' : 'Idle'}
            style={styles.canvasFrame}
          />
        </Model3DErrorBoundary>

        <View style={styles.dragHintPill} pointerEvents="none">
          <Ionicons name="move-outline" size={11} color="#C7D2FE" />
          <Text style={styles.dragHintText}>Kéo xoay 360°</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kích hoạt hiệu ứng tung phép 3D"
          onPress={triggerCast}
          style={({ pressed }) => [styles.castPill, { opacity: pressed ? 0.78 : 1 }]}
        >
          <Ionicons name="flame" size={13} color="#FDE68A" />
          <Text style={styles.castText}>Tung phép 3D</Text>
        </Pressable>
      </View>

      <View style={styles.switcherRow}>
        {SHOWCASE_MODELS.map((item) => {
          const active = selected === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setSelected(item.id);
                setEffect('victory');
                setPulse((p) => p + 1);
                setTimeout(() => setEffect('idle'), 850);
              }}
              style={[
                styles.switchChip,
                {
                  backgroundColor: active ? 'rgba(251, 191, 36, 0.22)' : 'rgba(6, 10, 36, 0.42)',
                  borderColor: active ? 'rgba(253, 230, 138, 0.85)' : 'rgba(255, 255, 255, 0.16)',
                },
              ]}
            >
              <Ionicons name={item.icon} size={12} color={active ? '#FDE68A' : '#C7D2FE'} />
              <Text style={[styles.switchText, active && { color: '#FFFFFF', fontWeight: '800' }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
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
    marginTop: spacing.md,
  },
  stageBox: {
    position: 'relative',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 12, 42, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
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
    backgroundColor: 'rgba(6, 10, 36, 0.65)',
  },
  dragHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C7D2FE',
  },
  castPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124, 45, 18, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.65)',
  },
  castText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FDE68A',
  },
  switcherRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  switchText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0E7FF',
  },
});
