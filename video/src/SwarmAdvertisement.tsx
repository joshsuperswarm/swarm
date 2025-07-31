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

      {/* Create Task Scene: 60-280 frames (7.33 seconds) */}
      <Sequence from={60} durationInFrames={220}>
        <CreateTaskScene />
      </Sequence>

      {/* Plan Scene: 280-405 frames (4.17 seconds) */}
      <Sequence from={280} durationInFrames={125}>
        <PlanScene />
      </Sequence>

      {/* Execute Scene: 405-530 frames (4.17 seconds) */}
      <Sequence from={405} durationInFrames={125}>
        <ExecuteScene />
      </Sequence>

      {/* Review Scene: 530-655 frames (4.17 seconds) */}
      <Sequence from={530} durationInFrames={125}>
        <ReviewScene />
      </Sequence>

      {/* Outro Scene: 655-755 frames (3.33 seconds) */}
      <Sequence from={655} durationInFrames={100}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
