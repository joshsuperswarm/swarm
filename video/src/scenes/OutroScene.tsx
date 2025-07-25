import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  Img,
  staticFile,
  spring
} from 'remotion';
import { sleekGradient } from '../theme';

export const OutroScene: React.FC = () => {
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

  // Main text animation with spring
  const mainTextSpring = spring({
    fps,
    frame: frame - 10,
    config: { damping: 120, stiffness: 180 },
  });

  // Features staggered spring animations
  const getFeatureSpring = (index: number) =>
    spring({
      fps,
      frame: frame - 20 - index * 5,
      config: { damping: 120, stiffness: 180 },
    });

  // CTA animation with bounce effect
  const ctaSpring = spring({
    fps,
    frame: frame - 40,
    config: { damping: 100, stiffness: 200 },
  });

  const ctaPulse = interpolate(frame, [50, 60, 70, 80], [1, 1.02, 1, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Enhanced background animation - full 540° rotation
  const bgRotation = interpolate(frame, [0, durationInFrames], [0, 540], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const features = [
    { text: 'AI-Powered Task Execution' },
    { text: 'Real-time Progress Tracking' },
    { text: 'GitHub Integration' },
    { text: 'Lightning Fast Performance' },
  ];

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
          background: sleekGradient(bgRotation),
          backgroundSize: '400% 400%',
        }}
      />

      {/* Floating background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 1200,
          height: 800,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08), transparent)',
          borderRadius: '50%',
          filter: 'blur(120px)',
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
          boxShadow: '0 40px 100px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          opacity: containerOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'white',
          padding: 60,
        }}
      >
        {/* Logo */}
        <div
          style={{
            marginBottom: 40,
            opacity: logoSpring,
            transform: `scale(${logoSpring}) translateY(${(1 - logoSpring) * 30}px)`,
            filter: 'drop-shadow(0 8px 40px rgba(0,0,0,0.4))',
            transition: 'all 0.3s ease-out',
          }}
        >
          <Img 
            src={staticFile('swarm-logo.png')} 
            style={{ 
              width: 80, 
              height: 80 
            }} 
          />
        </div>

        {/* Main text */}
        <div
          style={{
            opacity: mainTextSpring,
            transform: `translateY(${(1 - mainTextSpring) * 30}px)`,
            marginBottom: 60,
            transition: 'all 0.3s ease-out',
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              margin: 0,
              marginBottom: 20,
              textShadow: '0 8px 40px rgba(0,0,0,0.5)',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            SWARM
          </h1>
          <p
            style={{
              fontSize: 24,
              margin: 0,
              opacity: 0.9,
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              maxWidth: 600,
              lineHeight: 1.4,
            }}
          >
            Transform your development workflow with AI-powered task management
          </p>
        </div>

        {/* Features grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 30,
            marginBottom: 60,
          }}
        >
          {features.map((feature, index) => {
            const featureSpring = getFeatureSpring(index);
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  backdropFilter: 'blur(15px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  minWidth: 280,
                  opacity: featureSpring,
                  transform: `scale(${featureSpring}) translateY(${(1 - featureSpring) * 20}px)`,
                  transition: 'all 0.3s ease-out',
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: '500',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  }}
                >
                  {feature.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Call to action */}
        <div
          style={{
            opacity: ctaSpring,
            transform: `scale(${ctaSpring * ctaPulse}) translateY(${(1 - ctaSpring) * 30}px)`,
            transition: 'all 0.3s ease-out',
          }}
        >
          {/* Glowing orb behind CTA */}
          <div
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              background: 'radial-gradient(circle, rgba(255,255,255,0.1), transparent)',
              borderRadius: '50%',
              filter: 'blur(60px)',
              zIndex: -1,
            }}
          />
          
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 32px',
              backgroundColor: '#ffffff',
              color: '#1e3a8a',
              borderRadius: 50,
              fontSize: 20,
              fontWeight: 'bold',
              boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            <span>Get Started Today</span>
            <span style={{ fontSize: 16 }}>→</span>
          </div>
          
          <p
            style={{
              marginTop: 20,
              fontSize: 16,
              opacity: 0.8,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            }}
          >
            github.com/your-org/swarm
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};