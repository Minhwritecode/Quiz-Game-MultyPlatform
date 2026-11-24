import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Model3DView, type Model3DActionEffect, type Model3DType } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { radii, spacing } from '@/core/theme/tokens';

const SHOWCASE_MODELS: Array<{ id: Model3DType; label: string; icon: 'sparkles' | 'school' | 'shield' }> = [
  { id: 'splashMorph', label: 'Cuộn Papyrus', icon: 'sparkles' },
  { id: 'character', label: 'Pháp sư 3D', icon: 'school' },
  { id: 'questEmblem', label: 'Huy hiệu', icon: 'shield' },
];

/**
 * Vibrant interactive 3D showcase rendered on BOTH Mobile & Desktop Home screens
 * using our full-color PBR Blender `.glb` assets with live tap-to-cast animations.
 */
export const HomeHero3DShowcase = memo(function HomeHero3DShowcase({
  compact = false,
  reduceMotion = false,
}: {
  compact?: boolean;
  reduceMotion?: boolean;
}) {
  const [selected, setSelected] = useState<Model3DType>('splashMorph');
  const [effect, setEffect] = useState<Model3DActionEffect>('idle');
  const [pulse, setPulse] = useState(0);

  if (reduceMotion) return null;

  const triggerCast = () => {
    setEffect('attack');
    setPulse((p) => p + 1);
    setTimeout(() => setEffect('idle'), 900);
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.stageBox}>
        <Model3DErrorBoundary>
          <Model3DView
            model={selected}
            height={compact ? 172 : 228}
            autoRotate
            interactive
            actionEffect={effect}
            pulseTrigger={pulse}
            animationName={effect === 'attack' ? 'Cast_Spell' : 'Idle'}
            style={styles.canvasFrame}
          />
        </Model3DErrorBoundary>

        {/* Interactive Cast Magic Trigger */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kích hoạt hiệu ứng 3D"
          onPress={triggerCast}
          style={({ pressed }) => [styles.castPill, { opacity: pressed ? 0.78 : 1 }]}
        >
          <Ionicons name="flash" size={12} color="#FDE68A" />
          <Text style={styles.castText}>Chạm tung phép</Text>
        </Pressable>
      </View>

      {/* Model Switcher Pills */}
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
                setTimeout(() => setEffect('idle'), 800);
              }}
              style={[
                styles.switchChip,
                {
                  backgroundColor: active ? 'rgba(255,255,255,0.22)' : 'rgba(6,10,36,0.34)',
                  borderColor: active ? 'rgba(253,230,138,0.75)' : 'rgba(255,255,255,0.16)',
                },
              ]}
            >
              <Ionicons name={item.icon} size={12} color={active ? '#FDE68A' : '#C7D2FE'} />
              <Text style={[styles.switchText, active && { color: '#FFFFFF' }]}>{item.label}</Text>
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
    backgroundColor: 'rgba(6, 10, 36, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.3)',
  },
  canvasFrame: {
    borderWidth: 0,
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(15, 23, 66, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.45)',
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
    gap: 5,
    paddingHorizontal: 10,
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
