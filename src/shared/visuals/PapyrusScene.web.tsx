import { lazy, Suspense, useEffect, useState } from 'react';
import { View } from 'react-native';
import PapyrusSceneFallback from './PapyrusSceneFallback';

const PapyrusCanvas = lazy(() => import('./PapyrusCanvas.web'));

function supportsWebGL2() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export default function PapyrusScene({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    const browserPrefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return !reduceMotion && !browserPrefersReducedMotion && supportsWebGL2();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setReady(!reduceMotion && !e.matches && supportsWebGL2());
    };
    mql?.addEventListener?.('change', handler);
    return () => mql?.removeEventListener?.('change', handler);
  }, [reduceMotion]);

  return (
    <View
      style={{ flex: 1, minHeight: 260 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {ready ? (
        <Suspense fallback={<PapyrusSceneFallback reduceMotion />}>
          <PapyrusCanvas />
        </Suspense>
      ) : (
        <PapyrusSceneFallback reduceMotion />
      )}
    </View>
  );
}
