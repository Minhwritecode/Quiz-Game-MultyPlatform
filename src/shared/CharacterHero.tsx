import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from './ui';
import { Model3DView, Character3DAnimation } from './Model3DView';
import { Model3DErrorBoundary } from './Model3DErrorBoundary';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';

export type CharacterAction = 'idle' | 'attack' | 'hurt' | 'victory';

const CHARACTER_FRAMES: Record<CharacterAction, any> = {
  idle: require('../../assets/characters/papyrus/idle.webp'),
  attack: require('../../assets/characters/papyrus/attack.webp'),
  hurt: require('../../assets/characters/papyrus/hurt.webp'),
  victory: require('../../assets/characters/papyrus/victory.webp'),
};

const ACTION_TO_3D_ANIMATION: Record<CharacterAction, Character3DAnimation> = {
  idle: 'Idle',
  attack: 'Cast_Spell',
  hurt: 'Hit_Reaction',
  victory: 'Victory_Dance',
};

interface CharacterHeroProps {
  action?: CharacterAction;
  size?: 'sm' | 'md' | 'lg';
  hp?: number;
  maxHp?: number;
  name?: string;
  showHealthBar?: boolean;
  mode?: '2d' | '3d';
}

export function CharacterHero({
  action = 'idle',
  size = 'md',
  hp = 3,
  maxHp = 3,
  name = 'Papyrus Scholar',
  showHealthBar = false,
  mode,
}: CharacterHeroProps) {
  const palette = usePalette();
  const globalRender3D = usePapyrusStore((state) => state.render3DMode);
  const isVip = useMembershipStore((state) => state.tier === 'archmage');
  const activeMode = mode !== undefined ? mode : globalRender3D ? '3d' : '2d';

  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const dim = size === 'sm' ? 84 : size === 'lg' ? 180 : 124;
  const height3D = size === 'sm' ? 130 : size === 'lg' ? 240 : 180;

  // Gentle floating animation for 2D mode
  useEffect(() => {
    if (activeMode === '3d') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, activeMode]);

  // Action-driven triggers for 2D mode
  useEffect(() => {
    if (activeMode === '3d') return;
    if (action === 'attack') {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (action === 'hurt') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    } else if (action === 'victory') {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [action, scaleAnim, shakeAnim, activeMode]);

  return (
    <View style={styles.container}>
      {/* Name and Health Bar */}
      {showHealthBar && (
        <View style={styles.header}>
          <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
            {isVip ? `👑 ${name}` : name}
          </Text>
          <View style={[styles.hpTrack, { backgroundColor: palette.paperMuted }]}>
            <View
              style={[
                styles.hpFill,
                {
                  width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`,
                  backgroundColor: hp > 1 ? '#10B981' : '#F43F5E',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Render Mode: 3D Rigged WebGL or 2D Sprite */}
      {activeMode === '3d' ? (
        <View style={{ width: dim * 1.5, height: height3D, alignItems: 'center', justifyContent: 'center' }}>
          {isVip && (
            <View style={{ position: 'absolute', top: 4, zIndex: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>👑 VIP ARCHMAGE</Text>
            </View>
          )}
          <Model3DErrorBoundary>
            <Model3DView
              model="character"
              height={height3D}
              animationName={ACTION_TO_3D_ANIMATION[action]}
              autoRotate={false}
              interactive={true}
              cameraOrbit="0deg 82deg 3.6m"
              style={styles.model3dBox}
            />
          </Model3DErrorBoundary>
        </View>
      ) : (
        /* Floating Animated Character Sprite */
        <Animated.View
          style={[
            styles.spriteWrapper,
            {
              width: dim,
              height: dim,
              transform: [
                { translateY: floatAnim },
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {isVip && (
            <View style={{ position: 'absolute', top: -14, zIndex: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#B45309' }}>👑 VIP</Text>
            </View>
          )}
          <Image
            source={CHARACTER_FRAMES[action] || CHARACTER_FRAMES.idle}
            style={[styles.spriteImage, { width: dim, height: dim }]}
            resizeMode="cover"
          />
          {/* Glowing Aura Ring */}
          <View
            style={[
              styles.auraRing,
              {
                width: dim * 0.8,
                height: 12,
                backgroundColor: isVip ? 'rgba(245, 158, 11, 0.45)' : palette.indigoTint,
              },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  hpTrack: {
    width: 90,
    height: 7,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  spriteWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spriteImage: {
    borderRadius: radii.lg,
  },
  auraRing: {
    position: 'absolute',
    bottom: -6,
    borderRadius: radii.pill,
    opacity: 0.6,
    transform: [{ scaleX: 1.2 }],
    zIndex: -1,
  },
  model3dBox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});
