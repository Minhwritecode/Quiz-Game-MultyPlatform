import { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

export type AvatarAction = 'idle' | 'attack' | 'hurt' | 'victory';

interface CharacterAvatarProps {
  color?: string;
  name?: string;
  action?: AvatarAction;
  size?: number;
  showName?: boolean;
  isDisconnected?: boolean;
  reconnectCountdown?: number;
  hasGoldenAura?: boolean;
}

export const CharacterAvatar = memo(function CharacterAvatar({
  color = '#4F46E5',
  name = 'Scholar',
  action = 'idle',
  size = 56,
  showName = true,
  isDisconnected = false,
  reconnectCountdown = 30,
  hasGoldenAura = false,
}: CharacterAvatarProps) {
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.45)).current;

  // Active theme color (petrified stone gray + crystal frost when disconnected)
  const activeColor = isDisconnected ? '#64748B' : color;
  const skinColor = isDisconnected ? '#94A3B8' : '#FEF3C7';
  const runeGlow = isDisconnected ? '#38BDF8' : hasGoldenAura ? '#F59E0B' : activeColor;

  // Idle float (only when connected and motion enabled)
  useEffect(() => {
    if (isDisconnected || reduceMotion) {
      bounceAnim.setValue(0);
      glowAnim.setValue(0.45);
      return;
    }
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

    return () => {
      loop.stop();
      glowLoop.stop();
    };
  }, [bounceAnim, glowAnim, isDisconnected, reduceMotion]);

  // Action triggers
  useEffect(() => {
    if (isDisconnected) return;
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
  }, [action, scaleAnim, shakeAnim, isDisconnected]);

  const hatSize = size * 0.45;
  const bodySize = size * 0.65;

  return (
    <View style={styles.wrapper}>
      {/* Glow aura / Crystal Frost Shimmer / VIP Golden Aura */}
      <Animated.View
        style={[
          styles.aura,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: (size * 1.4) / 2,
            backgroundColor: runeGlow,
            opacity: isDisconnected ? 0.4 : glowAnim,
            borderWidth: hasGoldenAura && !isDisconnected ? 2 : 0,
            borderColor: '#F59E0B',
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
        {hasGoldenAura && !isDisconnected && (
          <Text
            style={{
              position: 'absolute',
              top: -(size * 0.35),
              zIndex: 10,
              fontSize: Math.max(12, size * 0.28),
            }}
          >
            👑
          </Text>
        )}
        {/* Wizard hat */}
        <View
          style={[
            styles.hat,
            {
              width: hatSize,
              height: hatSize * 0.8,
              backgroundColor: activeColor,
              borderTopLeftRadius: hatSize / 2,
              borderTopRightRadius: hatSize / 2,
              borderWidth: isDisconnected ? 1 : 0,
              borderColor: '#38BDF8',
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
              backgroundColor: skinColor,
              borderWidth: 2.5,
              borderColor: isDisconnected ? '#38BDF8' : activeColor,
            },
          ]}
        >
          {isDisconnected ? (
            <Text style={{ fontSize: size * 0.38 }}>🧊</Text>
          ) : (
            <>
              {/* Eyes */}
              <View style={styles.eyes}>
                <View style={[styles.eye, { backgroundColor: activeColor }]} />
                <View style={[styles.eye, { backgroundColor: activeColor }]} />
              </View>
              {/* Mouth */}
              <View
                style={[
                  styles.mouth,
                  {
                    borderColor: activeColor,
                    width: size * 0.35,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                  },
                ]}
              />
            </>
          )}
        </View>

        {/* Body / robe */}
        <View
          style={[
            styles.body,
            {
              width: bodySize,
              height: bodySize,
              borderRadius: bodySize * 0.3,
              backgroundColor: activeColor,
              marginTop: -4,
              borderWidth: isDisconnected ? 1 : 0,
              borderColor: '#38BDF8',
            },
          ]}
        />
      </Animated.View>

      {/* Reconnect Stone Badge */}
      {isDisconnected ? (
        <View style={styles.stoneBadge}>
          <Text style={styles.stoneBadgeText}>🗿 Hóa đá ({reconnectCountdown}s)</Text>
        </View>
      ) : null}

      {showName && (
        <Text style={[styles.name, { color: activeColor }]} numberOfLines={1}>
          {name}
        </Text>
      )}

      {/* Pedestal shadow */}
      <View
        style={[
          styles.shadow,
          {
            width: size * 0.85,
            backgroundColor: isDisconnected ? '#38BDF8' : activeColor,
            opacity: isDisconnected ? 0.35 : 0.15,
          },
        ]}
      />
    </View>
  );
});

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
  stoneBadge: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
    zIndex: 3,
  },
  stoneBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    marginTop: 2,
  },
});

export default CharacterAvatar;
