import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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
 * Web First-Time Optical Illusion Onboarding Overlay.
 * Lazily loads the video player chunk ONLY when `visible` is true so initial app bundle size stays untouched.
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

  const backdropStyle = {
    backgroundImage:
      'radial-gradient(circle at 50% 42%, rgba(79, 70, 229, 0.30) 0%, rgba(124, 58, 237, 0.14) 30%, rgba(5, 8, 29, 0.96) 72%), '
      + 'linear-gradient(165deg, rgba(5, 8, 29, 0.96) 0%, rgba(9, 14, 46, 0.97) 100%)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  } as unknown as ViewStyle;

  return (
    <View
      style={[styles.overlay, backdropStyle]}
      accessibilityLabel="Papyrus Onboarding Video"
    >
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

      <View style={styles.center}>
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
    backgroundColor: 'rgba(5, 8, 29, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 66, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.30)',
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  center: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default OnboardingIllusionModal;
