import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill
} from 'remotion';
import { MockProviders } from '../mocks/mockProviders';
import { TaskPageForVideo } from '../frontend-components/TaskPageForVideo';

export const RealTaskDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Fade in animation
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          opacity,
          width: '100%',
          height: '100%',
        }}
      >
        <MockProviders>
          <TaskPageForVideo taskId={56} />
        </MockProviders>
      </div>
    </AbsoluteFill>
  );
};