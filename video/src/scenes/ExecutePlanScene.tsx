import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';

const planItems = [
  'Set up JWT token generation and validation',
  'Create secure authentication middleware',
  'Implement user session management',
  'Add refresh token rotation',
  'Build password reset functionality'
];

export const ExecutePlanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plan display animation
  const planSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  // User prompt animation
  const promptSpring = spring({
    fps,
    frame: frame - 30,
    config: { damping: 140, stiffness: 200 },
  });

  // Status transition animation
  const statusTransition = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Plan item animations
  const getPlanItemSpring = (index: number) =>
    spring({
      fps,
      frame: frame - 10 - index * 5,
      config: { damping: 140, stiffness: 200 },
    });

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

      {/* Main container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${planSpring})`,
          width: '85%',
          maxWidth: 900,
          opacity: planSpring,
        }}
      >
        {/* Task header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#7dd3fc',
            }}
          >
            #42
          </div>
          <div
            style={{
              padding: '6px 16px',
              backgroundColor: statusTransition > 0.5 ? '#22c55e' : '#6366f1',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              transition: 'background-color 0.3s ease',
            }}
          >
            {statusTransition > 0.5 ? 'EXECUTING' : 'PLAN'}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            JWT Authentication System
          </h2>
        </div>

        {/* Plan container */}
        <div
          style={{
            backgroundColor: '#111315',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            Execution Plan
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {planItems.map((item, index) => {
              const itemSpring = getPlanItemSpring(index);
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 8,
                    opacity: itemSpring,
                    transform: `translateY(${(1 - itemSpring) * 20}px)`,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#7dd3fc',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                  >
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* User prompt */}
        <div
          style={{
            opacity: promptSpring,
            transform: `translateY(${(1 - promptSpring) * 30}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '2px solid #7dd3fc',
              borderRadius: 12,
              padding: 16,
              position: 'relative',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {/* Speech bubble tail */}
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                left: 32,
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid #7dd3fc',
              }}
            />
            <div
              style={{
                fontSize: 16,
                color: '#ffffff',
                fontWeight: 500,
              }}
            >
              Execute this plan
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};