import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PapyrusSplashFallback } from './PapyrusSplashFallback';
import { SPLASH_TOTAL_DURATION_SEC } from './splashMorphCurve';

export interface PapyrusSplash3DProps {
  reduceMotion?: boolean;
  onFinish: () => void;
}

/**
 * Native 2026 Spatial Glassmorphism Splash Screen (iOS / Android).
 * Uses smooth native-driver Animated 2D Morph choreography matching assets/icon.png,
 * with tap-to-skip and automatic Reduce Motion adaptation.
 */
export function PapyrusSplash3D({ reduceMotion = false, onFinish }: PapyrusSplash3DProps) {
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const finishedRef = useRef(false);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setDismissed(true);
    onFinish();
  }, [onFinish]);

  const handleSkip = useCallback(() => {
    if (finishedRef.current) return;
    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitScale, {
        toValue: 1.04,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => finishOnce());
  }, [exitOpacity, exitScale, finishOnce]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      finishOnce();
      return;
    }

    const totalMs = reduceMotion ? 650 : Math.round(SPLASH_TOTAL_DURATION_SEC * 1000);
    const exitMs = reduceMotion ? 180 : 380;
    const holdMs = Math.max(0, totalMs - exitMs);

    const progressTask = Animated.timing(progressAnim, {
      toValue: 1,
      duration: totalMs,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });

    const exitTask = Animated.sequence([
      Animated.delay(holdMs),
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: exitMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: reduceMotion ? 1 : 1.07,
          duration: exitMs,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    progressTask.start();
    exitTask.start(({ finished }) => {
      if (finished) finishOnce();
    });

    return () => {
      progressTask.stop();
      exitTask.stop();
    };
  }, [exitOpacity, exitScale, finishOnce, progressAnim, reduceMotion]);

  if (dismissed || process.env.NODE_ENV === 'test') {
    return null;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['6%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: exitOpacity,
          transform: [{ scale: exitScale }],
        },
      ]}
      accessibilityLabel="Papyrus Splash Screen"
    >
      {/* Cosmic Midnight Ambient Nebula Layers */}
      <View style={styles.ambientTopGlow} pointerEvents="none" />
      <View style={styles.ambientBottomGlow} pointerEvents="none" />
      <View style={styles.ambientGoldGlow} pointerEvents="none" />

      {/* Skip Glass Pill */}
      <Pressable
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Bỏ qua màn hình chờ"
        style={({ pressed }) => [
          styles.skipButton,
          { top: Math.max(18, insets.top + 12), opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={styles.skipText}>Bỏ qua</Text>
      </Pressable>

      {/* Center Stage */}
      <View style={styles.centerContent}>
        <PapyrusSplashFallback reduceMotion={reduceMotion} />

        <Text style={styles.wordmark}>PAPYRUS</Text>
        <Text style={styles.tagline}>From Ancient Scroll to AI Power.</Text>

        {/* Ultra-thin Spatial Glass Progress Pill */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>

      <View style={[styles.footer, { bottom: Math.max(24, insets.bottom + 16) }]} pointerEvents="none">
        <Text style={styles.footerText}>SPATIAL AI LEARNING STUDIO</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    backgroundColor: '#060A24',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ambientTopGlow: {
    position: 'absolute',
    top: '-14%',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(79, 70, 229, 0.24)',
  },
  ambientBottomGlow: {
    position: 'absolute',
    bottom: '-18%',
    left: '-14%',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(192, 38, 211, 0.14)',
  },
  ambientGoldGlow: {
    position: 'absolute',
    top: '20%',
    right: '-12%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245, 158, 11, 0.13)',
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 66, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.28)',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E0E7FF',
    letterSpacing: 0.4,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 420,
    width: '100%',
  },
  wordmark: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 9,
    color: '#FFFBEB',
    marginTop: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(124, 58, 237, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  tagline: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#C7D2FE',
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  progressTrack: {
    width: 210,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(196, 181, 253, 0.16)',
    borderWidth: 0.5,
    borderColor: 'rgba(196, 181, 253, 0.24)',
    overflow: 'hidden',
    marginTop: 26,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F6C358',
  },
  footer: {
    position: 'absolute',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: 'rgba(165, 180, 252, 0.5)',
  },
});

export default PapyrusSplash3D;
