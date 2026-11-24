import { lazy, Suspense, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { AuthVisualMode } from './AuthCosmicCanvas.web';
import { Model3DErrorBoundary } from '../Model3DErrorBoundary';

const LazyAuthCanvas = lazy(() => import('./AuthCosmicCanvas.web'));

function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function AuthCosmicBackdrop({ mode, reduceMotion = false }: { mode: AuthVisualMode; reduceMotion?: boolean }) {
  const [ok] = useState(hasWebGL);
  const bgGradient =
    mode === 'signUp'
      ? 'radial-gradient(circle at 20% 15%, rgba(16,185,129,0.28), transparent 52%), radial-gradient(circle at 80% 75%, rgba(245,158,11,0.24), transparent 55%), linear-gradient(160deg, #060A24 0%, #0E173B 52%, #081229 100%)'
      : mode === 'forgot' || mode === 'resetPassword'
      ? 'radial-gradient(circle at 25% 15%, rgba(6,182,212,0.28), transparent 52%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.25), transparent 55%), linear-gradient(160deg, #060A24 0%, #10193E 52%, #0B112B 100%)'
      : 'radial-gradient(circle at 20% 15%, rgba(79,70,229,0.34), transparent 52%), radial-gradient(circle at 82% 80%, rgba(245,158,11,0.22), transparent 55%), linear-gradient(160deg, #060A24 0%, #121742 52%, #090D24 100%)';

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundImage: bgGradient } as unknown as object,
      ]}
    >
      {ok && !reduceMotion ? (
        <Model3DErrorBoundary fallback={<View />}>
          <Suspense fallback={null}>
            <LazyAuthCanvas mode={mode} />
          </Suspense>
        </Model3DErrorBoundary>
      ) : null}
    </View>
  );
}
