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
    frame: frame - 10,
    config: { damping: 120, stiffness: 180 },
  });

  const ctaSpring = spring({
    fps,
    frame: frame - 20,
    config: { damping: 120, stiffness: 180 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 56 (4 frames before scene ends) to match other button timing.
   * OutroScene has 60 frames, so starts at 60-4=56.
   */
  const pressSpring = spring({
    fps,
    frame: frame - 56,      // begin at appearance
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
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 32,
            opacity: titleSpring,
            transform: `scale(${titleSpring}) translateY(${(1 - titleSpring) * 20}px)`,
          }}
        >
          <Img
            src={staticFile('swarm-logo.svg')}
            style={{
              width: 400,
              height: 'auto',
              strokeDasharray: dash,
            }}
          />
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 32,
            margin: 0,
            marginBottom: 48,
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
              padding: '16px 32px',
              backgroundColor: '#7dd3fc',
              color: '#0e0e10',
              borderRadius: 12,
              fontSize: 18,
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              letterSpacing: '0.01em',
              marginBottom: 24,
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
              fontSize: 16,
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
