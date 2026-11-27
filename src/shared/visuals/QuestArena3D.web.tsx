import { lazy, Suspense, useEffect, useState } from 'react';
import { View } from 'react-native';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { QuestArena3DFallback } from './QuestArenaFallback';

const QuestArenaCanvas = lazy(() => import('./QuestArenaCanvas.web'));

function supportsWebGL2() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}

export default function QuestArena3D({ height = 220 }: { height?: number; interactive3D?: boolean }) {
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    return !reduceMotion && !prefersReduced && supportsWebGL2();
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
    <View style={{ width: '100%', height, overflow: 'hidden' }}>
      {ready ? (
        <Suspense fallback={<QuestArena3DFallback height={height} reduceMotion={reduceMotion} />}>
          <QuestArenaCanvas />
        </Suspense>
      ) : (
        <QuestArena3DFallback height={height} reduceMotion={reduceMotion} />
      )}
    </View>
  );
}
