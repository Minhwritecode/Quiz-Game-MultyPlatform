import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Model3DView } from '@/shared/Model3DView';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

interface QuestArena3DProps {
  height?: number;
  interactive3D?: boolean;
}

/**
 * Native & reduced-motion 3D-perspective Quest Astrolabe Emblem.
 * Uses Blender-exported GLB via Model3DView when interactive3D or global 3D mode is active on native,
 * and falls back to a silky 60fps pure-RN Animated astrolabe crest with zero frame drops.
 */
export function QuestArena3DFallback({ height = 200, reduceMotion = false }: { height?: number; reduceMotion?: boolean }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const spinOuter = useRef(new Animated.Value(0)).current;
  const spinInner = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return;

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    const outerLoop = Animated.loop(
      Animated.timing(spinOuter, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );

    const innerLoop = Animated.loop(
      Animated.timing(spinInner, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.96, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    floatLoop.start();
    outerLoop.start();
    innerLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      outerLoop.stop();
      innerLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, spinOuter, spinInner, pulseAnim, reduceMotion]);

  const outerDeg = spinOuter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerDeg = spinInner.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={[styles.stage, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.auraGlow, { transform: [{ scale: pulseAnim }] }]} />

      {/* Outer Golden Astrolabe Ring */}
      <Animated.View style={[styles.outerRing, { transform: [{ rotate: outerDeg }] }]}>
        <View style={[styles.orbitNode, styles.nodeTop, { backgroundColor: '#FBBF24' }]} />
        <View style={[styles.orbitNode, styles.nodeBottom, { backgroundColor: '#38BDF8' }]} />
      </Animated.View>

      {/* Inner Cyan Arcane Ring */}
      <Animated.View style={[styles.innerRing, { transform: [{ rotate: innerDeg }] }]}>
        <View style={[styles.orbitNodeSmall, styles.nodeLeft, { backgroundColor: '#A78BFA' }]} />
        <View style={[styles.orbitNodeSmall, styles.nodeRight, { backgroundColor: '#34D399' }]} />
      </Animated.View>

      {/* Floating Crystalline Core */}
      <Animated.View style={[styles.crystalWrap, { transform: [{ translateY: floatAnim }] }]}>
        <View style={styles.crystalCore}>
          <Ionicons name="prism" size={34} color="#FFFFFF" />
        </View>
      </Animated.View>

      <View style={styles.captionPill}>
        <Text style={styles.captionText}>✦ 3D QUEST CORE</Text>
      </View>
    </View>
  );
}

export default function QuestArena3D({ height = 210, interactive3D = false }: QuestArena3DProps) {
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const render3DMode = usePapyrusStore((s) => s.render3DMode);

  if (Platform.OS !== 'web' && !reduceMotion && (interactive3D || render3DMode)) {
    return (
      <View style={[styles.stage, { height }]}>
        <Model3DView
          model="questEmblem"
          height={height}
          autoRotate
          interactive
          cameraOrbit="0deg 72deg 3.6m"
          style={{ width: '100%', backgroundColor: 'transparent' }}
        />
      </View>
    );
  }

  return <QuestArena3DFallback height={height} reduceMotion={reduceMotion} />;
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  auraGlow: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(129, 140, 248, 0.28)',
  },
  outerRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.72)',
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.75)',
  },
  orbitNode: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    left: '50%',
    marginLeft: -5,
  },
  nodeTop: { top: -5 },
  nodeBottom: { bottom: -5 },
  orbitNodeSmall: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: '50%',
    marginTop: -4,
  },
  nodeLeft: { left: -4 },
  nodeRight: { right: -4 },
  crystalWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalCore: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.92)',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#818CF8',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  captionPill: {
    position: 'absolute',
    bottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  captionText: {
    color: '#E0E7FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
