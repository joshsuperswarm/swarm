import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring,
  Sequence,
  Audio,
  staticFile,
} from 'remotion';
import { Img } from 'remotion';
import { SwarmLogoPop } from '../components/SwarmLogoPop';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = (Math.sin((frame / fps) * Math.PI) + 1) / 2; // 0→1→0 every 2 s
  const glow = interpolate(pulse, [0, 1], [0.3, 0.7]); // External glow intensity

  // Animation springs - staggered entry
  const logoSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  const taglineSpring = spring({
    fps,
    frame: Math.max(frame - 15, 0),
    config: { damping: 120, stiffness: 180 },
  });

  const buttonSpring = spring({
    fps,
    frame: Math.max(frame - 30, 0),
    config: { damping: 120, stiffness: 180 },
  });

  const domainSpring = spring({
    fps,
    frame: Math.max(frame - 45, 0),
    config: { damping: 120, stiffness: 180 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 96 (4 frames before scene ends) to match other button timing.
   * OutroScene has 100 frames, so starts at 100-4=96.
   */
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - 96, 0),      // begin at appearance
    config: { damping: 12, stiffness: 280, mass: 1.2 },
  });
  /* Scale goes from 1  →  0.88  →  1.02  →  1
     TranslateY goes from 0px → 8px  → -4px → 0px */
  const pressScale = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [1, 0.88, 1.02, 1],
  );
  const pressTranslate = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [0, 4, -2, 0],   // stays within ±4 px
  );

  // ─── Mouse-click SFX ───
  const slamFrame = 96;
  const clickLen  = 8; // 8 frames ≈ 0.33 s @ 24 fps



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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 48,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            opacity: logoSpring,
            transform: `translateY(${(1 - logoSpring) * 20}px)`,
          }}
        >
          <Img src={staticFile('swarm-logo.svg')} style={{ width: 320 }} />
        </div>

        <p
          style={{
            fontSize: 51,
            margin: 0,
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: 400,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '0.01em',
            opacity: taglineSpring,
            transform: `translateY(${(1 - taglineSpring) * 20}px)`,
            textAlign: 'center',
          }}
        >
          vibing at the speed of thought
        </p>

        <div
          style={{
            opacity: buttonSpring,
            transform: `scale(${buttonSpring}) translateY(${(1 - buttonSpring) * 20}px)`,
          }}
        >
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
              boxShadow: `0 4px 24px rgba(56, 189, 248, ${glow})`,
              cursor: 'pointer',
              transform: `translateY(${pressTranslate}px) scale(${(1 + pulse * 0.03) * pressScale})`,
              transition: 'none', // driven purely by Remotion
            }}
          >
            Coming Soon
          </div>
        </div>

        <p
          style={{
            fontSize: 26,
            margin: 0,
            color: 'rgba(255, 255, 255, 0.6)',
            opacity: domainSpring,
            transform: `translateY(${(1 - domainSpring) * 20}px)`,
          }}
        >
          superswarm.dev
        </p>
      </div>

      {/* Mouse-button click */}
      <Sequence from={slamFrame} durationInFrames={clickLen}>
        <Audio
          src={staticFile('Mouse Click Sound.wav')}
          trimAfter={clickLen}             // stop after ≈0.33 s
          volume={f =>
            interpolate(f, [0, 4], [1, 0.8], {
              extrapolateRight: 'clamp',
            })
          }                                // tiny ease-out fade
        />
      </Sequence>
    </AbsoluteFill>
  );
};
