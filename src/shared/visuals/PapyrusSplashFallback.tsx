import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';

const PAPYRUS_LOGO = require('../../../assets/icon-ui.webp');

export interface PapyrusSplashFallbackProps {
  reduceMotion?: boolean;
  /** Optional 0..1 morph progress override (used when synchronized externally). */
  progress?: number;
}

/**
 * 2026 Spatial Glassmorphism 2D Morph Fallback matching assets/icon.png exact palette:
 * Cosmic Midnight Navy (#060A24 -> #0B1033), Royal Indigo (#4F46E5), Electric Violet (#7C3AED),
 * Magenta Rim (#C026D3), Champagne Parchment (#FFF6D6 / #F5C76E), Golden Starburst (#FCD34D).
 *
 * Used automatically on native devices, when Reduce Motion is enabled, or when WebGL2 is unavailable.
 */
export function PapyrusSplashFallback({ reduceMotion = false }: PapyrusSplashFallbackProps) {
  const morphAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const ringSpin = useRef(new Animated.Value(0)).current;
  const flarePulse = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      morphAnim.setValue(1);
      flarePulse.setValue(1);
      return;
    }

    const morphSequence = Animated.sequence([
      Animated.timing(morphAnim, {
        toValue: 0.35,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(morphAnim, {
        toValue: 1,
        duration: 920,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    const flareSequence = Animated.sequence([
      Animated.delay(950),
      Animated.spring(flarePulse, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    const spinLoop = Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1,
        duration: 6400,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );

    morphSequence.start();
    flareSequence.start();
    spinLoop.start();

    return () => {
      morphSequence.stop();
      flareSequence.stop();
      spinLoop.stop();
    };
  }, [flarePulse, morphAnim, reduceMotion, ringSpin]);

  const emblemScale = morphAnim.interpolate({
    inputRange: [0, 0.35, 0.72, 1],
    outputRange: [0.76, 0.92, 1.07, 1],
  });

  const emblemTilt = morphAnim.interpolate({
    inputRange: [0, 0.35, 0.75, 1],
    outputRange: ['-14deg', '-5deg', '4deg', '0deg'],
  });

  const outerSpin = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerSpin = ringSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const ringScale = morphAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.52, 0.72, 1],
  });

  const ringOpacity = morphAnim.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.18, 0.45, 0.85],
  });

  const flareScale = flarePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });

  return (
    <View style={styles.stage} pointerEvents="none">
      {/* Deep Cosmic Nebula Glow (Indigo + Electric Violet + Warm Amber Halo) */}
      <View style={styles.glowViolet} />
      <View style={styles.glowMagenta} />
      <View style={styles.glowGold} />

      {/* Outer AI Neural Orbital Ring (Electric Violet #7C3AED) */}
      <Animated.View
        style={[
          styles.neuralRingOuter,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }, { rotate: outerSpin }],
          },
        ]}
      >
        <View style={styles.ringNodeViolet} />
      </Animated.View>

      {/* Inner AI Neural Orbital Ring (Liquid Gold #F59E0B) */}
      <Animated.View
        style={[
          styles.neuralRingInner,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }, { rotate: innerSpin }],
          },
        ]}
      >
        <View style={styles.ringNodeGold} />
      </Animated.View>

      {/* Spatial Glass Medallion housing the official Papyrus Logo */}
      <Animated.View
        style={[
          styles.glassMedallion,
          {
            transform: [{ scale: emblemScale }, { rotate: emblemTilt }],
          },
        ]}
      >
        <Image source={PAPYRUS_LOGO} style={styles.logoImage} resizeMode="cover" />
        {/* Signature Golden-White Starburst glint aligned to upper-right shoulder of "P" */}
        <Animated.View
          style={[
            styles.starburstAnchor,
            {
              opacity: flarePulse,
              transform: [{ scale: flareScale }],
            },
          ]}
        >
          <View style={styles.starRayVertical} />
          <View style={styles.starRayHorizontal} />
          <View style={styles.starCore} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glowViolet: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(109, 74, 255, 0.22)',
  },
  glowMagenta: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(192, 38, 211, 0.16)',
    transform: [{ translateX: -18 }, { translateY: 16 }],
  },
  glowGold: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    transform: [{ translateX: 28 }, { translateY: -26 }],
  },
  neuralRingOuter: {
    position: 'absolute',
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 1.5,
    borderColor: 'rgba(124, 58, 237, 0.55)',
    borderStyle: 'solid',
    alignItems: 'center',
  },
  neuralRingInner: {
    position: 'absolute',
    width: 186,
    height: 186,
    borderRadius: 93,
    borderWidth: 1.25,
    borderColor: 'rgba(245, 158, 11, 0.48)',
    alignItems: 'center',
  },
  ringNodeViolet: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C4B5FD',
    marginTop: -4,
  },
  ringNodeGold: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
    marginTop: -3.5,
  },
  glassMedallion: {
    width: 148,
    height: 148,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#070C2A',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.45)',
    shadowColor: '#6D4AFF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 148,
    height: 148,
  },
  starburstAnchor: {
    position: 'absolute',
    top: 34,
    right: 30,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRayVertical: {
    position: 'absolute',
    width: 2.2,
    height: 32,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 251, 235, 0.9)',
  },
  starRayHorizontal: {
    position: 'absolute',
    width: 32,
    height: 2.2,
    borderRadius: 2,
    backgroundColor: 'rgba(252, 211, 77, 0.85)',
  },
  starCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});

export default PapyrusSplashFallback;
