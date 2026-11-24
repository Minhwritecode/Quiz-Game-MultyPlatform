import { AssistantWidget } from '@/features/assistant/presentation/AssistantWidget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dependencies } from '@/composition/dependencies';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useOnboardingStore } from '@/core/state/useOnboardingStore';
import { wrapRoot, reportFailure } from '@/core/observability/monitoring';
import { ReleaseGate } from '@/shared/ReleaseGate';
import { AppUpdateBanner } from '@/shared/AppUpdateBanner';
import { Button, Card, Screen } from '@/shared/ui';
import { PapyrusSplash3D } from '@/shared/visuals/PapyrusSplash3D';
import { OnboardingIllusionModal } from '@/features/onboarding/presentation/OnboardingIllusionModal';
import {
  registerScholarPresence,
  subscribeRealtimeAdminGifts,
} from '@/composition/platform';
import { useNotificationStore } from '@/features/notifications/state/useNotificationStore';
import { sfx } from '@/core/audio/sfx';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportFailure(error, 'startup');
  }, [error]);
  return (
    <SafeAreaProvider>
      <Screen>
        <Card>
          <Text>Không mở được màn hình này. Dữ liệu đã lưu vẫn được giữ lại.</Text>
          <Button onPress={() => void retry()}>Thử lại / Retry</Button>
        </Card>
      </Screen>
    </SafeAreaProvider>
  );
}

function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const guestEntered = useAuthStore((s) => s.guestEntered);
  const authScope = authUser?.id ?? 'guest';
  const onboardingVisible = useOnboardingStore((s) => s.visible);
  const checkOnboardingForUser = useOnboardingStore((s) => s.checkAndTriggerForUser);
  const dismissOnboarding = useOnboardingStore((s) => s.dismiss);
  useEffect(() => dependencies.reminders.listen(() => router.push('/sets')), [router]);
  const systemScheme = useColorScheme();
  const theme = usePapyrusStore((s) => s.theme);
  const scheme = theme === 'system' ? systemScheme : theme;
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [systemMotion, setSystemMotion] = useState(false);
  const [splashDone, setSplashDone] = useState(process.env.NODE_ENV === 'test');
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemMotion);
    return () => listener.remove();
  }, []);
  const queryClient = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
    []
  );
  useEffect(() => dependencies.learning.start(), []);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const bgmMuted = usePapyrusStore((state) => state.bgmMuted);
  const eloRating = usePapyrusStore((state) => state.eloRating);
  const totalScore = usePapyrusStore((state) => state.totalScore);
  const questionSets = usePapyrusStore((state) => state.questionSets);

  // 1. Live Online Scholar Directory Presence (enables instant real-user friend discovery across devices)
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    registerScholarPresence(authUser, eloRating, totalScore);
  }, [authUser, eloRating, totalScore]);

  // 2. Duolingo-style 20-Hour Inactivity & Unfinished Lesson Smart Reminder Check + Realtime Admin Push
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    let active = true;

    void dependencies.study
      .listProgress()
      .then((drafts) => {
        if (!active) return;
        const firstDraft = drafts[0];
        const unfinishedSet = firstDraft
          ? questionSets.find((s) => s.id === firstDraft.questionSetId)
          : undefined;
        void dependencies.reminders.checkAndTouchActivity(
          unfinishedSet?.title,
          (title, body) => {
            useNotificationStore.getState().pushNotification(
              { recipientId: authUser?.id ?? 'all', kind: 'streak', title, body, actionRoute: '/' },
              false
            );
          }
        );
      })
      .catch(() => {
        void dependencies.reminders.checkAndTouchActivity();
      });

    if (!authUser?.id) return () => { active = false; };

    void useNotificationStore.getState().syncCloudGifts(authUser.id);
    const unsubscribeGifts = subscribeRealtimeAdminGifts(authUser.id, (gift) => {
      void useNotificationStore.getState().syncCloudGifts(authUser.id);
      useNotificationStore.getState().pushNotification(
        {
          recipientId: authUser.id,
          kind: 'gift',
          title: `🎁 Quà mới từ Admin: ${gift.title}`,
          body: gift.message,
          actionRoute: '/profile',
        },
        true
      );
    });

    return () => {
      active = false;
      unsubscribeGifts();
    };
  }, [authUser?.id, questionSets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sfx.setBgmMuted(bgmMuted);
    if (!bgmMuted) {
      sfx.playBGM();
    } else {
      sfx.stopBGM();
    }
  }, [bgmMuted]);

  useEffect(() => {
    void bootstrapAuth(dependencies.auth).catch((error) => reportFailure(error, 'startup'));
  }, [bootstrapAuth]);

  // Auth-first landing gate:
  // - Returning signed-in users resolve authStatus === 'authenticated' from persisted storage and stay in app.
  // - New unauthenticated visitors land directly on /auth (unless they explicitly entered Guest mode or opened /admin).
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (!splashDone || authStatus !== 'guest' || guestEntered) return;
    const exempt =
      pathname === '/auth' ||
      pathname === '/admin' ||
      pathname === '/privacy';
    if (!exempt) {
      router.replace('/auth');
    }
  }, [splashDone, authStatus, guestEntered, pathname, router]);

  // Show the First-Time Optical Illusion Onboarding Video once after a new user signs in (and after Splash finishes)
  useEffect(() => {
    if (!splashDone || authStatus !== 'authenticated' || !authUser?.id) return;
    void checkOnboardingForUser(authUser.id);
  }, [authStatus, authUser?.id, checkOnboardingForUser, splashDone]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <View style={styles.rootContainer}>
            <ReleaseGate>
              <Stack
                key={authScope}
                screenOptions={{
                  headerShown: false,
                  animation: reduceMotion || systemMotion ? 'none' : 'default',
                }}
              />
              <AssistantWidget />
              <AppUpdateBanner />
            </ReleaseGate>
            {!splashDone ? (
              <PapyrusSplash3D
                reduceMotion={reduceMotion || systemMotion}
                onFinish={() => setSplashDone(true)}
              />
            ) : null}
            <OnboardingIllusionModal
              visible={splashDone && onboardingVisible}
              reduceMotion={reduceMotion || systemMotion}
              onClose={dismissOnboarding}
            />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
});
