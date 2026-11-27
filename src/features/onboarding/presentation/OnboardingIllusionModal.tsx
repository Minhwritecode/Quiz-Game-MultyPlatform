import React, { useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/shared/AppIcon';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useI18n } from '@/core/i18n';
import { OnboardingIllusionFallback } from './OnboardingIllusionFallback';

const VIDEO_MP4 = require('../../../../assets/video/onboarding_illusion.mp4');
const VIDEO_POSTER = require('../../../../assets/video/onboarding_poster.webp');

export interface OnboardingIllusionModalProps {
  visible: boolean;
  reduceMotion?: boolean;
  onClose: () => void;
}

/**
 * Native (iOS / Android) First-Time Optical Illusion Onboarding Overlay.
 * Streams the compact H.264 faststart MP4 directly from local bundle URI inside an inline WebView
 * with instant WebP poster (0ms black screen), Mute/Skip/Replay controls, and automatic fallback
 * to the lightweight 2D Optical-Illusion cards on Reduce Motion or decode failure.
 */
export function OnboardingIllusionModal({
  visible,
  reduceMotion = false,
  onClose,
}: OnboardingIllusionModalProps) {
  const insets = useSafeAreaInsets();
  const { language } = useI18n();
  const isVi = language === 'vi';
  const webviewRef = useRef<{ postMessage: (message: string) => void } | null>(null);
  const [muted, setMuted] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  const mp4Uri = useMemo(() => {
    try {
      return Image.resolveAssetSource(VIDEO_MP4)?.uri ?? '';
    } catch {
      return '';
    }
  }, []);

  const posterUri = useMemo(() => {
    try {
      return Image.resolveAssetSource(VIDEO_POSTER)?.uri ?? '';
    } catch {
      return '';
    }
  }, []);

  const html = useMemo(() => {
    const safeMp4 = JSON.stringify(mp4Uri);
    const safePoster = JSON.stringify(posterUri);
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #05081D; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: cover; display: block; background: #05081D; }
</style>
</head>
<body>
  <video id="v" autoplay muted playsinline webkit-playsinline preload="metadata" poster=${safePoster}>
    <source src=${safeMp4} type="video/mp4" />
  </video>
  <script>
    var v = document.getElementById('v');
    function post(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }
    v.addEventListener('error', function() { post({ type: 'ERROR' }); });
    v.addEventListener('ended', function() { post({ type: 'ENDED' }); });
    window.addEventListener('message', function(e) { handleCmd(e.data); });
    document.addEventListener('message', function(e) { handleCmd(e.data); });
    function handleCmd(raw) {
      try {
        var cmd = JSON.parse(raw);
        if (cmd.type === 'SET_MUTED') {
          v.muted = Boolean(cmd.muted);
          if (!v.muted && v.paused && !v.ended) v.play().catch(function(){});
        } else if (cmd.type === 'REPLAY') {
          v.currentTime = 0;
          v.play().catch(function(){});
        }
      } catch (err) {}
    }
  </script>
</body>
</html>`;
  }, [mp4Uri, posterUri]);

  if (!visible || process.env.NODE_ENV === 'test') {
    return null;
  }

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      webviewRef.current?.postMessage(JSON.stringify({ type: 'SET_MUTED', muted: next }));
      return next;
    });
  };

  const replay = () => {
    webviewRef.current?.postMessage(JSON.stringify({ type: 'REPLAY' }));
  };

  const showFallback = reduceMotion || videoFailed || !mp4Uri;

  return (
    <View style={styles.overlay} accessibilityLabel="Papyrus Onboarding Video">
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={isVi ? 'Bỏ qua giới thiệu' : 'Skip intro'}
        style={({ pressed }) => [
          styles.skipBtn,
          { top: Math.max(16, insets.top + 12), opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <Text style={styles.skipText}>{isVi ? 'Bỏ qua' : 'Skip'}</Text>
      </Pressable>

      <View style={styles.center}>
        {showFallback ? (
          <OnboardingIllusionFallback onComplete={onClose} reduceMotion={reduceMotion} />
        ) : (
          <View style={styles.theaterCard}>
            <View style={styles.videoFrame}>
              <WebView
                ref={webviewRef as never}
                originWhitelist={['*']}
                allowFileAccess
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                scrollEnabled={false}
                bounces={false}
                source={{ html }}
                style={styles.webview}
                onError={() => setVideoFailed(true)}
                onMessage={(event: { nativeEvent: { data: string } }) => {
                  try {
                    const msg = JSON.parse(event.nativeEvent.data) as { type?: string };
                    if (msg.type === 'ERROR') setVideoFailed(true);
                  } catch {
                    // Ignore malformed WebView messages.
                  }
                }}
              />

              <Pressable
                onPress={toggleMute}
                accessibilityRole="button"
                style={styles.audioPill}
              >
                <AppIcon
                  name={muted ? 'volume-mute-outline' : 'volume-high-outline'}
                  size={15}
                  color="#E0E7FF"
                />
                <Text style={styles.audioPillText}>
                  {muted ? (isVi ? 'Bật tiếng' : 'Unmute') : (isVi ? 'Đang bật tiếng' : 'Sound on')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Pressable onPress={replay} accessibilityRole="button" style={styles.replayBtn}>
                <AppIcon name="refresh-outline" size={18} color="#C7D2FE" />
                <Text style={styles.replayText}>{isVi ? 'Xem lại' : 'Replay'}</Text>
              </Pressable>
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.ctaBtn}>
                <Text style={styles.ctaText}>
                  {isVi ? 'Bắt đầu học ngay' : 'Start Learning Now'}
                </Text>
                <AppIcon name="arrow-forward" size={16} color="#060A24" />
              </Pressable>
            </View>
          </View>
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
  theaterCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 28,
    padding: 14,
    backgroundColor: 'rgba(10, 14, 44, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.34)',
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#05081D',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#05081D',
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
    backgroundColor: 'rgba(6, 10, 36, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(199, 210, 254, 0.28)',
  },
  audioPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#E0E7FF',
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
    minWidth: 165,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#F6C358',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#060A24',
  },
});

export default OnboardingIllusionModal;
