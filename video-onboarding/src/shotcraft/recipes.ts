import { Easing, interpolate, spring } from 'remotion';

/**
 * Papyrus Brand Tokens matched 1:1 to assets/icon.png.
 */
export const BRAND = {
  bgDeep: '#05081D',
  bgMid: '#0A1038',
  indigo: '#4F46E5',
  indigoBright: '#6366F1',
  periwinkle: '#81A1FF',
  violet: '#7C3AED',
  magenta: '#D946EF',
  goldBright: '#FFF6CE',
  gold: '#F6C358',
  amber: '#F59E0B',
  rose: '#FB7185',
  emerald: '#34D399',
  lavender: '#C7D2FE',
  white: '#FFFFFF',
} as const;

export const VIDEO_SPEC = {
  width: 720,
  height: 720,
  fps: 30,
  durationInFrames: 285, // 9.5 seconds — punchy, zero filler, ultra-lightweight
} as const;

/**
 * Shotcraft Recipe 1: Droste / Op-Art Infinite Tunnel Layer Transform.
 * Maps a continuous depth phase t in [0, 1] into exponential perspective scale & twist.
 */
export function drosteTunnelTransform(phase01: number, twistDeg = 34) {
  const scale = 0.14 * Math.pow(13.5, phase01);
  const rotate = (phase01 - 0.5) * twistDeg;
  const opacity = interpolate(phase01, [0, 0.12, 0.78, 1], [0, 0.92, 0.72, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { scale, rotate, opacity };
}

/**
 * Shotcraft Recipe 2: Beat-Synced Crisp Spring.
 */
export function beatSpring(frame: number, fps: number, delayFrames: number, damping = 15, stiffness = 170) {
  return spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: { damping, stiffness, mass: 0.85 },
  });
}

/**
 * Shotcraft Recipe 3: Kinetic Word Mask Slide-Up.
 */
export function kineticReveal(frame: number, startFrame: number, duration = 12) {
  const p = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return {
    opacity: p,
    translateY: (1 - p) * 26,
    scale: 0.94 + p * 0.06,
  };
}

/**
 * Shotcraft Recipe 4: Portal Match-Cut Exponential Zoom.
 */
export function portalZoomCurve(frame: number, startFrame: number, endFrame: number) {
  const t = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.exp),
  });
  return {
    progress: t,
    scale: 1 + t * 8.5,
    flashOpacity: interpolate(t, [0.55, 0.85, 1], [0, 0.9, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  };
}
