import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  AbsoluteFill,
  spring,
} from 'remotion';
import { sleekGradient } from './theme';
import { IntroScene } from './scenes/IntroScene';
import { CreateTaskScene } from './scenes/CreateTaskScene';
import { PlanScene } from './scenes/PlanScene';
import { ExecuteScene } from './scenes/ExecuteScene';
import { ReviewScene } from './scenes/ReviewScene';
import { OutroScene } from './scenes/OutroScene';

export const SwarmAdvertisement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: sleekGradient(135) }}>
      {/* Intro Scene: 0-60 frames (2 seconds) */}
      <Sequence from={0} durationInFrames={60}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 60-260 frames (6.67 seconds) */}
      <Sequence from={60} durationInFrames={200}>
        <CreateTaskScene />
      </Sequence>

      {/* Plan Scene: 260-385 frames (4.17 seconds) */}
      <Sequence from={260} durationInFrames={125}>
        <PlanScene />
      </Sequence>

      {/* Execute Scene: 385-510 frames (4.17 seconds) */}
      <Sequence from={385} durationInFrames={125}>
        <ExecuteScene />
      </Sequence>

      {/* Review Scene: 510-635 frames (4.17 seconds) */}
      <Sequence from={510} durationInFrames={125}>
        <ReviewScene />
      </Sequence>

      {/* Outro Scene: 635-735 frames (3.33 seconds) */}
      <Sequence from={635} durationInFrames={100}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
