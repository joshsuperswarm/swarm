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
import { TaskDetailWithTodosScene } from './scenes/TaskDetailWithTodosScene';
import { TaskJumpScene } from './scenes/TaskJumpScene';
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

      {/* Task Detail With Todos: 90-360 frames (9 seconds) */}
      <Sequence from={90} durationInFrames={270}>
        <TaskDetailWithTodosScene />
      </Sequence>

      {/* Outro Scene: 420-510 frames (3 seconds) */}
      <Sequence from={420} durationInFrames={90}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};
