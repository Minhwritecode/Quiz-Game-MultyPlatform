import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useI18n } from '@/core/i18n';
import {
  ONBOARDING_ACT_SLIDES,
  ONBOARDING_VIDEO_DURATION_SEC,
  resolveOnboardingActIndex,
} from '../domain/onboardingState';
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

interface WebProgressNode {
  style?: {
    transform?: string;
  };
}

export interface OnboardingVideoPlayerWebProps {
  onComplete: () => void;
  reduceMotion?: boolean;
}

/**
 * Lazy-loaded HTML5 Spatial Cinema Video Player for Web.
 * - Uses WebM (VP9) first, MP4 (H.264 faststart) second, plus <40KB WebP poster (0ms black screen).
 * - Zero React re-renders during playback: progress bar scaleX updates via direct DOM ref.
 * - Automatically falls back to <OnboardingIllusionFallback> on decode error or slow network timeout.
 * - Releases hardware video decoder memory strictly on unmount.
 */
export default function OnboardingVideoPlayerWeb({
  onComplete,
  reduceMotion = false,
}: OnboardingVideoPlayerWebProps) {
  const { language } = useI18n();
  const isVi = language === 'vi';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressFillRef = useRef<WebProgressNode | null>(null);

  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actIndex, setActIndex] = useState<0 | 1 | 2>(0);
  const canPlayRef = useRef(false);

  const webmUri = resolveAssetUri(VIDEO_WEBM);
  const mp4Uri = resolveAssetUri(VIDEO_MP4);
  const posterUri = resolveAssetUri(VIDEO_POSTER);

  // Slow-network / unsupported-codec guard: switch smoothly to 2D illusion cards if video stalls > 4.5s
  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setTimeout(() => {
      if (!canPlayRef.current) {
        setFailed(true);
      }
    }, 4500);
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

  // Zero-rerender progress bar sync via requestAnimationFrame while playing
  useEffect(() => {
    if (failed || reduceMotion) return;
    let rafId = 0;

    const syncProgress = () => {
      const video = videoRef.current;
      if (video) {
        const dur =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : ONBOARDING_VIDEO_DURATION_SEC;
        const ratio = Math.max(0.02, Math.min(1, video.currentTime / dur));
        const style = progressFillRef.current?.style;
        if (style) {
          style.transform = `scaleX(${ratio.toFixed(4)})`;
        }
        const nextAct = resolveOnboardingActIndex(video.currentTime);
        setActIndex((prev) => (prev === nextAct ? prev : nextAct));
      }
      rafId = window.requestAnimationFrame(syncProgress);
    };

    rafId = window.requestAnimationFrame(syncProgress);
    return () => window.cancelAnimationFrame(rafId);
  }, [failed, reduceMotion]);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    setMuted((prev) => {
      const next = !prev;
      if (video) {
        video.muted = next;
        if (!next && video.paused && !video.ended) {
          void video.play().catch(() => undefined);
        }
      }
      return next;
    });
  }, []);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setEnded(false);
    setActIndex(0);
    void video.play().catch(() => undefined);
  }, []);

  if (reduceMotion || failed || (!webmUri && !mp4Uri)) {
    return <OnboardingIllusionFallback onComplete={onComplete} reduceMotion={reduceMotion} />;
  }

  const currentSlide = ONBOARDING_ACT_SLIDES[actIndex] ?? ONBOARDING_ACT_SLIDES[0]!;

  const glassPillStyle = {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  } as unknown as ViewStyle;

  const progressFillWeb = {
    width: '100%',
    transformOrigin: 'left center',
    transform: 'scaleX(0.02)',
    willChange: 'transform',
    backgroundImage: 'linear-gradient(90deg, #6366F1 0%, #D946EF 52%, #F6C358 100%)',
  } as unknown as ViewStyle;

  return (
    <View style={styles.theaterCard}>
      {/* Square 1:1 Spatial Video Stage — optimal on both Mobile & Desktop Web */}
      <View style={styles.videoFrame}>
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          preload="metadata"
          poster={posterUri || undefined}
          onCanPlay={() => {
            canPlayRef.current = true;
            const v = videoRef.current;
            if (v && v.paused && !ended) {
              void v.play().catch(() => undefined);
            }
          }}
          onPlaying={() => {
            canPlayRef.current = true;
          }}
          onEnded={() => {
            setEnded(true);
            setActIndex(2);
          }}
          onError={() => setFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            backgroundColor: '#05081D',
          }}
        >
          {webmUri ? <source src={webmUri} type="video/webm" /> : null}
          {mp4Uri ? <source src={mp4Uri} type="video/mp4" /> : null}
        </video>

        {/* Top-left Audio Mute/Unmute Glass Pill */}
        <Pressable
          onPress={handleToggleMute}
          accessibilityRole="button"
          accessibilityLabel={muted ? (isVi ? 'Bật âm thanh' : 'Unmute audio') : (isVi ? 'Tắt âm thanh' : 'Mute audio')}
          style={({ pressed }) => [
            styles.audioPill,
            glassPillStyle,
            { opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Ionicons
            name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
            size={15}
            color="#E0E7FF"
          />
          <Text style={styles.audioPillText}>
            {muted ? (isVi ? 'Bật tiếng' : 'Unmute') : (isVi ? 'Đang bật tiếng' : 'Sound on')}
          </Text>
        </Pressable>

        {/* Top-right Act indicator */}
        <View style={[styles.actPill, glassPillStyle]} pointerEvents="none">
          <View style={[styles.actDot, { backgroundColor: currentSlide.accent }]} />
          <Text style={styles.actPillText}>
            {currentSlide.stepLabel} · {isVi ? currentSlide.badgeVi : currentSlide.badgeEn}
          </Text>
        </View>
      </View>

      {/* GPU-composited Progress Track */}
      <View style={styles.progressTrack}>
        <View ref={progressFillRef as never} style={[styles.progressFill, progressFillWeb]} />
      </View>

      {/* Bottom Controls & Primary CTA */}
      <View style={styles.footerRow}>
        <Pressable
          onPress={handleReplay}
          accessibilityRole="button"
          accessibilityLabel={isVi ? 'Xem lại video' : 'Replay video'}
          style={({ pressed }) => [styles.replayBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="refresh-outline" size={18} color="#C7D2FE" />
          <Text style={styles.replayText}>{isVi ? 'Xem lại' : 'Replay'}</Text>
        </Pressable>

        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.ctaBtn,
            ended && styles.ctaBtnPulse,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>
            {isVi ? 'Bắt đầu học ngay' : 'Start Learning Now'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#060A24" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  theaterCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 28,
    padding: 14,
    backgroundColor: 'rgba(10, 14, 44, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#05081D',
    position: 'relative',
  },
  audioPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.28)',
  },
  audioPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#E0E7FF',
  },
  actPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 10, 36, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.24)',
  },
  actDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(199, 210, 254, 0.16)',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  replayBtn: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.26)',
    backgroundColor: 'rgba(15, 23, 66, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replayText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#C7D2FE',
  },
  ctaBtn: {
    flex: 1,
    minWidth: 170,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#F6C358',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaBtnPulse: {
    backgroundColor: '#FDE68A',
  },
  ctaText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#060A24',
  },
});
