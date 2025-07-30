import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring,
} from 'remotion';
import { SwarmLogoPop } from '../components/SwarmLogoPop';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation springs
  const titleSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  const subtitleSpring = spring({
    fps,
    frame: Math.max(frame - 17, 0),
    config: { damping: 120, stiffness: 180 },
  });

  const ctaSpring = spring({
    fps,
    frame: Math.max(frame - 33, 0),
    config: { damping: 120, stiffness: 180 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 96 (4 frames before scene ends) to match other button timing.
   * OutroScene has 100 frames, so starts at 100-4=96.
   */
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - 96, 0),      // begin at appearance
    config: { damping: 12, stiffness: 280, mass: 1.2 },
  });
  /* Scale goes from 1  →  0.88  →  1.02  →  1
     TranslateY goes from 0px →  8px  → -4px → 0px */
  const pressScale = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [1, 0.88, 1.02, 1],
  );
  const pressTranslate = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [0, 4, -2, 0],   // stays within ±4 px
  );


  return (
    <AbsoluteFill style={{ paddingBottom: 48 }}>
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
          transform: 'translate(-50%, -45%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            marginBottom: 80,
            opacity: titleSpring,
            transform: `scale(${titleSpring}) translateY(${(1 - titleSpring) * 20}px)`,
          }}
        >
          <SwarmLogoPop size={400} />
        </div>

        <p
          style={{
            fontSize: 51,
            margin: 0,
            marginBottom: 72,
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 400,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '0.01em',
            opacity: subtitleSpring,
            transform: `translateY(${(1 - subtitleSpring) * 20}px)`,
            textAlign: 'center',
          }}
        >
          vibing at the speed of thought
        </p>

        <div
          style={{
            marginBottom: 80,
            opacity: ctaSpring,
            transform: `scale(${ctaSpring}) translateY(${(1 - ctaSpring) * 20}px)`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '21px 42px',
              backgroundColor: '#7dd3fc',
              color: '#0e0e10',
              borderRadius: 12,
              fontSize: 29,
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              letterSpacing: '0.01em',
              boxShadow: `0 ${4 + pressSpring * 8}px 24px rgba(125, 211, 252, ${0.4 + pressSpring * 0.15})`,
              cursor: 'pointer',
              transform: `translateY(${pressTranslate}px) scale(${pressScale})`,
              transition: 'none', // driven purely by Remotion
            }}
          >
            Coming Soon
          </div>
        </div>

        <p
          style={{
            fontSize: 26,
            margin: 0,
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          superswarm.dev
        </p>
      </div>
    </AbsoluteFill>
  );
};
