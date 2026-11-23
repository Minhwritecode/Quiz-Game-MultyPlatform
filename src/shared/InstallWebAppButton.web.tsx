import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/core/i18n';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from '@/shared/ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type NavigatorWithInstall = Navigator & {
  install?: () => Promise<void>;
  standalone?: boolean;
};

function detectWebInstallSupport(): boolean {
  if (typeof Navigator === 'undefined') return false;
  return typeof (Navigator.prototype as NavigatorWithInstall).install === 'function';
}

function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithInstall) : undefined;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches || nav?.standalone === true
  );
}

export const InstallWebAppButton = memo(function InstallWebAppButton() {
  const palette = usePalette();
  const { language } = useI18n();
  const [supportsWebInstall] = useState(detectWebInstallSupport);
  const [hiddenAfterInstall, setHiddenAfterInstall] = useState(detectStandaloneMode);
  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setHasDeferredPrompt(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setHasDeferredPrompt(false);
      setHiddenAfterInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (installing) return;
    setInstalling(true);
    setStatusMessage('');

    try {
      const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithInstall) : undefined;
      if (supportsWebInstall && nav?.install) {
        // Call directly inside the click handler to preserve transient user activation.
        await nav.install();
        setStatusMessage(language === 'vi' ? 'Đã cài đặt hoặc mở Papyrus.' : 'Papyrus installed or opened.');
        setHiddenAfterInstall(true);
      } else if (deferredPromptRef.current) {
        // Save and clear the single-use event before awaiting the user's choice.
        const promptEvent = deferredPromptRef.current;
        deferredPromptRef.current = null;
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setStatusMessage(language === 'vi' ? 'Đã cài đặt Papyrus.' : 'Papyrus installed.');
          setHiddenAfterInstall(true);
        } else {
          setStatusMessage(language === 'vi' ? 'Đã hủy cài đặt.' : 'Installation canceled.');
        }
        if (!deferredPromptRef.current) {
          setHasDeferredPrompt(false);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusMessage(language === 'vi' ? 'Đã hủy cài đặt.' : 'Installation canceled.');
      } else {
        setStatusMessage(
          language === 'vi' ? 'Không thể bắt đầu cài đặt.' : 'Could not start installation.'
        );
      }
    } finally {
      setInstalling(false);
    }
  }, [installing, language, supportsWebInstall]);

  const canInstall = !hiddenAfterInstall && (supportsWebInstall || hasDeferredPrompt);
  if (!canInstall && !statusMessage) return null;

  return (
    <View style={styles.wrap}>
      {canInstall ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === 'vi' ? 'Cài ứng dụng Papyrus' : 'Install Papyrus app'}
          accessibilityState={{ disabled: installing }}
          onPress={() => void handleInstall()}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: palette.indigoTint,
              borderColor: palette.indigo,
              opacity: installing ? 0.65 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="download-outline" size={15} color={palette.indigoDeep} />
          <Text style={[typography.caption, { color: palette.indigoDeep, fontWeight: '800' }]}>
            {language === 'vi' ? 'Cài App' : 'Install App'}
          </Text>
        </Pressable>
      ) : null}
      {statusMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typography.caption, { color: palette.inkMuted }]}
        >
          {statusMessage}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
