import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

type ParticleType = 'stars' | 'butterflies' | 'sparkles' | 'fire';

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
  translateX: Animated.Value;
  scale: Animated.Value;
}

interface MagicParticlesProps {
  color?: string;
  count?: number;
  type?: ParticleType;
  trigger?: number; // change to re-trigger burst
  style?: object;
}

const EMOJIS: Record<ParticleType, string> = {
  stars: '✦',
  butterflies: '🦋',
  sparkles: '✨',
  fire: '🔥',
};

export function MagicParticles({
  color = '#FBBF24',
  count = 8,
  type = 'sparkles',
  trigger = 0,
  style,
}: MagicParticlesProps) {
  const particles = useRef<Particle[]>(
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * 200 - 100,
      y: Math.random() * 60,
      size: 8 + Math.random() * 12,
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const burst = () => {
    const animations = particles.map((p) => {
      const dx = (Math.random() - 0.5) * 160;
      const dy = -(40 + Math.random() * 80);

      p.opacity.setValue(0);
      p.translateY.setValue(0);
      p.translateX.setValue(0);
      p.scale.setValue(0);

      return Animated.parallel([
        Animated.sequence([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 600,
            delay: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.translateY, {
          toValue: dy,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(p.translateX, {
          toValue: dx,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: 0.5,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start();
  };

  useEffect(() => {
    if (trigger > 0) burst();
  }, [trigger]);

  const emoji = EMOJIS[type];

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.particle,
            {
              fontSize: p.size,
              color,
              opacity: p.opacity,
              transform: [
                { translateY: p.translateY },
                { translateX: p.translateX },
                { scale: p.scale },
              ],
              left: 50 + p.x,
              top: 50 + p.y,
            },
          ]}
        >
          {type === 'stars' ? '✦' : type === 'sparkles' ? '✨' : type === 'fire' ? '🔥' : '🦋'}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 200,
    height: 200,
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
});

export default MagicParticles;
