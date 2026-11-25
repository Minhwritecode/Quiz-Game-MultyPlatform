import { AssistantWidget } from '@/features/assistant/presentation/AssistantWidget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dependencies } from '@/composition/dependencies';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { useOnboardingStore } from '@/core/state/useOnboardingStore';
import { useRouteRefreshStore } from '@/core/state/useRouteRefreshStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useCommunityStore } from '@/features/community/state/useCommunityStore';
import { wrapRoot, reportFailure } from '@/core/observability/monitoring';
import { ReleaseGate } from '@/shared/ReleaseGate';
import { AppUpdateBanner } from '@/shared/AppUpdateBanner';
import { InAppNotificationBanner } from '@/shared/InAppNotificationBanner';
import { Button, Card, Screen } from '@/shared/ui';
import { PapyrusMorphLoader } from '@/shared/PapyrusLoader';
import { PapyrusSplash3D } from '@/shared/visuals/PapyrusSplash3D';
import { OnboardingIllusionModal } from '@/features/onboarding/presentation/OnboardingIllusionModal';
import {
  dispatchExternalNotification,
  registerScholarPresence,
  subscribeCommunityRealtime,
  subscribeRealtimeAdminGifts,
  touchCurrentDeviceSession,
} from '@/composition/platform';
import { useNotificationStore } from '@/features/notifications/state/useNotificationStore';
import { palettes, spacing } from '@/core/theme/tokens';
import { sfx } from '@/core/audio/sfx';

const PRIMARY_TAB_PATHS = new Set([
  '/',
  '/sets',
  '/community',
  '/battle',
  '/leaderboard',
  '/friends',
  '/profile',
  '/settings',
]);

function isAppActivelyForegrounded(): boolean {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return document.visibilityState === 'visible' && document.hasFocus();
  }
  return AppState.currentState === 'active';
}

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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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
  const isDark = scheme === 'dark';
  const activeBg = isDark ? palettes.dark.paper : palettes.light.paper;
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [systemMotion, setSystemMotion] = useState(false);
  const [splashDone, setSplashDone] = useState(process.env.NODE_ENV === 'test');
  const [navLoadingActive, setNavLoadingActive] = useState(false);
  const prevPathRef = useRef(pathname);

  // Track global Online/Offline state so PapyrusPageSkeleton renders ONLY on weak/offline network
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onUp = () => useRouteRefreshStore.getState().setOnline(true);
    const onDown = () => useRouteRefreshStore.getState().setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemMotion);
    return () => listener.remove();
  }, []);

  // STRICT SEPARATION: Tab & Route transitions use ONLY the sleek Astral Prism Loader (NEVER Skeleton!)
  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || !splashDone) {
      prevPathRef.current = pathname;
      return;
    }
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev !== pathname && PRIMARY_TAB_PATHS.has(pathname)) {
      setNavLoadingActive(true);
      const t = setTimeout(() => setNavLoadingActive(false), 185);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pathname, splashDone]);

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

  // Per-account isolation + Cloud hydration + Active Device Session check
  useEffect(() => {
    usePapyrusStore.getState().switchAccountScope(authScope);
    useStreakStore.getState().switchAccountScope(authScope);
    useMembershipStore.getState().switchAccountScope(authScope);

    if (authUser?.id && process.env.NODE_ENV !== 'test') {
      void usePapyrusStore.getState().hydrateCloudProfile();
      void useStreakStore.getState().hydrateFromCloud();
      void useMembershipStore.getState().hydrateFromCloud();
      void touchCurrentDeviceSession().then((res) => {
        if (res.revoked) {
          useAuthStore.getState().clear();
          void dependencies.auth.signOut();
          router.replace('/auth');
        }
      });
    }
  }, [authScope, authUser?.id, router]);

  // Live Community Realtime Sync + Smart Sound/Banner Policy:
  // - Outgoing messages: silent.
  // - Incoming message/notification while OUTSIDE app (backgrounded): play chime + OS push.
  // - Incoming message/notification while INSIDE app on another screen: NO sound, drop down sleek banner!
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    return subscribeCommunityRealtime((ev) => {
      const store = useCommunityStore.getState();
      if (ev.type === 'new-post') {
        store.ingestRealtimePost(ev.post);
      } else if (ev.type === 'new-story') {
        store.ingestRealtimeStory(ev.story);
      } else if (ev.type === 'new-message') {
        store.ingestRealtimeMessage(ev.message);
        const myId = useAuthStore.getState().user?.id ?? 'guest';
        if (ev.message.senderId === myId) return;

        const foreground = isAppActivelyForegrounded();
        const onCommunity = pathnameRef.current.startsWith('/community');
        if (!foreground) {
          sfx.playIncomingAlert();
          void dispatchExternalNotification(
            `💬 Tin nhắn mới từ ${ev.message.senderName}`,
            ev.message.text.slice(0, 120)
          );
        } else if (!onCommunity) {
          // Inside app on another tab -> silent drop-down banner!
          useRouteRefreshStore.getState().showDropBanner({
            kind: 'message',
            title: `💬 ${ev.message.senderName}`,
            body: ev.message.text,
            actionRoute: '/community',
            actionParams: { tab: 'messenger' },
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    registerScholarPresence(authUser, eloRating, totalScore);
  }, [authUser, eloRating, totalScore]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (pathname.startsWith('/admin') || authUser?.role === 'admin' || authUser?.role === 'superadmin') {
      return;
    }
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
            if (!authUser?.id) return;
            useNotificationStore.getState().pushNotification(
              { recipientId: authUser.id, kind: 'streak', title, body, actionRoute: '/' },
              !isAppActivelyForegrounded()
            );
          }
        );
      })
      .catch(() => {
        void dependencies.reminders.checkAndTouchActivity();
      });

    if (!authUser?.id) return () => { active = false; };

    void useNotificationStore.getState().syncCloudGifts(authUser.id);
    const unsubscribeGifts = subscribeRealtimeAdminGifts(
      authUser.id,
      (gift) => {
        if (window?.location?.pathname?.startsWith?.('/admin')) return;
        void useNotificationStore.getState().syncCloudGifts(authUser.id);
        const foreground = isAppActivelyForegrounded();
        useNotificationStore.getState().pushNotification(
          {
            recipientId: authUser.id,
            kind: 'gift',
            title: `🎁 Quà mới từ Admin: ${gift.title}`,
            body: gift.message,
            actionRoute: '/profile',
          },
          !foreground
        );
        if (!foreground) {
          sfx.playIncomingAlert();
        } else if (!pathnameRef.current.startsWith('/profile')) {
          useRouteRefreshStore.getState().showDropBanner({
            kind: 'gift',
            title: `🎁 Quà tặng mới: ${gift.title}`,
            body: gift.message || 'Chạm để mở Kho quà trên Trang cá nhân!',
            actionRoute: '/profile',
          });
        }
      },
      (notif) => {
        if (window?.location?.pathname?.startsWith?.('/admin')) return;
        const foreground = isAppActivelyForegrounded();
        useNotificationStore.getState().pushNotification(
          {
            recipientId: notif.recipientId,
            kind: notif.kind,
            title: notif.title,
            body: notif.body,
            actionRoute: notif.actionRoute ?? '/',
          },
          !foreground
        );
        if (!foreground) {
          sfx.playIncomingAlert();
        } else {
          useRouteRefreshStore.getState().showDropBanner({
            kind: 'notification',
            title: notif.title,
            body: notif.body,
            actionRoute: notif.actionRoute ?? '/',
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribeGifts();
    };
  }, [authUser?.id, authUser?.role, pathname, questionSets.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!splashDone || authStatus !== 'authenticated' || !authUser?.id) return;
    void checkOnboardingForUser(authUser.id);
  }, [authStatus, authUser?.id, checkOnboardingForUser, splashDone]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: activeBg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={[styles.rootContainer, { backgroundColor: activeBg }]}>
            <ReleaseGate>
              <Suspense
                fallback={
                  <View style={[styles.suspenseWrap, { backgroundColor: activeBg }]}>
                    <PapyrusMorphLoader label="Đang mở trang…" />
                  </View>
                }
              >
                <Stack
                  key={authScope}
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: activeBg },
                    animation: reduceMotion || systemMotion ? 'none' : 'fade',
                  }}
                />
              </Suspense>

              {/* Sleek Astral Prism Page/Tab Loader Overlay (strictly separated from network skeletons) */}
              {navLoadingActive && (
                <View
                  pointerEvents="none"
                  style={[styles.navOverlay, { backgroundColor: 'rgba(6, 10, 36, 0.42)' }]}
                >
                  <PapyrusMorphLoader compact />
                </View>
              )}

              <InAppNotificationBanner />
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
  suspenseWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  navOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
