import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

export type AuthVisualMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

export function AuthCosmicBackdrop({ mode, reduceMotion = false }: { mode: AuthVisualMode; reduceMotion?: boolean }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const pLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.92, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 2200, useNativeDriver: true }),
      ])
    );
    const rLoop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 18000, useNativeDriver: true })
    );
    pLoop.start();
    rLoop.start();
    return () => {
      pLoop.stop();
      rLoop.stop();
    };
  }, [pulse, rotate, reduceMotion]);

  const orb1 = mode === 'signUp' ? '#10B981' : mode === 'forgot' ? '#06B6D4' : '#4F46E5';
  const orb2 = mode === 'resetPassword' ? '#8B5CF6' : mode === 'signUp' ? '#FBBF24' : '#F59E0B';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#060A24' }]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 40,
          alignSelf: 'center',
          width: 190,
          height: 190,
          borderRadius: 95,
          borderWidth: 2,
          borderColor: orb1,
          opacity: pulse,
          transform: [
            {
              rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
            },
          ],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          top: -60,
          left: -40,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: orb1,
          opacity: pulse.interpolate({ inputRange: [0.4, 0.95], outputRange: [0.16, 0.34] }),
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
          opacity: pulse.interpolate({ inputRange: [0.4, 0.95], outputRange: [0.12, 0.28] }),
        }}
      />
    </View>
  );
}
