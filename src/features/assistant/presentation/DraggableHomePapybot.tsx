import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAssistantUiStore } from '@/core/state/useAssistantUiStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

const ORB_SIZE = 52;
const MARGIN = 12;

/**
 * Floating draggable Papybot mascot orb ONLY for the Home screen:
 * - Freely draggable anywhere within viewport bounds (Gesture.Pan + Reanimated spring settle).
 * - Pure UI-thread Reanimated glow flash & scale-breathe animation (respects reduceMotion).
 * - Crisp `×` close button at top-right so user can dismiss it cleanly anytime.
 */
export function DraggableHomePapybot() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const openAssistant = useAssistantUiStore((s) => s.openAssistant);
  const assistantOpen = useAssistantUiStore((s) => s.open);
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [dismissed, setDismissed] = useState(false);

  const maxX = Math.max(MARGIN, width - ORB_SIZE - MARGIN);
  const minY = Math.max(70, insets.top + 60);
  const maxY = Math.max(
    minY + 40,
    height - ORB_SIZE - (Platform.OS === 'web' && width >= 900 ? 32 : 96 + insets.bottom)
  );

  const tx = useSharedValue(maxX);
  const ty = useSharedValue(maxY - 20);
  const startX = useSharedValue(maxX);
  const startY = useSharedValue(maxY - 20);
  const dragging = useSharedValue(false);
  const breathe = useSharedValue(1);
  const glow = useSharedValue(0.45);

  useEffect(() => {
    const nextX = Math.min(Math.max(tx.get(), MARGIN), maxX);
    const nextY = Math.min(Math.max(ty.get(), minY), maxY);
    tx.set(nextX);
    ty.set(nextY);
  }, [maxX, minY, maxY, tx, ty]);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(breathe);
      cancelAnimation(glow);
      breathe.set(1);
      glow.set(0.5);
      return;
    }
    breathe.set(
      withRepeat(
        withSequence(withTiming(1.075, { duration: 1300 }), withTiming(0.96, { duration: 1300 })),
        -1,
        false
      )
    );
    glow.set(
      withRepeat(
        withSequence(withTiming(0.95, { duration: 900 }), withTiming(0.25, { duration: 900 })),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(glow);
    };
  }, [breathe, glow, reduceMotion]);

  const panGesture = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      dragging.set(true);
      startX.set(tx.get());
      startY.set(ty.get());
    })
    .onUpdate((e) => {
      const clampedX = Math.min(Math.max(startX.get() + e.translationX, MARGIN), maxX);
      const clampedY = Math.min(Math.max(startY.get() + e.translationY, minY), maxY);
      tx.set(clampedX);
      ty.set(clampedY);
    })
    .onEnd((e) => {
      dragging.set(false);
      const projectedX = startX.get() + e.translationX + e.velocityX * 0.08;
      const projectedY = startY.get() + e.translationY + e.velocityY * 0.08;
      const finalX = Math.min(Math.max(projectedX, MARGIN), maxX);
      const finalY = Math.min(Math.max(projectedY, minY), maxY);
      tx.set(withSpring(finalX, { duration: 360, dampingRatio: 0.82 }));
      ty.set(withSpring(finalY, { duration: 360, dampingRatio: 0.82 }));
    });

  const animatedPos = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: dragging.get() ? 1.08 : 1 },
    ],
  }));

  const animatedHalo = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ scale: breathe.get() }],
  }));

  const animatedOrbScale = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.get() }],
  }));

  if (dismissed || assistantOpen) return null;

  return (
    <View style={styles.overlayLayer} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Reanimated.View style={[styles.anchor, animatedPos]}>
          {/* Pulsing Shimmer Halo */}
          <Reanimated.View pointerEvents="none" style={[styles.glowRing, animatedHalo]} />

          {/* Interactive Mascot Orb */}
          <Reanimated.View style={animatedOrbScale}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mở trợ lý AI Papybot"
              onPress={() => openAssistant()}
              style={({ pressed }) => [styles.orbButton, { opacity: pressed ? 0.88 : 1 }]}
            >
              <Image
                source={require('../../../../assets/chatbot-avatar.webp')}
                style={styles.mascotImg}
                resizeMode="cover"
              />
              <View style={styles.sparkDot}>
                <Ionicons name="sparkles" size={10} color="#0F172A" />
              </View>
            </Pressable>
          </Reanimated.View>

          {/* Top-right Dismiss × Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ẩn biểu tượng Papybot"
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation?.();
              setDismissed(true);
            }}
            style={({ pressed }) => [styles.closeX, { opacity: pressed ? 0.72 : 1 }]}
          >
            <Ionicons name="close" size={13} color="#F8FAFC" />
          </Pressable>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayLayer: {
    ...(Platform.OS === 'web'
      ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as unknown as object)
      : StyleSheet.absoluteFill),
    zIndex: 90,
  },
  anchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: ORB_SIZE + 14,
    height: ORB_SIZE + 14,
    borderRadius: (ORB_SIZE + 14) / 2,
    backgroundColor: 'rgba(99, 102, 241, 0.36)',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.75)',
  },
  orbButton: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: '#1E1B4B',
    borderWidth: 2.5,
    borderColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  mascotImg: {
    width: ORB_SIZE - 4,
    height: ORB_SIZE - 4,
    borderRadius: (ORB_SIZE - 4) / 2,
  },
  sparkDot: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: '#1E1B4B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(248, 250, 252, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
