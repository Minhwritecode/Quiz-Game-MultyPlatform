import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { dependencies } from '@/app/composition/dependencies';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useAuthStore } from '@/core/state/useAuthStore';

export default function RootLayout() {
  const scheme = useColorScheme();
  const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }), []);
  const hydrateQuestionSets = usePapyrusStore((state) => state.hydrateQuestionSets);
  const bootstrapAuth = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void hydrateQuestionSets(dependencies.questionSets.list);
    void bootstrapAuth(dependencies.auth);
  }, [bootstrapAuth, hydrateQuestionSets]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
