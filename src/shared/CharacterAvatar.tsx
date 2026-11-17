import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type AvatarAction = 'idle' | 'attack' | 'hurt' | 'victory';

interface CharacterAvatarProps {
  color?: string;
  name?: string;
  action?: AvatarAction;
  size?: number;
  showName?: boolean;
}

export function CharacterAvatar({
  color = '#4F46E5',
  name = 'Scholar',
  action = 'idle',
  size = 56,
  showName = true,
}: CharacterAvatarProps) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Idle float
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -4, duration: 1000, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    return () => { loop.stop(); glowLoop.stop(); };
  }, [bounceAnim, glowAnim]);

  // Action triggers
  useEffect(() => {
    if (action === 'attack') {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (action === 'hurt') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    } else if (action === 'victory') {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.25, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [action, scaleAnim, shakeAnim]);

  const hatSize = size * 0.45;
  const bodySize = size * 0.65;
  const staffHeight = size * 0.9;

  return (
    <View style={styles.wrapper}>
      {/* Glow aura */}
      <Animated.View
        style={[
          styles.aura,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: (size * 1.4) / 2,
            backgroundColor: color,
            opacity: glowAnim,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.characterGroup,
          {
            transform: [
              { translateY: bounceAnim },
              { translateX: shakeAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* Wizard hat */}
        <View
          style={[
            styles.hat,
            {
              width: hatSize,
              height: hatSize * 0.8,
              backgroundColor: color,
              borderTopLeftRadius: hatSize / 2,
              borderTopRightRadius: hatSize / 2,
            },
          ]}
        />

        {/* Head circle */}
        <View
          style={[
            styles.head,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#FEF3C7',
              borderWidth: 2.5,
              borderColor: color,
            },
          ]}
        >
          {/* Eyes */}
          <View style={styles.eyes}>
            <View style={[styles.eye, { backgroundColor: color }]} />
            <View style={[styles.eye, { backgroundColor: color }]} />
          </View>
          {/* Mouth */}
          <View
            style={[
              styles.mouth,
              {
                borderColor: color,
                width: size * 0.35,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
              },
            ]}
          />
        </View>

        {/* Body / robe */}
        <View
          style={[
            styles.body,
            {
              width: bodySize,
              height: bodySize,
              borderRadius: bodySize * 0.3,
              backgroundColor: color,
              marginTop: -4,
            },
          ]}
        />
      </Animated.View>

      {showName && (
        <Text style={[styles.name, { color }]} numberOfLines={1}>
          {name}
        </Text>
      )}

      {/* Shadow ellipse */}
      <View
        style={[
          styles.shadow,
          {
            width: size * 0.8,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  aura: {
    position: 'absolute',
    top: 10,
  },
  characterGroup: {
    alignItems: 'center',
    zIndex: 1,
  },
  hat: {
    marginBottom: -4,
    zIndex: 2,
  },
  head: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mouth: {
    height: 0,
    borderBottomWidth: 2,
  },
  body: {
    opacity: 0.9,
  },
  name: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
    maxWidth: 80,
    textAlign: 'center',
  },
  shadow: {
    height: 6,
    borderRadius: 3,
    opacity: 0.15,
    marginTop: 2,
  },
});

export default CharacterAvatar;
