import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
import { MockProviders } from '../mocks/mockProviders';
import { TaskPageForVideo } from '../frontend-components/TaskPageForVideo';

export const RealTaskDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Consistent spring config helper
  const bounce = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 120, stiffness: 180 } });

  // Floating card animation
  const cardScale = spring({ frame, fps, config: { damping: 120, stiffness: 180 } });
  const cardOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Header & Description motion
  const headerSpring = bounce(5);
  const descriptionSpring = bounce(15);

  // Enhanced TODO animations
  const getTodoSpring = (index: number) =>
    spring({
      frame: frame - 40 - index * 4,
      fps,
      config: { damping: 140, stiffness: 230, mass: 0.6 },
      from: 0,
      to: 1,
    });

  // Typewriter-style logs
  const getLogSpring = (index: number) =>
    spring({ frame: frame - 90 - index * 2, fps, config: { damping: 120 } });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Subtle background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.1), transparent)',
          filter: 'blur(100px)',
        }}
      />
      {/* Main floating card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${cardScale})`,
          opacity: cardOpacity,
          width: width * 0.86,
          height: height * 0.86,
          borderRadius: 20,
          boxShadow: '0 40px 90px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          padding: 48,
        }}
      >
        {/* Subtle background motion for depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `scale(${interpolate(frame, [0, durationInFrames], [1.1, 1])})`,
            background: 'radial-gradient(circle at 60% 40%, rgba(96,165,250,0.15), transparent 70%)',
            filter: 'blur(120px)',
          }}
        />

        {/* Content with enhanced animations */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <MockProviders>
            <TaskPageForVideo 
              taskId={56} 
              animationProps={{
                headerSpring,
                descriptionSpring,
                getTodoSpring,
                getLogSpring,
              }}
            />
          </MockProviders>
        </div>
      </div>
    </AbsoluteFill>
  );
};