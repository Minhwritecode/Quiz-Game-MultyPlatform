import { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export type GameMode = 'survival' | 'battle' | 'match' | 'study';

interface GameEnvironmentProps {
  gameMode: GameMode;
  children: ReactNode;
}

// ─── Particle/orb helper ───────────────────────────────────────────────────

function FloatingOrb({ color, size, startX, startY, duration }: {
  color: string; size: number; startX: number; startY: number; duration: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.9, duration: duration * 0.6, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: duration * 0.6, useNativeDriver: true }),
      ])
    ).start();
  }, [anim, opacityAnim, duration]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: opacityAnim,
        transform: [{ translateY }],
        shadowColor: color,
        shadowRadius: size,
        shadowOpacity: 0.8,
        elevation: 10,
      }}
    />
  );
}

function CyanPillar({ left, top }: { left: number; top: number }) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [glowAnim]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: 8,
        height: 80,
        borderRadius: 4,
        backgroundColor: '#06B6D4',
        opacity: glowAnim,
        shadowColor: '#06B6D4',
        shadowRadius: 12,
        shadowOpacity: 1,
        elevation: 20,
      }}
    />
  );
}

function StarParticle({ left, top, delay }: { left: number; top: number; delay: number }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(floatAnim, { toValue: -60, duration: 3000, useNativeDriver: true }),
            Animated.timing(floatAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, { toValue: 0.9, duration: 800, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, delay);
  }, [floatAnim, opacityAnim, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#E0F7FF',
        opacity: opacityAnim,
        transform: [{ translateY: floatAnim }],
      }}
    />
  );
}

function CandleFlicker({ left, top }: { left: number; top: number }) {
  const flicker = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.6, duration: 100 + Math.random() * 100, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 100 + Math.random() * 100, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1, duration: 200, useNativeDriver: true }),
      ])
    ).start();
  }, [flicker]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: 10,
        height: 20,
        borderRadius: 5,
        backgroundColor: '#F97316',
        opacity: flicker,
        shadowColor: '#F97316',
        shadowRadius: 10,
        shadowOpacity: 0.9,
        elevation: 15,
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function GameEnvironment({ gameMode, children }: GameEnvironmentProps) {
  const config = CONFIGS[gameMode];

  const renderDecor = () => {
    if (gameMode === 'survival') {
      return (
        <>
          {/* 4 glowing cyan pillars */}
          <CyanPillar left={12} top={80} />
          <CyanPillar left={12} top={300} />
          <CyanPillar left={-4} top={160} />
          <CyanPillar left={-4} top={420} />
          {/* Star particles */}
          {Array.from({ length: 18 }, (_, i) => (
            <StarParticle
              key={i}
              left={20 + (i * 23) % 320}
              top={100 + (i * 47) % 500}
              delay={i * 200}
            />
          ))}
          {/* Arena floor glow at bottom */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: '10%',
              right: '10%',
              height: 6,
              borderRadius: 3,
              backgroundColor: '#06B6D4',
              shadowColor: '#06B6D4',
              shadowRadius: 20,
              shadowOpacity: 0.8,
              elevation: 20,
            }}
          />
        </>
      );
    }

    if (gameMode === 'battle') {
      return (
        <>
          {/* Crowd dots at edges */}
          {Array.from({ length: 24 }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (i % 6) * 50 + 10,
                top: i < 12 ? 10 : 650,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: `hsl(${i * 15}, 70%, 60%)`,
                opacity: 0.5,
              }}
            />
          ))}
          {/* Gold border lines */}
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 3, backgroundColor: '#FBBF24', opacity: 0.6 }} />
          <View style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: 3, backgroundColor: '#FBBF24', opacity: 0.6 }} />
        </>
      );
    }

    if (gameMode === 'match') {
      return (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <CandleFlicker
              key={i}
              left={i < 4 ? 8 : 350}
              top={80 + (i % 4) * 120}
            />
          ))}
        </>
      );
    }

    if (gameMode === 'study') {
      return (
        <>
          {Array.from({ length: 6 }, (_, i) => (
            <FloatingOrb
              key={i}
              color={i % 2 === 0 ? '#4ADE80' : '#38BDF8'}
              size={12 + (i * 5) % 18}
              startX={30 + (i * 60) % 300}
              startY={60 + (i * 80) % 400}
              duration={2000 + i * 400}
            />
          ))}
        </>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      {/* Gradient overlay layers */}
      <View style={[styles.gradientTop, { backgroundColor: config.gradientTop }]} />
      <View style={[styles.gradientBottom, { backgroundColor: config.gradientBottom }]} />

      {/* Decorative environment elements */}
      {renderDecor()}

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const CONFIGS: Record<GameMode, { bgColor: string; gradientTop: string; gradientBottom: string }> = {
  survival: {
    bgColor: '#0F172A',
    gradientTop: 'rgba(79, 70, 229, 0.25)',
    gradientBottom: 'rgba(6, 182, 212, 0.08)',
  },
  battle: {
    bgColor: '#FEF9F0',
    gradientTop: 'rgba(251, 191, 36, 0.3)',
    gradientBottom: 'rgba(245, 158, 11, 0.1)',
  },
  match: {
    bgColor: '#1C0A00',
    gradientTop: 'rgba(146, 64, 14, 0.4)',
    gradientBottom: 'rgba(69, 26, 3, 0.6)',
  },
  study: {
    bgColor: '#0C2340',
    gradientTop: 'rgba(22, 101, 52, 0.4)',
    gradientBottom: 'rgba(56, 189, 248, 0.15)',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default GameEnvironment;
