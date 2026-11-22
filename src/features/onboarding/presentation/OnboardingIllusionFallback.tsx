import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/core/i18n';
import { ONBOARDING_ACT_SLIDES } from '../domain/onboardingState';

const PAPYRUS_LOGO = require('../../../../assets/icon-ui.webp');

export interface OnboardingIllusionFallbackProps {
  onComplete: () => void;
  reduceMotion?: boolean;
}

/**
 * Lightweight 2D Optical-Illusion 3-Card Fallback.
 * Automatically displayed when Reduce Motion is enabled, video fails to decode,
 * or on ultra-slow connections — guaranteed 0ms interactive paint.
 */
export function OnboardingIllusionFallback({
  onComplete,
}: OnboardingIllusionFallbackProps) {
  const { language } = useI18n();
  const [index, setIndex] = useState(0);
  const slide = ONBOARDING_ACT_SLIDES[index] ?? ONBOARDING_ACT_SLIDES[0]!;
  const isLast = index === ONBOARDING_ACT_SLIDES.length - 1;
  const isVi = language === 'vi';

  const highlights = isVi ? slide.highlightsVi : slide.highlightsEn;

  return (
    <View style={styles.card}>
      {/* Op-Art Concentric Visual Illusion Emblem */}
      <View style={styles.illusionStage} pointerEvents="none">
        <View style={[styles.opRingOuter, { borderColor: `${slide.accent}55` }]} />
        <View style={[styles.opRingMid, { borderColor: 'rgba(124, 58, 237, 0.52)' }]} />
        <View style={[styles.opRingInner, { borderColor: 'rgba(246, 195, 88, 0.56)' }]} />
        <View style={styles.logoFrame}>
          <Image source={PAPYRUS_LOGO} style={styles.logoImg} resizeMode="cover" />
        </View>
      </View>

      <View style={[styles.badge, { borderColor: `${slide.accent}88` }]}>
        <View style={[styles.badgeDot, { backgroundColor: slide.accent }]} />
        <Text style={[styles.badgeText, { color: slide.accent }]}>
          {slide.stepLabel} · {isVi ? slide.badgeVi : slide.badgeEn}
        </Text>
      </View>

      <Text style={styles.title}>{isVi ? slide.titleVi : slide.titleEn}</Text>
      <Text style={styles.body}>{isVi ? slide.bodyVi : slide.bodyEn}</Text>

      <View style={styles.highlights}>
        {highlights.map((item) => (
          <View key={item} style={styles.highlightRow}>
            <Ionicons name="sparkles" size={14} color={slide.accent} />
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Step Indicators */}
      <View style={styles.dots}>
        {ONBOARDING_ACT_SLIDES.map((s, idx) => (
          <Pressable
            key={s.id}
            onPress={() => setIndex(idx)}
            accessibilityRole="button"
            accessibilityLabel={`Step ${idx + 1}`}
            style={[
              styles.dot,
              idx === index && [styles.dotActive, { backgroundColor: slide.accent }],
            ]}
          />
        ))}
      </View>

      {/* Action Row */}
      <View style={styles.actions}>
        {index > 0 ? (
          <Pressable
            onPress={() => setIndex((prev) => Math.max(0, prev - 1))}
            accessibilityRole="button"
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>{isVi ? 'Quay lại' : 'Back'}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => (isLast ? onComplete() : setIndex((prev) => prev + 1))}
          accessibilityRole="button"
          style={[styles.primaryBtn, { flex: 1 }]}
        >
          <Text style={styles.primaryBtnText}>
            {isLast
              ? isVi
                ? 'Bắt đầu học ngay'
                : 'Start Learning Now'
              : isVi
                ? 'Tiếp theo'
                : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#060A24" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 28,
    padding: 24,
    backgroundColor: 'rgba(11, 16, 48, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    alignItems: 'center',
  },
  illusionStage: {
    width: 152,
    height: 152,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  opRingOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 38,
    borderWidth: 1.5,
    transform: [{ rotate: '14deg' }],
  },
  opRingMid: {
    position: 'absolute',
    width: 122,
    height: 122,
    borderRadius: 32,
    borderWidth: 1.5,
    transform: [{ rotate: '-10deg' }],
  },
  opRingInner: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 26,
    borderWidth: 1.25,
    transform: [{ rotate: '6deg' }],
  },
  logoFrame: {
    width: 82,
    height: 82,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(246, 195, 88, 0.72)',
    backgroundColor: '#060A24',
  },
  logoImg: {
    width: 82,
    height: 82,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 66, 0.78)',
    borderWidth: 1,
    marginBottom: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  body: {
    fontSize: 13.5,
    color: '#C7D2FE',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  highlights: {
    width: '100%',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 10, 36, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(199, 210, 254, 0.25)',
  },
  dotActive: {
    width: 24,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  secondaryBtn: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.28)',
    backgroundColor: 'rgba(15, 23, 66, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  primaryBtn: {
    minHeight: 46,
    minWidth: 150,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#F6C358',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#060A24',
  },
});

export default OnboardingIllusionFallback;
