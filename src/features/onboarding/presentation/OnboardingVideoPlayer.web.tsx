import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/shared/AppIcon';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/core/i18n';
import { OnboardingIllusionFallback } from './OnboardingIllusionFallback';

const VIDEO_WEBM = require('../../../../assets/video/onboarding_illusion.webm');
const VIDEO_MP4 = require('../../../../assets/video/onboarding_illusion.mp4');
const VIDEO_POSTER = require('../../../../assets/video/onboarding_poster.webp');

function resolveAssetUri(asset: unknown): string {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object') {
    const rec = asset as { uri?: unknown; default?: unknown };
    if (typeof rec.uri === 'string') return rec.uri;
    if (typeof rec.default === 'string') return rec.default;
  }
  return '';
}

export interface OnboardingVideoPlayerWebProps {
  onComplete: () => void;
  reduceMotion?: boolean;
}

/**
 * Borderless Full-Bleed Cinema Onboarding Video Player.
 * - Attempts unmuted autoplay first; gracefully falls back to muted + 1-tap sound button only when blocked.
 * - Zero outer borders, frames, or extra bottom bars.
 * - Auto-navigates directly into Home immediately when the video finishes.
 */
export default function OnboardingVideoPlayerWeb({
  onComplete,
  reduceMotion = false,
}: OnboardingVideoPlayerWebProps) {
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const isVi = language === 'vi';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canPlayRef = useRef(false);
  const completedRef = useRef(false);

  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  const webmUri = resolveAssetUri(VIDEO_WEBM);
  const mp4Uri = resolveAssetUri(VIDEO_MP4);
  const posterUri = resolveAssetUri(VIDEO_POSTER);

  const finishOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Prioritize unmuted autoplay first; fall back to muted autoplay only if browser blocks audio
  useEffect(() => {
    if (reduceMotion) return;
    const video = videoRef.current;
    if (!video) return;

    let active = true;
    video.muted = false;
    video
      .play()
      .then(() => {
        if (active) setMuted(false);
      })
      .catch(() => {
        if (!active || !video) return;
        video.muted = true;
        setMuted(true);
        void video.play().catch(() => {
          if (active) setFailed(true);
        });
      });

    return () => {
      active = false;
    };
  }, [reduceMotion]);

  // Slow-network guard
  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setTimeout(() => {
      if (!canPlayRef.current) {
        setFailed(true);
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  // Strict GPU / media decoder cleanup on unmount
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      try {
        video.pause();
        video.removeAttribute('src');
        const sources = video.querySelectorAll('source');
        sources.forEach((s) => s.removeAttribute('src'));
        video.load();
      } catch {
        // Ignore cleanup edge cases on detached nodes.
      }
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    setMuted((prev) => {
      const next = !prev;
      if (video) {
        video.muted = next;
        if (video.paused && !video.ended) {
          void video.play().catch(() => undefined);
        }
      }
      return next;
    });
  }, []);

  if (reduceMotion || failed || (!webmUri && !mp4Uri)) {
    return <OnboardingIllusionFallback onComplete={finishOnce} reduceMotion={reduceMotion} />;
  }

  const glassPillStyle = {
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  } as unknown as ViewStyle;

  return (
    <View style={styles.fullBleed}>
      <video
        ref={videoRef}
        autoPlay
        muted={muted}
        playsInline
        preload="auto"
        poster={posterUri || undefined}
        onCanPlay={() => {
          canPlayRef.current = true;
        }}
        onPlaying={() => {
          canPlayRef.current = true;
        }}
        onEnded={finishOnce}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100dvh',
          objectFit: 'contain',
          display: 'block',
          backgroundColor: '#05081D',
        }}
      >
        {webmUri ? <source src={webmUri} type="video/webm" /> : null}
        {mp4Uri ? <source src={mp4Uri} type="video/mp4" /> : null}
      </video>

      {/* Minimal Floating Audio Control */}
      <Pressable
        onPress={handleToggleMute}
        accessibilityRole="button"
        accessibilityLabel={muted ? (isVi ? 'Bật âm thanh' : 'Unmute audio') : (isVi ? 'Tắt âm thanh' : 'Mute audio')}
        style={({ pressed }) => [
          styles.audioPill,
          glassPillStyle,
          { top: Math.max(16, insets.top + 12), opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <AppIcon
          name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
          size={16}
          color="#F8FAFC"
        />
        {muted ? (
          <Text style={styles.audioPillText}>{isVi ? 'Bật âm thanh' : 'Tap for sound'}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fullBleed: {
    width: '100%',
    height: '100%',
    backgroundColor: '#05081D',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  audioPill: {
    position: 'absolute',
    left: 18,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 10, 36, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(224, 231, 255, 0.25)',
  },
  audioPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
});
