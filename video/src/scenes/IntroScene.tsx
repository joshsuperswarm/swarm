import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate, 
  AbsoluteFill,
  spring
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

  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e10' }}>
      {/* Subtle background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.1), transparent)',
          filter: 'blur(100px)',
        }}
      />
      
      {/* Main text */}
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
        <h1
          style={{
            fontSize: 64,
            fontWeight: 600,
            margin: 0,
            color: 'rgba(255, 255, 255, 0.9)',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          swarm, vim agent ide
        </h1>
      </div>
    </AbsoluteFill>
  );
};