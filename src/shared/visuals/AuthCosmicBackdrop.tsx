import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export type AuthVisualMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

export function AuthCosmicBackdrop({ mode, reduceMotion = false }: { mode: AuthVisualMode; reduceMotion?: boolean }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.88, duration: 2400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.42, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const orb1 = mode === 'signUp' ? '#10B981' : mode === 'forgot' ? '#06B6D4' : '#4F46E5';
  const orb2 = mode === 'resetPassword' ? '#8B5CF6' : '#F59E0B';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#060A24' }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: -60,
          left: -40,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: orb1,
          opacity: pulse.interpolate({ inputRange: [0.4, 0.9], outputRange: [0.16, 0.34] }),
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -50,
          right: -40,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: orb2,
          opacity: pulse.interpolate({ inputRange: [0.4, 0.9], outputRange: [0.12, 0.28] }),
        }}
      />
    </View>
  );
}
