import { Platform, StyleSheet, View } from 'react-native';
import { Model3DView } from '@/shared/Model3DView';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { QuestArena3DFallback } from './QuestArenaFallback';

export { QuestArena3DFallback };

interface QuestArena3DProps {
  height?: number;
  interactive3D?: boolean;
}

export default function QuestArena3D({ height = 210, interactive3D = false }: QuestArena3DProps) {
  const reduceMotion = usePapyrusStore((s) => s.reduceMotion);
  const render3DMode = usePapyrusStore((s) => s.render3DMode);

  if (Platform.OS !== 'web' && !reduceMotion && (interactive3D || render3DMode)) {
    return (
      <View style={[styles.stage, { height }]}>
        <Model3DView
          model="questEmblem"
          height={height}
          autoRotate
          interactive
          cameraOrbit="0deg 72deg 3.6m"
          style={{ width: '100%', backgroundColor: 'transparent' }}
        />
      </View>
    );
  }

  return <QuestArena3DFallback height={height} reduceMotion={reduceMotion} />;
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
});
