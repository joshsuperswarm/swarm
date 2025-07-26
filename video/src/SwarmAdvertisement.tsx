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
      {/* Intro Scene: 0-45 frames (1.5 seconds) */}
      <Sequence from={0} durationInFrames={45}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 45-165 frames (4 seconds) */}
      <Sequence from={45} durationInFrames={120}>
        <CreateTaskScene />
      </Sequence>

      {/* Plan Scene: 165-240 frames (2.5 seconds) */}
      <Sequence from={165} durationInFrames={75}>
        <PlanScene />
      </Sequence>

      {/* Execute Scene: 240-315 frames (2.5 seconds) */}
      <Sequence from={240} durationInFrames={75}>
        <ExecuteScene />
      </Sequence>

      {/* Review Scene: 315-390 frames (2.5 seconds) */}
      <Sequence from={315} durationInFrames={75}>
        <ReviewScene />
      </Sequence>

      {/* Outro Scene: 390-450 frames (2 seconds) */}
      <Sequence from={390} durationInFrames={60}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
