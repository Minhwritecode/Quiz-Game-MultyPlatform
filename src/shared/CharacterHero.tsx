import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from './ui';

export type CharacterAction = 'idle' | 'attack' | 'hurt' | 'victory';

const CHARACTER_FRAMES: Record<CharacterAction, any> = {
  idle: require('../../assets/characters/papyrus/idle.png'),
  attack: require('../../assets/characters/papyrus/attack.png'),
  hurt: require('../../assets/characters/papyrus/hurt.png'),
  victory: require('../../assets/characters/papyrus/victory.png'),
};

interface CharacterHeroProps {
  action?: CharacterAction;
  size?: 'sm' | 'md' | 'lg';
  hp?: number;
  maxHp?: number;
  name?: string;
  showHealthBar?: boolean;
}

export function CharacterHero({
  action = 'idle',
  size = 'md',
  hp = 3,
  maxHp = 3,
  name = 'Papyrus Scholar',
  showHealthBar = false,
}: CharacterHeroProps) {
  const palette = usePalette();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const dim = size === 'sm' ? 84 : size === 'lg' ? 180 : 124;

  // Gentle floating animation
  useEffect(() => {
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
  }, [floatAnim]);

  // Action-driven triggers
  useEffect(() => {
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
  }, [action, scaleAnim, shakeAnim]);

  return (
    <View style={styles.container}>
      {/* Name and Health Bar */}
      {showHealthBar && (
        <View style={styles.header}>
          <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>{name}</Text>
          <View style={[styles.hpTrack, { backgroundColor: palette.paperMuted }]}>
            <View
              style={[
                styles.hpFill,
                {
                  width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`,
                  backgroundColor: hp > 1 ? colors.emerald500 : colors.rose500,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Floating Animated Character Sprite */}
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
        <Image
          source={CHARACTER_FRAMES[action] || CHARACTER_FRAMES.idle}
          style={[styles.spriteImage, { width: dim, height: dim }]}
          resizeMode="cover"
        />
        {/* Glowing Aura Ring */}
        <View style={[styles.auraRing, { width: dim * 0.8, height: 12, backgroundColor: palette.indigoTint }]} />
      </Animated.View>
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
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: radii.full,
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
    borderRadius: radii.full,
    opacity: 0.6,
    transform: [{ scaleX: 1.2 }],
    zIndex: -1,
  },
});
