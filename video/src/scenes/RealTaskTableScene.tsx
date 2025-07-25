import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
import { SimpleTaskTableForVideo } from '../frontend-components/SimpleTaskTableForVideo';

export const RealTaskTableScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Floating container animation
  const containerScale = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
    from: 0.95,
    to: 1,
  });

  const containerOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background zoom effect
  const bgScale = interpolate(frame, [0, durationInFrames], [1.02, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#f8fafc', transform: `scale(${bgScale})` }}>
      {/* Floating background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 1000,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.08), transparent)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />
      
      {/* Main floating card */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${containerScale})`,
          width: width * 0.85,
          height: height * 0.85,
          borderRadius: 20,
          boxShadow: '0 40px 80px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          opacity: containerOpacity,
          padding: 40,
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: 30,
            opacity: interpolate(frame, [10, 30], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(frame, [10, 30], [20, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          <h2
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              color: 'hsl(240, 5%, 10%)',
              margin: 0,
              marginBottom: 8,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            Task Dashboard
          </h2>
          <p
            style={{
              fontSize: 16,
              color: '#6B7280',
              margin: 0,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            Manage and track all your development tasks in one place
          </p>
        </div>

        {/* Table Container */}
        <div
          style={{
            height: 'calc(100% - 120px)',
            overflow: 'hidden',
          }}
        >
          <SimpleTaskTableForVideo />
        </div>
      </div>
    </AbsoluteFill>
  );
};