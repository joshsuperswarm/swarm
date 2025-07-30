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
    frame: frame - 17,
    config: { damping: 120, stiffness: 180 },
  });

  const ctaSpring = spring({
    fps,
    frame: frame - 33,
    config: { damping: 120, stiffness: 180 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 96 (4 frames before scene ends) to match other button timing.
   * OutroScene has 100 frames, so starts at 100-4=96.
   */
  const pressSpring = spring({
    fps,
    frame: frame - 96,      // begin at appearance
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
    [0, 8, -4, 0],
  );


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
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 42,
            opacity: titleSpring,
            transform: `scale(${titleSpring}) translateY(${(1 - titleSpring) * 20}px)`,
          }}
        >
          <SwarmLogoPop size={400} />
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 51,
            margin: 0,
            marginBottom: 62,
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 400,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '0.01em',
            opacity: subtitleSpring,
            transform: `translateY(${(1 - subtitleSpring) * 20}px)`,
          }}
        >
          vibing at the speed of thought
        </p>

        {/* CTA Section */}
        <div
          style={{
            opacity: ctaSpring,
            transform: `scale(${ctaSpring}) translateY(${(1 - ctaSpring) * 20}px)`,
          }}
        >
          {/* Get Started Button */}
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
              marginBottom: 31,
              boxShadow: `0 ${4 + pressSpring * 8}px 24px rgba(125, 211, 252, ${0.4 + pressSpring * 0.15})`,
              cursor: 'pointer',
              transform: `translateY(${pressTranslate}px) scale(${pressScale})`,
              transition: 'none', // driven purely by Remotion
            }}
          >
            Get Started Today
          </div>

          {/* GitHub link */}
          <p
            style={{
              fontSize: 26,
              margin: 0,
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 400,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              letterSpacing: '0.01em',
            }}
          >
            github.com/your-org/swarm
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
