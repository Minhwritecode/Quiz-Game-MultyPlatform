import React, { lazy, Suspense, useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Model3DErrorBoundary } from './Model3DErrorBoundary';

export type Model3DType =
  | 'survival'
  | 'battle'
  | 'match'
  | 'study'
  | 'character'
  | 'questEmblem'
  | 'splashMorph'
  | 'bossGolem'
  | 'archerBow'
  | 'royalScroll'
  | 'alchemyCauldrons';
export type Character3DAnimation = 'Idle' | 'Cast_Spell' | 'Hit_Reaction' | 'Victory_Dance';
export type Model3DActionEffect = 'idle' | 'attack' | 'hurt' | 'victory';

interface Model3DViewProps {
  model: Model3DType;
  style?: ViewStyle;
  height?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  cameraOrbit?: string;
  animationName?: Character3DAnimation | string;
  actionEffect?: Model3DActionEffect;
  pulseTrigger?: number;
  autoplay?: boolean;
  showcase?: boolean;
}

const LazyModel3DCanvas = lazy(() => import('./Model3DCanvas.web'));

function checkWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Model3DView({
  model,
  style,
  height = 220,
  autoRotate = true,
  interactive = true,
  animationName = 'Idle',
  actionEffect = 'idle',
  pulseTrigger = 0,
  autoplay = true,
  showcase = false,
}: Model3DViewProps) {
  const [webglOk] = useState(checkWebGLAvailable);
  const [failedModel, setFailedModel] = useState<Model3DType | null>(null);

  const handleError = useCallback(() => {
    setFailedModel(model);
  }, [model]);

  if (!webglOk || failedModel === model) {
    return (
      <View style={[styles.container, styles.fallback, { height }, style]}>
        <Ionicons name="cube-outline" size={28} color="#818CF8" />
        <Text style={styles.fallbackText}>Papyrus 3D Stage</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <Model3DErrorBoundary
        fallback={
          <View style={[styles.fallback, StyleSheet.absoluteFill]}>
            <Ionicons name="cube-outline" size={28} color="#818CF8" />
            <Text style={styles.fallbackText}>Papyrus 3D Stage</Text>
          </View>
        }
      >
        <Suspense
          fallback={
            <View style={[styles.fallback, StyleSheet.absoluteFill]}>
              <ActivityIndicator size="small" color="#818CF8" />
              <Text style={styles.loadingText}>Đang tải mô hình 3D...</Text>
            </View>
          }
        >
          <LazyModel3DCanvas
            model={model}
            autoRotate={autoRotate}
            interactive={interactive}
            animationName={animationName}
            actionEffect={actionEffect}
            pulseTrigger={pulseTrigger}
            autoplay={autoplay}
            showcase={showcase}
            onError={handleError}
          />
        </Suspense>
      </Model3DErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(6, 10, 36, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '600',
  },
});
