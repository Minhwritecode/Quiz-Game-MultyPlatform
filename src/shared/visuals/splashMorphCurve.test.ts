import {
  SPLASH_BEAT1_END_SEC,
  SPLASH_BEAT2_END_SEC,
  SPLASH_EXIT_START_SEC,
  SPLASH_TOTAL_DURATION_SEC,
  computeSplashMorphState,
  easeInOutCubic,
} from './splashMorphCurve';

describe('splashMorphCurve (PowerPoint 3-Beat Morph timeline)', () => {
  it('starts in Beat 1 (Ancient Scroll) with zero morph influence and visible finials', () => {
    const start = computeSplashMorphState(0);
    expect(start.phase).toBe('scroll');
    expect(start.progress).toBe(0);
    expect(start.morphInfluence).toBe(0);
    expect(start.finialScale).toBe(1);
    expect(start.starburstScale).toBeLessThan(0.01);
    expect(start.overlayOpacity).toBe(1);
    expect(start.overlayScale).toBe(1);
  });

  it('smoothly morphs Shape Key weight from scroll to Papyrus "P" emblem across Beat 2', () => {
    const beat1End = computeSplashMorphState(SPLASH_BEAT1_END_SEC);
    const midMorph = computeSplashMorphState(1.15);
    const beat2End = computeSplashMorphState(SPLASH_BEAT2_END_SEC);

    expect(beat1End.phase).toBe('morph');
    expect(midMorph.phase).toBe('morph');
    expect(midMorph.morphInfluence).toBeGreaterThan(0.45);
    expect(midMorph.morphInfluence).toBeLessThan(0.6);
    expect(beat2End.phase).toBe('lockin');
    expect(beat2End.morphInfluence).toBeCloseTo(1, 5);
    expect(beat2End.finialScale).toBeLessThan(0.01);
    expect(beat2End.ringsScale).toBeCloseTo(1, 3);
    expect(beat2End.starburstScale).toBeGreaterThan(0.9);
  });

  it('executes seamless zoom-fade morph-out in final exit beat', () => {
    const preExit = computeSplashMorphState(SPLASH_EXIT_START_SEC - 0.05);
    const midExit = computeSplashMorphState((SPLASH_EXIT_START_SEC + SPLASH_TOTAL_DURATION_SEC) / 2);
    const done = computeSplashMorphState(SPLASH_TOTAL_DURATION_SEC);

    expect(preExit.phase).toBe('lockin');
    expect(preExit.overlayOpacity).toBe(1);

    expect(midExit.phase).toBe('exit');
    expect(midExit.overlayOpacity).toBeCloseTo(0.5, 2);
    expect(midExit.overlayScale).toBeGreaterThan(1.02);

    expect(done.progress).toBe(1);
    expect(done.overlayOpacity).toBe(0);
    expect(done.overlayScale).toBeCloseTo(1.08, 4);
  });

  it('satisfies monotonic symmetric cubic-bezier easing properties', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 5);
  });
});
