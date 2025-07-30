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
      {/* Intro Scene: 0-120 frames (4 seconds) */}
      <Sequence from={0} durationInFrames={120}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 120-320 frames (6.67 seconds) */}
      <Sequence from={120} durationInFrames={200}>
        <CreateTaskScene />
      </Sequence>

      {/* Plan Scene: 320-445 frames (4.17 seconds) */}
      <Sequence from={320} durationInFrames={125}>
        <PlanScene />
      </Sequence>

      {/* Execute Scene: 445-570 frames (4.17 seconds) */}
      <Sequence from={445} durationInFrames={125}>
        <ExecuteScene />
      </Sequence>

      {/* Review Scene: 570-695 frames (4.17 seconds) */}
      <Sequence from={570} durationInFrames={125}>
        <ReviewScene />
      </Sequence>

      {/* Outro Scene: 695-795 frames (3.33 seconds) */}
      <Sequence from={695} durationInFrames={100}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
