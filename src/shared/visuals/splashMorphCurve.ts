/**
 * Pure PowerPoint-style 3-beat morph timeline & easing curves for PapyrusSplash3D.
 * Shared between the Three.js WebGL 3D morph canvas and the 2D morph fallback.
 */

export type SplashMorphPhase = 'scroll' | 'morph' | 'lockin' | 'exit';

export interface SplashMorphFrameState {
  phase: SplashMorphPhase;
  /** Normalized overall progress in [0, 1] across the 2.4s splash timeline. */
  progress: number;
  /** Real Shape Key / MorphTarget weight (0 = Ancient Scroll, 1 = Sculpted Papyrus "P" Logo). */
  morphInfluence: number;
  /** Synchronized 360-degree PowerPoint Morph spin in radians around Y axis. */
  spinY: number;
  /** Camera dolly Z coordinate (smooth push-in during Beat 1 -> Beat 3). */
  cameraZ: number;
  /** Overall emblem scale with gentle Beat 3 breath. */
  emblemScale: number;
  /** Vertical floating offset in Three.js world units. */
  floatY: number;
  /** Ancient scroll gold roller finials scale (1 in Beat 1 -> 0 during Beat 2). */
  finialScale: number;
  /** Dual AI Neural orbital rings expansion scale (0.2 -> 1.0). */
  ringsScale: number;
  /** Signature golden-white starburst flare bloom scale on upper-right "P" shoulder. */
  starburstScale: number;
  /** Rim-light sweep azimuth angle in radians for metallic specular pass. */
  rimSweepAngle: number;
  /** Seamless morph-out progress in [0, 1] during final 0.38s (2.02s -> 2.40s). */
  exitProgress: number;
  /** Container opacity (1 -> 0 during exit morph). */
  overlayOpacity: number;
  /** Container zoom scale (1 -> 1.08 during exit morph). */
  overlayScale: number;
}

export const SPLASH_TOTAL_DURATION_SEC = 2.4;
export const SPLASH_BEAT1_END_SEC = 0.7;
export const SPLASH_BEAT2_END_SEC = 1.6;
export const SPLASH_EXIT_START_SEC = 2.02;

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function computeSplashMorphState(elapsedSec: number): SplashMorphFrameState {
  const t = Math.max(0, Math.min(SPLASH_TOTAL_DURATION_SEC, elapsedSec));
  const progress = clamp01(t / SPLASH_TOTAL_DURATION_SEC);

  const beat1T = clamp01(t / SPLASH_BEAT1_END_SEC);
  const beat2T = clamp01((t - SPLASH_BEAT1_END_SEC) / (SPLASH_BEAT2_END_SEC - SPLASH_BEAT1_END_SEC));
  const beat3T = clamp01((t - SPLASH_BEAT2_END_SEC) / (SPLASH_TOTAL_DURATION_SEC - SPLASH_BEAT2_END_SEC));
  const exitRaw = clamp01((t - SPLASH_EXIT_START_SEC) / (SPLASH_TOTAL_DURATION_SEC - SPLASH_EXIT_START_SEC));

  let phase: SplashMorphPhase = 'scroll';
  if (t >= SPLASH_EXIT_START_SEC) {
    phase = 'exit';
  } else if (t >= SPLASH_BEAT2_END_SEC) {
    phase = 'lockin';
  } else if (t >= SPLASH_BEAT1_END_SEC) {
    phase = 'morph';
  }

  // Shape key morph weight: subtle anticipation in Beat 1 -> silky cubic morph 0.04 -> 1.0 in Beat 2
  const morphEase = easeInOutCubic(beat2T);
  const morphInfluence = t < SPLASH_BEAT1_END_SEC
    ? 0.04 * easeOutCubic(beat1T)
    : lerp(0.04, 1.0, morphEase);

  // PowerPoint Morph 360-degree turn across Beat 2 + subtle settle in Beat 1 & Beat 3
  const beat1Turn = lerp(-0.28, 0.08, easeOutCubic(beat1T));
  const beat2Turn = morphEase * Math.PI * 2;
  const beat3Sway = t >= SPLASH_BEAT2_END_SEC ? Math.sin(beat3T * Math.PI) * 0.09 : 0;
  const spinY = beat1Turn + beat2Turn + beat3Sway;

  // Camera dolly-in during Beat 1 -> slight breath pull during Beat 2 -> intimate lock-in
  const cameraZ = t < SPLASH_BEAT1_END_SEC
    ? lerp(5.45, 4.45, easeOutCubic(beat1T))
    : t < SPLASH_BEAT2_END_SEC
      ? lerp(4.45, 4.2, morphEase) + Math.sin(beat2T * Math.PI) * 0.22
      : lerp(4.2, 3.85, easeInOutCubic(exitRaw));

  // Scale + levitation
  const entryScale = lerp(0.82, 0.98, easeOutCubic(beat1T));
  const morphScale = lerp(0.98, 1.04, morphEase);
  const breath = t >= SPLASH_BEAT2_END_SEC ? Math.sin(beat3T * Math.PI * 1.4) * 0.025 : 0;
  const emblemScale = (t < SPLASH_BEAT1_END_SEC ? entryScale : morphScale) + breath;

  const floatY = t < SPLASH_BEAT1_END_SEC
    ? lerp(-0.18, 0.02, easeOutCubic(beat1T))
    : 0.02 + Math.sin(t * 2.6) * 0.045;

  // Gold roller finials smoothly disappear during the first 55% of Beat 2
  const finialHideT = clamp01(beat2T / 0.55);
  const finialScale = Math.max(0.0001, 1 - easeInOutCubic(finialHideT));

  // Dual AI Neural Rings bloom outward during Beat 2
  const ringsScale = t < SPLASH_BEAT1_END_SEC
    ? lerp(0.18, 0.34, easeOutCubic(beat1T))
    : lerp(0.34, 1.0, easeOutCubic(beat2T)) + breath * 0.6;

  // Signature Starburst ignites cleanly at 52% through Beat 2 with elastic overshoot
  const starT = clamp01((beat2T - 0.52) / 0.48);
  const starTwinkle = t >= SPLASH_BEAT2_END_SEC ? 1 + Math.sin(beat3T * Math.PI * 3.0) * 0.08 : 1;
  const starburstScale = starT <= 0 ? 0.0001 : Math.max(0.0001, easeOutBack(starT) * starTwinkle);

  // Specular rim-light sweep across Beat 2
  const rimSweepAngle = lerp(-1.1, Math.PI * 1.35, morphEase) + beat3T * 0.45;

  // Seamless morph-out transition into the app
  const exitProgress = easeInOutCubic(exitRaw);
  const overlayOpacity = 1 - exitProgress;
  const overlayScale = lerp(1.0, 1.08, exitProgress);

  return {
    phase,
    progress,
    morphInfluence,
    spinY,
    cameraZ,
    emblemScale,
    floatY,
    finialScale,
    ringsScale,
    starburstScale,
    rimSweepAngle,
    exitProgress,
    overlayOpacity,
    overlayScale,
  };
}
