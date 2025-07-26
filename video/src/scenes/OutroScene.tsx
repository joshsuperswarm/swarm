import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  spring
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
      
      {/* Main content */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 600,
            margin: 0,
            marginBottom: 24,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '-0.02em',
            textShadow: '0 4px 16px rgba(0,0,0,0.4)',
            opacity: titleSpring,
            transform: `scale(${titleSpring}) translateY(${(1 - titleSpring) * 20}px)`,
          }}
        >
          swarm
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 32,
            margin: 0,
            marginBottom: 48,
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 500,
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
              fontWeight: 600,
              marginBottom: 24,
              boxShadow: '0 4px 16px rgba(125, 211, 252, 0.4)',
              cursor: 'pointer',
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
              fontWeight: 500,
            }}
          >
            github.com/your-org/swarm
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};