import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
// Mock log data for the scene
const mockLogs = [
  '[2025-07-25 15:42:11] ✓ Analyzing codebase structure',
  '[2025-07-25 15:42:12] Loading project dependencies',
  '[2025-07-25 15:42:13] Setting up JWT token generation',
  '[2025-07-25 15:42:14] Creating authentication middleware'
];

export const TaskKickoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Task card animation
  const cardSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  const cardOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Status indicator animation
  const statusSpring = spring({
    fps,
    frame: frame - 20,
    config: { damping: 120, stiffness: 180 },
  });

  // Log entries animation
  const getLogSpring = (index: number) =>
    spring({
      fps,
      frame: frame - 35 - index * 8,
      config: { damping: 140, stiffness: 200 },
    });

  // Running dots animation
  const runningDots = Math.floor((frame / 10) % 4);

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

      {/* Task card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${cardSpring})`,
          opacity: cardOpacity,
          width: '80%',
          maxWidth: 800,
          backgroundColor: '#111315',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          padding: 32,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Task header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
            opacity: statusSpring,
            transform: `translateY(${(1 - statusSpring) * 20}px)`,
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
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Running{''.repeat(runningDots).padEnd(3, '.')}
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.95)',
            marginBottom: 20,
            lineHeight: 1.3,
            opacity: statusSpring,
            transform: `translateY(${(1 - statusSpring) * 20}px)`,
          }}
        >
          Implement JWT Authentication System
        </h1>

        {/* Live logs section */}
        <div
          style={{
            backgroundColor: '#1a1b1e',
            borderRadius: 8,
            padding: 16,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 12,
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            Live Execution
          </h3>

          <div
            style={{
              backgroundColor: '#0f0f0f',
              borderRadius: 6,
              padding: 12,
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            {mockLogs.slice(0, 4).map((log, index) => {
              const logSpring = getLogSpring(index);
              return (
                <div
                  key={index}
                  style={{
                    opacity: logSpring,
                    transform: `translateX(${(1 - logSpring) * -20}px)`,
                    color: log.includes('✓') ? '#22c55e' : '#e5e7eb',
                    marginBottom: index < 3 ? 4 : 0,
                  }}
                >
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};