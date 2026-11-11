import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dependencies } from '@/composition/dependencies';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';
import { wrapRoot, reportFailure } from '@/core/observability/monitoring';
import { ReleaseGate } from '@/shared/ReleaseGate';
import { Button, Card, Screen } from '@/shared/ui';

export function ErrorBoundary({error,retry}:ErrorBoundaryProps) {
  useEffect(()=>{reportFailure(error,'startup');},[error]);
  return <SafeAreaProvider><Screen><Card>
    <Text>Không mở được màn hình này. Dữ liệu đã lưu vẫn được giữ lại.</Text>
    <Button onPress={()=>void retry()}>Thử lại / Retry</Button>
  </Card></Screen></SafeAreaProvider>;
}

function SplashScreenOverlay({ onFinished }: { onFinished: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Elegant scale in
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 7,
      tension: 45,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Smooth linear loading progress
    Animated.timing(progressAnim, {
      toValue: 180,
      duration: 850,
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.04,
          duration: 350,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(() => {
        onFinished();
      });
    }, 1050);

    return () => {
      clearTimeout(timer);
    };
  }, [fadeAnim, scaleAnim, progressAnim, onFinished]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.splashContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          zIndex: 99999,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.splashContent}>
        {/* Minimalist Vector Emblem */}
        <View style={styles.brandMarkOuter}>
          <Ionicons name="bookmarks" size={44} color="#818CF8" />
          <View style={styles.sparkBadge}>
            <Ionicons name="flash" size={14} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.splashBrand}>P A P Y R U S</Text>
        <Text style={styles.splashSlogan}>Nền tảng Ôn tập & Đấu trường Trí tuệ</Text>

        {/* Minimalist Progress Track */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressAnim }]} />
        </View>
      </View>

      <View style={styles.splashFooter}>
        <Text style={styles.footerText}>v{dependencies.release.version} • Offline-First Cross-Platform</Text>
      </View>
    </Animated.View>
  );
}

function RootLayout() {
  const scheme = useColorScheme();
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }), []);
  const hydrateQuestionSets = usePapyrusStore((state) => state.hydrateQuestionSets);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    void hydrateQuestionSets(dependencies.questionSets.list).catch(error=>reportFailure(error,'startup'));
    void bootstrapAuth(dependencies.auth).catch(error=>reportFailure(error,'startup'));
  }, [bootstrapAuth, hydrateQuestionSets]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.rootContainer}>
          <ReleaseGate><Stack screenOptions={{ headerShown: false, animation: 'fade' }} /></ReleaseGate>
          {showSplash && <SplashScreenOverlay onFinished={() => setShowSplash(false)} />}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  splashContainer: {
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandMarkOuter: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    position: 'relative',
  },
  sparkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashBrand: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  splashSlogan: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  progressTrack: {
    width: 180,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 28,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  splashFooter: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
