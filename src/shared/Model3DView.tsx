import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, ViewStyle, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  GLB_SURVIVAL_ARENA_B64,
  GLB_BATTLE_COLOSSEUM_B64,
  GLB_LIBRARY_ARCHIVES_B64,
  GLB_STUDY_SANCTUARY_B64,
  GLB_PAPYRUS_CHARACTER_B64,
} from './models3d';

export type Model3DType = 'survival' | 'battle' | 'match' | 'study' | 'character';
export type Character3DAnimation = 'Idle' | 'Cast_Spell' | 'Hit_Reaction' | 'Victory_Dance';

interface Model3DViewProps {
  model: Model3DType;
  style?: ViewStyle;
  height?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  cameraOrbit?: string;
  animationName?: Character3DAnimation | string;
  autoplay?: boolean;
}

export function Model3DView({
  model,
  style,
  height = 240,
  autoRotate = true,
  interactive = true,
  cameraOrbit = '0deg 75deg 100%',
  animationName = 'Idle',
  autoplay = true,
}: Model3DViewProps) {
  const webviewRef = useRef<any>(null);

  const modelDataUri = useMemo(() => {
    switch (model) {
      case 'character':
        return GLB_PAPYRUS_CHARACTER_B64;
      case 'survival':
        return GLB_SURVIVAL_ARENA_B64;
      case 'battle':
        return GLB_BATTLE_COLOSSEUM_B64;
      case 'match':
        return GLB_LIBRARY_ARCHIVES_B64;
      case 'study':
      default:
        return GLB_STUDY_SANCTUARY_B64;
    }
  }, [model]);

  // Zero-latency animation switching via WebView message post
  useEffect(() => {
    if (webviewRef.current && animationName) {
      webviewRef.current.postMessage(
        JSON.stringify({ type: 'SET_ANIMATION', animationName })
      );
    }
  }, [animationName]);

  const html = useMemo(() => {
    const isCharacter = model === 'character';
    const effectiveOrbit = cameraOrbit || (isCharacter ? '0deg 80deg 3.5m' : '0deg 75deg 100%');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
    }
    model-viewer {
      width: 100%;
      height: 100%;
      background-color: transparent;
      --poster-color: transparent;
    }
    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #38BDF8;
      font-family: sans-serif;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <model-viewer
    id="viewer"
    src="${modelDataUri}"
    ${autoRotate ? 'auto-rotate' : ''}
    ${interactive ? 'camera-controls' : ''}
    ${animationName ? `animation-name="${animationName}"` : ''}
    ${autoplay ? 'autoplay' : ''}
    camera-orbit="${effectiveOrbit}"
    shadow-intensity="1.5"
    exposure="1.15"
    touch-action="pan-y"
    interaction-prompt="none"
    loading="eager"
  >
    <div slot="poster" class="loading-indicator">
      ✨ Loading 3D Realm...
    </div>
  </model-viewer>

  <script>
    // Listen for animation change commands without reloading WebView
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        var viewer = document.getElementById('viewer');
        if (viewer && data.type === 'SET_ANIMATION' && data.animationName) {
          viewer.animationName = data.animationName;
          if (viewer.play) {
            viewer.play();
          }
        }
      } catch (err) {}
    });

    document.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        var viewer = document.getElementById('viewer');
        if (viewer && data.type === 'SET_ANIMATION' && data.animationName) {
          viewer.animationName = data.animationName;
          if (viewer.play) {
            viewer.play();
          }
        }
      } catch (err) {}
    });
  </script>
</body>
</html>
    `;
  }, [model, modelDataUri, autoRotate, interactive, cameraOrbit, animationName, autoplay]);

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#06B6D4" />
          </View>
        )}
        startInLoadingState={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  webview: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
});
