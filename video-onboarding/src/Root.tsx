import React from 'react';
import { Composition } from 'remotion';
import { PapyrusIllusionIntro } from './PapyrusIllusionIntro';
import { VIDEO_SPEC } from './shotcraft/recipes';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PapyrusIllusionIntro"
      component={PapyrusIllusionIntro}
      durationInFrames={VIDEO_SPEC.durationInFrames}
      fps={VIDEO_SPEC.fps}
      width={VIDEO_SPEC.width}
      height={VIDEO_SPEC.height}
    />
  );
};
