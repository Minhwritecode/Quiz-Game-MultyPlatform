import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
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

function RootLayout() {
  const router=useRouter();
  useEffect(()=>dependencies.reminders.listen(()=>router.push('/sets')),[router]);
  const systemScheme = useColorScheme();
  const theme=usePapyrusStore(s=>s.theme);
  const scheme=theme==='system'?systemScheme:theme;
  const reduceMotion=usePapyrusStore(s=>s.reduceMotion);
  const [systemMotion,setSystemMotion]=useState(false);
  useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setSystemMotion);const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setSystemMotion);return ()=>listener.remove();},[]);
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }), []);
  const hydrateQuestionSets = usePapyrusStore((state) => state.hydrateQuestionSets);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);


  useEffect(() => {
    void hydrateQuestionSets(dependencies.questionSets.list).catch(error=>reportFailure(error,'startup'));
    void bootstrapAuth(dependencies.auth).catch(error=>reportFailure(error,'startup'));
  }, [bootstrapAuth, hydrateQuestionSets]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.rootContainer}>
          <ReleaseGate><Stack screenOptions={{ headerShown: false, animation: reduceMotion || systemMotion ? 'none' : 'default' }} /></ReleaseGate>

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
