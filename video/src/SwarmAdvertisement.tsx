import React from 'react';
import { Sequence, AbsoluteFill } from 'remotion';
import { sleekGradient } from './theme';
import { getSceneTiming } from './config/scenes';

export const SwarmAdvertisement: React.FC = () => {
  const sceneTiming = getSceneTiming();

  return (
    <AbsoluteFill style={{ background: sleekGradient(135) }}>
      {sceneTiming.map((scene, idx) => (
        <Sequence 
          key={`${scene.name}-${idx}`} 
          from={scene.from} 
          durationInFrames={scene.length}
        >
          <scene.Component />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
