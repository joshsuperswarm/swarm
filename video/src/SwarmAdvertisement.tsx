import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate, 
  Sequence, 
  AbsoluteFill,
  spring
} from 'remotion';
import { IntroScene } from './scenes/IntroScene';
import { RealTaskTableScene } from './scenes/RealTaskTableScene';
import { RealTaskDetailScene } from './scenes/RealTaskDetailScene';
import { OutroScene } from './scenes/OutroScene';

export const SwarmAdvertisement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>
      {/* Intro Scene: 0-90 frames (3 seconds) */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      {/* Task Table Scene: 90-180 frames (3 seconds) */}
      <Sequence from={90} durationInFrames={90}>
        <RealTaskTableScene />
      </Sequence>

      {/* Task Detail Scene: 180-360 frames (6 seconds) */}
      <Sequence from={180} durationInFrames={180}>
        <RealTaskDetailScene />
      </Sequence>

      {/* Outro Scene: 360-450 frames (3 seconds) */}
      <Sequence from={360} durationInFrames={90}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};