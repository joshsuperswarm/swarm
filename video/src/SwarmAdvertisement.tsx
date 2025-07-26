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
import { ExecutePlanScene } from './scenes/ExecutePlanScene';
import { OutroScene } from './scenes/OutroScene';

export const SwarmAdvertisement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: sleekGradient(135) }}>
      {/* Intro Scene: 0-30 frames (1 second) */}
      <Sequence from={0} durationInFrames={30}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 30-90 frames (2 seconds) */}
      <Sequence from={30} durationInFrames={60}>
        <CreateTaskScene />
      </Sequence>

      {/* Execute Plan: 90-170 frames (2.7 seconds) */}
      <Sequence from={90} durationInFrames={80}>
        <ExecutePlanScene />
      </Sequence>

      {/* Outro Scene: 170-260 frames (3 seconds) */}
      <Sequence from={170} durationInFrames={90}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
