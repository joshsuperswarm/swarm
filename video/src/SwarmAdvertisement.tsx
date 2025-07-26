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
      {/* Intro Scene: 0-60 frames (2 seconds) */}
      <Sequence from={0} durationInFrames={60}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 60-180 frames (4 seconds) */}
      <Sequence from={60} durationInFrames={120}>
        <CreateTaskScene />
      </Sequence>

      {/* Execute Plan: 180-330 frames (5 seconds) */}
      <Sequence from={180} durationInFrames={150}>
        <ExecutePlanScene />
      </Sequence>

      {/* Outro Scene: 330-450 frames (4 seconds) */}
      <Sequence from={330} durationInFrames={120}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
