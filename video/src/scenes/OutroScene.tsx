import React from 'react';
import { 
  useCurrentFrame, 
  useVideoConfig, 
  interpolate,
  AbsoluteFill,
  Img,
  staticFile
} from 'remotion';
import { sleekGradient } from '../theme';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Logo animation - faster for 15s video
  const logoScale = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Main text animation - faster for 15s video
  const mainTextOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const mainTextTranslateY = interpolate(frame, [20, 40], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Features animation - faster for 15s video
  const featuresOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // CTA animation - faster for 15s video
  const ctaOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaScale = interpolate(frame, [80, 90], [1, 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background animation - faster for 15s video
  const bgRotation = interpolate(frame, [0, 90], [0, 180], {
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
          padding: 60,
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
              width: 80, 
              height: 80 
            }} 
          />
        </div>

        {/* Main text */}
        <div
          style={{
            opacity: mainTextOpacity,
            transform: `translateY(${mainTextTranslateY}px)`,
            marginBottom: 60,
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              margin: 0,
              marginBottom: 20,
              textShadow: '0 4px 20px rgba(0,0,0,0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            SWARM
          </h1>
          <p
            style={{
              fontSize: 24,
              margin: 0,
              opacity: 0.9,
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
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
            opacity: featuresOpacity,
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 24px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                minWidth: 280,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: '500',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {feature.text}
              </span>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
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
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
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
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            github.com/your-org/swarm
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};