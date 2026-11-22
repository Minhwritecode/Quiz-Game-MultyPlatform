import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Model3DErrorBoundary } from '../Model3DErrorBoundary';
import { PapyrusSplashFallback } from './PapyrusSplashFallback';
import {
  SPLASH_TOTAL_DURATION_SEC,
  computeSplashMorphState,
} from './splashMorphCurve';

const PapyrusSplashCanvas = lazy(() => import('./PapyrusSplashCanvas.web'));

export interface PapyrusSplash3DProps {
  reduceMotion?: boolean;
  onFinish: () => void;
}

interface WebDomStyleLike {
  opacity?: string;
  transform?: string;
  transition?: string;
}

interface WebDomElementLike {
  style?: WebDomStyleLike;
}

function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

/**
 * 2026 Spatial Glassmorphism 3D PowerPoint-Morph Splash Screen (Web).
 *
 * Performance-tuned for locked 60fps across desktop & low-end mobile browsers:
 * - Zero React re-renders during the 2.4s timeline: overlay opacity/scale and
 *   progress scaleX are mutated directly via DOM refs on the GPU compositor.
 * - Pure GPU-composited exit morph (`transform` + `opacity` with `will-change`),
 *   avoiding expensive per-frame `filter: blur(...)` full-screen rasterization.
 * - Real Three.js Shape-Key 3D Morph wrapped in <Model3DErrorBoundary> with
 *   strict GPU disposal on unmount and automatic 2D / Reduce Motion fallback.
 */
export function PapyrusSplash3D({ reduceMotion = false, onFinish }: PapyrusSplash3DProps) {
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [browserReduceMotion, setBrowserReduceMotion] = useState(false);

  const overlayRef = useRef<WebDomElementLike | null>(null);
  const progressFillRef = useRef<WebDomElementLike | null>(null);
  const finishedRef = useRef(false);
  const effectiveReduceMotion = reduceMotion || browserReduceMotion;

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setDismissed(true);
    onFinish();
  }, [onFinish]);

  const handleSkip = useCallback(() => {
    if (finishedRef.current) return;
    const overlayStyle = overlayRef.current?.style;
    if (overlayStyle) {
      overlayStyle.transition = 'opacity 160ms ease-out, transform 160ms ease-out';
      overlayStyle.opacity = '0';
      overlayStyle.transform = 'scale(1.05)';
    }
    window.setTimeout(finishOnce, 160);
  }, [finishOnce]);

  // Hydration-safe WebGL2 + prefers-reduced-motion probing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const prefersReduced = mql?.matches ?? false;

    void Promise.resolve().then(() => {
      if (!active) return;
      setBrowserReduceMotion(prefersReduced);
      setWebglReady(!reduceMotion && !prefersReduced && supportsWebGL2());
    });

    const handleChange = (event: MediaQueryListEvent) => {
      if (!active) return;
      setBrowserReduceMotion(event.matches);
      setWebglReady(!reduceMotion && !event.matches && supportsWebGL2());
    };
    mql?.addEventListener?.('change', handleChange);

    return () => {
      active = false;
      mql?.removeEventListener?.('change', handleChange);
    };
  }, [reduceMotion]);

  // Zero-rerender 2.4s PowerPoint Morph progress & pure GPU compositor exit driver
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      finishOnce();
      return;
    }
    if (typeof window === 'undefined') return;

    const totalSec = effectiveReduceMotion ? 0.65 : SPLASH_TOTAL_DURATION_SEC;
    let rafId = 0;
    const startMs = performance.now();

    const applyVisuals = (progress: number, opacity: number, scale: number) => {
      const progressStyle = progressFillRef.current?.style;
      if (progressStyle) {
        progressStyle.transform = `scaleX(${progress.toFixed(4)})`;
      }
      const overlayStyle = overlayRef.current?.style;
      if (overlayStyle) {
        overlayStyle.opacity = opacity.toFixed(4);
        overlayStyle.transform = scale === 1 ? 'scale(1)' : `scale(${scale.toFixed(4)})`;
      }
    };

    const tick = (now: number) => {
      if (finishedRef.current) return;
      const elapsedSec = (now - startMs) / 1000;

      if (effectiveReduceMotion) {
        const ratio = Math.min(1, elapsedSec / totalSec);
        const fade = ratio > 0.72 ? Math.max(0, 1 - (ratio - 0.72) / 0.28) : 1;
        applyVisuals(Math.max(0.06, ratio), fade, 1);
        if (ratio >= 1) {
          finishOnce();
          return;
        }
      } else {
        const state = computeSplashMorphState(elapsedSec);
        applyVisuals(
          Math.max(0.04, state.progress),
          state.overlayOpacity,
          state.overlayScale,
        );
        if (elapsedSec >= SPLASH_TOTAL_DURATION_SEC) {
          finishOnce();
          return;
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [effectiveReduceMotion, finishOnce]);

  if (dismissed || process.env.NODE_ENV === 'test') {
    return null;
  }

  const webOverlayStyle = {
    backgroundImage:
      'radial-gradient(circle at 50% 42%, rgba(79, 70, 229, 0.30) 0%, rgba(124, 58, 237, 0.14) 28%, rgba(6, 10, 36, 0.98) 68%), '
      + 'radial-gradient(circle at 64% 34%, rgba(245, 158, 11, 0.18) 0%, rgba(6, 10, 36, 0) 42%), '
      + 'linear-gradient(165deg, #05081D 0%, #090E2E 52%, #06091B 100%)',
    willChange: 'transform, opacity',
    opacity: 1,
    transform: 'scale(1)',
  } as unknown as ViewStyle;

  const webSkipGlass = {
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  } as unknown as ViewStyle;

  const webProgressFill = {
    width: '100%',
    transformOrigin: 'left center',
    transform: 'scaleX(0.04)',
    willChange: 'transform',
    backgroundImage: 'linear-gradient(90deg, #6366F1 0%, #A855F7 52%, #F6C358 100%)',
    boxShadow: '0 0 12px rgba(246, 195, 88, 0.65)',
  } as unknown as ViewStyle;

  const webWordmarkGradient = {
    backgroundImage: 'linear-gradient(108deg, #FFFFFF 0%, #E0E7FF 36%, #FDE68A 76%, #F59E0B 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as unknown as ViewStyle;

  return (
    <View
      ref={overlayRef as never}
      style={[styles.overlay, webOverlayStyle]}
      accessibilityLabel="Papyrus 3D Splash Screen"
    >
      {/* Skip Spatial Glass Pill */}
      <Pressable
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel="Bỏ qua màn hình chờ"
        style={({ pressed }) => [
          styles.skipButton,
          webSkipGlass,
          { top: Math.max(18, insets.top + 14), opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={styles.skipText}>Bỏ qua</Text>
      </Pressable>

      <View style={styles.centerContent}>
        {/* 3D Morph Stage with strict Error Boundary + 2D Fallback */}
        <View style={styles.stageBox}>
          {webglReady ? (
            <Model3DErrorBoundary
              fallback={<PapyrusSplashFallback reduceMotion={effectiveReduceMotion} />}
            >
              <Suspense fallback={<PapyrusSplashFallback reduceMotion={effectiveReduceMotion} />}>
                <PapyrusSplashCanvas />
              </Suspense>
            </Model3DErrorBoundary>
          ) : (
            <PapyrusSplashFallback reduceMotion={effectiveReduceMotion} />
          )}
        </View>

        <Text style={[styles.wordmark, webWordmarkGradient as never]}>PAPYRUS</Text>
        <Text style={styles.tagline}>From Ancient Scroll to AI Power.</Text>

        {/* Ultra-thin Spatial Glass Progress Pill */}
        <View style={[styles.progressTrack, webSkipGlass]}>
          <View ref={progressFillRef as never} style={[styles.progressFill, webProgressFill]} />
        </View>
      </View>

      <View style={[styles.footer, { bottom: Math.max(24, insets.bottom + 16) }]} pointerEvents="none">
        <Text style={styles.footerText}>SPATIAL AI LEARNING STUDIO</Text>
      </View>
    </View>
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
  skipButton: {
    position: 'absolute',
    right: 22,
    zIndex: 10,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 24, 68, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.28)',
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E0E7FF',
    letterSpacing: 0.5,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 460,
    width: '100%',
  },
  stageBox: {
    width: 300,
    height: 290,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 10,
    color: '#FFFBEB',
    marginTop: 6,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C7D2FE',
    letterSpacing: 0.6,
    marginTop: 8,
    textAlign: 'center',
  },
  progressTrack: {
    width: 220,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(196, 181, 253, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.22)',
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
    letterSpacing: 2.4,
    color: 'rgba(165, 180, 252, 0.48)',
  },
});

export default PapyrusSplash3D;
