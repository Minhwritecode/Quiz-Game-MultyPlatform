import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/core/i18n';
import { OnboardingIllusionFallback } from './OnboardingIllusionFallback';

const LazyVideoPlayer = lazy(() => import('./OnboardingVideoPlayer.web'));

export interface OnboardingIllusionModalProps {
  visible: boolean;
  reduceMotion?: boolean;
  onClose: () => void;
}

/**
 * Full-bleed borderless Web First-Time Onboarding Cinema Overlay.
 * Auto-advances straight to Home when video finishes.
 */
export function OnboardingIllusionModal({
  visible,
  reduceMotion = false,
  onClose,
}: OnboardingIllusionModalProps) {
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const [browserReduceMotion, setBrowserReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !visible) return;
    let active = true;
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const prefersReduced = mql?.matches ?? false;
    void Promise.resolve().then(() => {
      if (active) setBrowserReduceMotion(prefersReduced);
    });
    const handler = (event: MediaQueryListEvent) => {
      if (active) setBrowserReduceMotion(event.matches);
    };
    mql?.addEventListener?.('change', handler);
    return () => {
      active = false;
      mql?.removeEventListener?.('change', handler);
    };
  }, [visible]);

  if (!visible || process.env.NODE_ENV === 'test') {
    return null;
  }

  const effectiveReduceMotion = reduceMotion || browserReduceMotion;

  return (
    <View style={styles.overlay} accessibilityLabel="Papyrus Onboarding Video">
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={language === 'vi' ? 'Bỏ qua giới thiệu' : 'Skip intro'}
        style={({ pressed }) => [
          styles.skipBtn,
          { top: Math.max(16, insets.top + 12), opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={styles.skipText}>{language === 'vi' ? 'Bỏ qua' : 'Skip'}</Text>
      </Pressable>

      <View style={styles.fullStage}>
        {effectiveReduceMotion ? (
          <OnboardingIllusionFallback onComplete={onClose} reduceMotion />
        ) : (
          <Suspense fallback={<OnboardingIllusionFallback onComplete={onClose} />}>
            <LazyVideoPlayer onComplete={onClose} reduceMotion={effectiveReduceMotion} />
          </Suspense>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9990,
    backgroundColor: '#05081D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    position: 'absolute',
    right: 18,
    zIndex: 30,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 10, 36, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(224, 231, 255, 0.25)',
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  fullStage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OnboardingIllusionModal;
