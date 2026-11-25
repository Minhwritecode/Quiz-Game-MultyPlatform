import React, { ReactNode, memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { Model3DView, type Model3DActionEffect } from './Model3DView';
import { Model3DErrorBoundary } from './Model3DErrorBoundary';

export type GameMode = 'survival' | 'battle' | 'match' | 'study';

interface GameEnvironmentProps {
  gameMode: GameMode;
  children: ReactNode;
  show3DByDefault?: boolean;
  enable3DToggle?: boolean;
  actionEffect?: Model3DActionEffect;
  pulseTrigger?: number;
}

// ─── Shared Animated Helpers ───────────────────────────────────────────────

const FloatingOrb = memo(function FloatingOrb({
  color,
  size,
  startX,
  startY,
  duration,
  reduceMotion,
}: {
  color: string;
  size: number;
  startX: number;
  startY: number;
  duration: number;
  reduceMotion: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(0);
      opacityAnim.setValue(0.45);
      return;
    }
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    const fadeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.9, duration: duration * 0.6, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.3, duration: duration * 0.6, useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    fadeLoop.start();
    return () => {
      floatLoop.stop();
      fadeLoop.stop();
    };
  }, [anim, opacityAnim, duration, reduceMotion]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -35] });

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
});

const StarParticle = memo(function StarParticle({
  left,
  top,
  delay,
  reduceMotion,
}: {
  left: number;
  top: number;
  delay: number;
  reduceMotion: boolean;
}) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(reduceMotion ? 0.5 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      floatAnim.setValue(0);
      opacityAnim.setValue(0.5);
      return;
    }
    let loop: Animated.CompositeAnimation | null = null;
    const timer = setTimeout(() => {
      loop = Animated.loop(
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
      );
      loop.start();
    }, delay);
    return () => {
      clearTimeout(timer);
      loop?.stop();
    };
  }, [floatAnim, opacityAnim, delay, reduceMotion]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#FFFFFF',
        opacity: opacityAnim,
        transform: [{ translateY: floatAnim }],
        shadowColor: '#38BDF8',
        shadowRadius: 6,
        shadowOpacity: 1,
        elevation: 6,
      }}
    />
  );
});

const CandleFlicker = memo(function CandleFlicker({
  left,
  top,
  reduceMotion,
}: {
  left: number;
  top: number;
  reduceMotion: boolean;
}) {
  const flicker = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (reduceMotion) {
      flicker.setValue(0.85);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1.0, duration: 250, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.55, duration: 180, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.85, duration: 320, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.65, duration: 200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [flicker, reduceMotion]);

  return (
    <View style={{ position: 'absolute', left, top, alignItems: 'center' }}>
      {/* Sconce bracket */}
      <View style={{ width: 14, height: 4, backgroundColor: '#78350F', borderRadius: 2 }} />
      <View style={{ width: 8, height: 18, backgroundColor: '#FEF3C7', borderRadius: 2 }} />
      {/* Flame */}
      <Animated.View
        style={{
          width: 8,
          height: 14,
          borderRadius: 4,
          backgroundColor: '#F59E0B',
          opacity: flicker,
          marginTop: -6,
          shadowColor: '#F59E0B',
          shadowRadius: 10,
          shadowOpacity: 0.95,
          elevation: 12,
        }}
      />
    </View>
  );
});

// ─── 4 Environment Architectural Backdrops ─────────────────────────────────

/** Game 1: Đỉnh Tháp Hư Không (Celestial Spire) */
const CelestialSpireBackdrop = memo(function CelestialSpireBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(0.65);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, reduceMotion]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Cosmic Nebula Core */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 40,
          alignSelf: 'center',
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: 'rgba(79, 70, 229, 0.15)',
          opacity: pulseAnim,
          shadowColor: '#4F46E5',
          shadowRadius: 40,
          shadowOpacity: 0.8,
        }}
      />
      {/* 4 Monolith Rune Pillars */}
      <View style={[styles.monolithPillar, { left: 8, top: 120 }]} />
      <View style={[styles.monolithPillar, { left: 8, top: 380 }]} />
      <View style={[styles.monolithPillar, { right: 8, top: 120 }]} />
      <View style={[styles.monolithPillar, { right: 8, top: 380 }]} />

      {/* Floating Star Dust */}
      {Array.from({ length: 16 }, (_, i) => (
        <StarParticle
          key={i}
          left={15 + ((i * 37) % 330)}
          top={80 + ((i * 53) % 480)}
          delay={i * 150}
          reduceMotion={reduceMotion}
        />
      ))}

      {/* Spire Dais Base Glow */}
      <View
        style={{
          position: 'absolute',
          bottom: 15,
          left: '8%',
          right: '8%',
          height: 4,
          borderRadius: 2,
          backgroundColor: '#06B6D4',
          shadowColor: '#06B6D4',
          shadowRadius: 16,
          shadowOpacity: 0.9,
          elevation: 16,
        }}
      />
    </View>
  );
});

/** Game 2: Đấu Trường La Mã Tri Thức (Colosseum of Wisdom) */
const ColosseumBackdrop = memo(function ColosseumBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Roman Archways Silhouette */}
      <View style={styles.colosseumArchesRow}>
        {Array.from({ length: 5 }, (_, i) => (
          <View key={i} style={styles.stoneArch}>
            <View style={styles.archCurve} />
            <View style={styles.archPillarLeft} />
            <View style={styles.archPillarRight} />
          </View>
        ))}
      </View>

      {/* Academy Battle Banners */}
      <View style={[styles.academyBanner, { left: 24, backgroundColor: '#4F46E5' }]}>
        <Text style={styles.bannerRune}>✦</Text>
      </View>
      <View style={[styles.academyBanner, { right: 24, backgroundColor: '#FBBF24' }]}>
        <Text style={[styles.bannerRune, { color: '#78350F' }]}>⚜</Text>
      </View>

      {/* Marble Arena Circle Trim */}
      <View
        style={{
          position: 'absolute',
          bottom: 20,
          alignSelf: 'center',
          width: 300,
          height: 80,
          borderRadius: 150,
          borderWidth: 1.5,
          borderColor: 'rgba(251, 191, 36, 0.35)',
          backgroundColor: 'rgba(254, 243, 199, 0.05)',
        }}
      />
    </View>
  );
});

/** Game 3: Mê Cung Thư Viện Cổ (The Grand Papyrus Archives) */
const ArchivesBackdrop = memo(function ArchivesBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Towering Bookshelves Top Arch */}
      <View style={styles.bookshelfHeader}>
        {Array.from({ length: 12 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.grimoireSpine,
              {
                height: 28 + (i % 3) * 6,
                backgroundColor: i % 3 === 0 ? '#7C2D12' : i % 2 === 0 ? '#1E1B4B' : '#78350F',
                borderLeftColor: '#FDE68A',
              },
            ]}
          />
        ))}
      </View>

      {/* Wall Candle Sconces */}
      <CandleFlicker left={12} top={120} reduceMotion={reduceMotion} />
      <CandleFlicker left={12} top={280} reduceMotion={reduceMotion} />
      <CandleFlicker left={12} top={440} reduceMotion={reduceMotion} />
      <CandleFlicker left={340} top={120} reduceMotion={reduceMotion} />
      <CandleFlicker left={340} top={280} reduceMotion={reduceMotion} />
      <CandleFlicker left={340} top={440} reduceMotion={reduceMotion} />

      {/* Warm Golden Glow Backdrop */}
      <View
        style={{
          position: 'absolute',
          top: 100,
          alignSelf: 'center',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        }}
      />
    </View>
  );
});

/** Game 4: Vườn Thiền Tri Thức (Sanctuary of Scholars) */
const SanctuaryBackdrop = memo(function SanctuaryBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Light Waterfall Beams */}
      <View style={styles.waterfallBeams}>
        {Array.from({ length: 4 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.lightBeam,
              {
                left: 60 + i * 65,
                opacity: 0.15 + (i % 2) * 0.1,
              },
            ]}
          />
        ))}
      </View>

      {/* Floating Spirit Orbs */}
      {Array.from({ length: 6 }, (_, i) => (
        <FloatingOrb
          key={i}
          color={i % 2 === 0 ? '#34D399' : '#38BDF8'}
          size={12 + (i % 3) * 6}
          startX={25 + ((i * 55) % 310)}
          startY={90 + ((i * 70) % 380)}
          duration={2200 + i * 350}
          reduceMotion={reduceMotion}
        />
      ))}

      {/* Zen Garden Floating Dais Glow */}
      <View
        style={{
          position: 'absolute',
          bottom: 25,
          alignSelf: 'center',
          width: 220,
          height: 18,
          borderRadius: 9,
          backgroundColor: 'rgba(52, 211, 153, 0.25)',
          shadowColor: '#34D399',
          shadowRadius: 16,
          shadowOpacity: 0.8,
        }}
      />
    </View>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────

export function GameEnvironment({
  gameMode,
  children,
  show3DByDefault = true,
  enable3DToggle = true,
  actionEffect = 'idle',
  pulseTrigger = 0,
}: GameEnvironmentProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [show3D, setShow3D] = useState(() => show3DByDefault && !reduceMotion);
  const config = CONFIGS[gameMode];

  const backdrop =
    gameMode === 'survival' ? (
      <CelestialSpireBackdrop reduceMotion={reduceMotion} />
    ) : gameMode === 'battle' ? (
      <ColosseumBackdrop />
    ) : gameMode === 'match' ? (
      <ArchivesBackdrop reduceMotion={reduceMotion} />
    ) : gameMode === 'study' ? (
      <SanctuaryBackdrop reduceMotion={reduceMotion} />
    ) : null;

  return (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      {/* Subtle Cosmic Gradient Ambience (kept strictly behind content) */}
      <View style={[styles.gradientTop, { backgroundColor: config.gradientTop }]} pointerEvents="none" />
      <View style={[styles.gradientBottom, { backgroundColor: config.gradientBottom }]} pointerEvents="none" />

      {/* Architectural Backdrop (softened so foreground text stays readable) */}
      <View style={[StyleSheet.absoluteFill, { opacity: 0.38 }]} pointerEvents="none">
        {backdrop}
      </View>

      {/* Framed Blender 3D Realm Showcase Stage */}
      {enable3DToggle && !reduceMotion && (
        <View style={[styles.stageHeaderWrap, { paddingTop: Math.max(10, insets.top + 6) }]}>
          {show3D ? (
            <View style={styles.stage3DContainer}>
              <Model3DErrorBoundary>
                <Model3DView
                  model={gameMode}
                  height={186}
                  autoRotate={true}
                  interactive={true}
                  actionEffect={actionEffect}
                  pulseTrigger={pulseTrigger}
                />
              </Model3DErrorBoundary>
              <View style={styles.stageFooterRow}>
                <Text style={styles.stage3DHint}>
                  Kéo xoay 3D · Chạm hoặc trả lời để tung hiệu ứng
                </Text>
                <Pressable
                  onPress={() => setShow3D(false)}
                  accessibilityRole="button"
                  style={styles.stageCollapseBtn}
                >
                  <Ionicons name="chevron-up" size={14} color="#C7D2FE" />
                  <Text style={styles.stageCollapseText}>Thu gọn 3D</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShow3D(true)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.stageExpandPill,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="cube-outline" size={14} color="#C7D2FE" />
              <Text style={styles.stageCollapseText}>Mở sân khấu 3D</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Main Game UI Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const CONFIGS: Record<GameMode, { bgColor: string; gradientTop: string; gradientBottom: string }> = {
  survival: {
    bgColor: '#0B0F19',
    gradientTop: 'rgba(79, 70, 229, 0.35)',
    gradientBottom: 'rgba(6, 182, 212, 0.12)',
  },
  battle: {
    bgColor: '#171109',
    gradientTop: 'rgba(245, 158, 11, 0.3)',
    gradientBottom: 'rgba(124, 58, 237, 0.2)',
  },
  match: {
    bgColor: '#1A0B02',
    gradientTop: 'rgba(180, 83, 9, 0.4)',
    gradientBottom: 'rgba(69, 26, 3, 0.7)',
  },
  study: {
    bgColor: '#061727',
    gradientTop: 'rgba(16, 185, 129, 0.35)',
    gradientBottom: 'rgba(14, 165, 233, 0.2)',
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
    height: 240,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  monolithPillar: {
    position: 'absolute',
    width: 6,
    height: 80,
    borderRadius: 3,
    backgroundColor: '#06B6D4',
    shadowColor: '#06B6D4',
    shadowRadius: 14,
    shadowOpacity: 0.9,
    elevation: 14,
  },
  colosseumArchesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    top: 20,
    left: 10,
    right: 10,
    opacity: 0.25,
  },
  stoneArch: {
    width: 48,
    height: 52,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  archCurve: {
    width: 32,
    height: 32,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginTop: 4,
  },
  archPillarLeft: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    width: 3,
    height: 16,
    backgroundColor: '#FDE68A',
  },
  archPillarRight: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    width: 3,
    height: 16,
    backgroundColor: '#FDE68A',
  },
  academyBanner: {
    position: 'absolute',
    top: 80,
    width: 22,
    height: 54,
    borderRadius: 3,
    alignItems: 'center',
    paddingTop: 4,
    shadowColor: '#000',
    shadowRadius: 6,
    shadowOpacity: 0.5,
  },
  bannerRune: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  bookshelfHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    position: 'absolute',
    top: 6,
    left: 10,
    right: 10,
    opacity: 0.35,
  },
  grimoireSpine: {
    width: 18,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderLeftWidth: 1.5,
  },
  waterfallBeams: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  lightBeam: {
    position: 'absolute',
    top: 0,
    width: 14,
    height: 260,
    backgroundColor: '#6EE7B7',
    transform: [{ rotate: '8deg' }],
  },
  stageHeaderWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    zIndex: 5,
  },
  stage3DContainer: {
    width: '100%',
    zIndex: 5,
  },
  stageFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  stage3DHint: {
    fontSize: 11,
    color: '#CBD5E1',
    letterSpacing: 0.2,
  },
  stageCollapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 66, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.35)',
  },
  stageExpandPill: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 66, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.38)',
  },
  stageCollapseText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});

export default GameEnvironment;
