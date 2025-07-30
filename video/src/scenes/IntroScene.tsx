import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring,
} from 'remotion';
import { SwarmLogoPop } from '../components/SwarmLogoPop';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Text animation with spring
  const textSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  const textOpacity = interpolate(frame, [0, 17], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
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

      {/* Main content */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${textSpring})`,
          opacity: textOpacity,
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 42 }}>
          <SwarmLogoPop size={900} />
        </div>

      </div>
    </AbsoluteFill>
  );
};
