import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Img,
  staticFile,
  spring,
} from 'remotion';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Text animation with spring
  const textSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  const textOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade out animation for the last few frames
  const fadeOut = interpolate(frame, [20, 30], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const finalOpacity = Math.min(textOpacity, fadeOut);

  // Logo stroke dash animation
  const dash = interpolate(frame, [0, 30], [200, 0], {
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
          opacity: finalOpacity,
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <Img
            src={staticFile('swarm-logo.svg')}
            style={{
              width: 300,
              height: 'auto',
              strokeDasharray: dash,
            }}
          />
        </div>

      </div>
    </AbsoluteFill>
  );
};
