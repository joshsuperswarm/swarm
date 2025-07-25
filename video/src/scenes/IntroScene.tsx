import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate, 
  spring,
  AbsoluteFill,
  Img,
  staticFile
} from 'remotion';
import { sleekGradient } from '../theme';

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Floating container animation
  const containerScale = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
    from: 0.9,
    to: 1,
  });

  const containerOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Logo animation with enhanced spring
  const logoSpring = spring({
    fps,
    frame: frame - 5,
    config: { damping: 120, stiffness: 180 },
  });

  // Title animation with spring
  const titleSpring = spring({
    fps,
    frame: frame - 10,
    config: { damping: 120, stiffness: 180 },
  });

  // Subtitle animation with spring
  const subtitleSpring = spring({
    fps,
    frame: frame - 20,
    config: { damping: 120, stiffness: 180 },
  });

  // Background gradient animation - full 360° rotation
  const gradientRotation = interpolate(frame, [0, durationInFrames], [0, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Animated background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: sleekGradient(gradientRotation),
          backgroundSize: '400% 400%',
        }}
      />

      {/* Floating background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 800,
          height: 800,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.1), transparent)',
          borderRadius: '50%',
          filter: 'blur(100px)',
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
          boxShadow: '0 40px 80px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          opacity: containerOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'white',
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 40,
            opacity: logoSpring,
            transform: `scale(${logoSpring}) translateY(${(1 - logoSpring) * 30}px)`,
            filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.4))',
            transition: 'all 0.3s ease-out',
          }}
        >
          <Img 
            src={staticFile('swarm-logo.png')} 
            style={{ 
              width: 120, 
              height: 120 
            }} 
          />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            margin: 0,
            marginBottom: 20,
            opacity: titleSpring,
            transform: `translateY(${(1 - titleSpring) * 30}px)`,
            textShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            transition: 'all 0.3s ease-out',
          }}
        >
          SWARM
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 28,
            margin: 0,
            opacity: subtitleSpring * 0.9,
            transform: `translateY(${(1 - subtitleSpring) * 30}px)`,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            maxWidth: 800,
            lineHeight: 1.4,
            transition: 'all 0.3s ease-out',
          }}
        >
          AI-Powered Task Management
          <br />
          for Development Teams
        </p>
      </div>
    </AbsoluteFill>
  );
};