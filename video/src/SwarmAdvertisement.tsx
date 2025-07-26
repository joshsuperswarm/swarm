import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  AbsoluteFill,
  spring,
} from 'remotion';
import { IntroScene } from './scenes/IntroScene';
import { CreateTaskScene } from './scenes/CreateTaskScene';
import { TaskKickoffScene } from './scenes/TaskKickoffScene';
import { ExecutePlanScene } from './scenes/ExecutePlanScene';
import { TaskSwitchScene } from './scenes/TaskSwitchScene';
import { OutroScene } from './scenes/OutroScene';

export const SwarmAdvertisement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Intro Scene: 0-30 frames (1 second) */}
      <Sequence from={0} durationInFrames={30}>
        <IntroScene />
      </Sequence>

      {/* Create Task Scene: 30-90 frames (2 seconds) */}
      <Sequence from={30} durationInFrames={60}>
        <CreateTaskScene />
      </Sequence>

      {/* Task Kick-off: 90-160 frames (2.3 seconds) */}
      <Sequence from={90} durationInFrames={70}>
        <TaskKickoffScene />
      </Sequence>

      {/* Execute Plan: 160-240 frames (2.7 seconds) */}
      <Sequence from={160} durationInFrames={80}>
        <ExecutePlanScene />
      </Sequence>

      {/* Task Switch ("j j"): 240-360 frames (4 seconds) */}
      <Sequence from={240} durationInFrames={120}>
        <TaskSwitchScene />
      </Sequence>

      {/* Outro Scene: 360-450 frames (3 seconds) */}
      <Sequence from={360} durationInFrames={90}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
