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
  const { fps, width, height } = useVideoConfig();

  // Logo animation
  const logoScale = spring({
    fps,
    frame,
    config: {
      damping: 200,
    },
  });

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title animation - faster for 15s video
  const titleTranslateY = interpolate(frame, [30, 60], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subtitle animation - faster for 15s video
  const subtitleTranslateY = interpolate(frame, [60, 90], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const subtitleOpacity = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background gradient animation - adjusted for 15s video
  const gradientRotation = interpolate(frame, [0, 90], [0, 180], {
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
      
      {/* Content container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          color: 'white',
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 40,
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))',
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
            transform: `translateY(${titleTranslateY}px)`,
            opacity: titleOpacity,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          SWARM
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 28,
            margin: 0,
            opacity: subtitleOpacity * 0.9,
            transform: `translateY(${subtitleTranslateY}px)`,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            maxWidth: 800,
            lineHeight: 1.4,
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