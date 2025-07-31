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
import { AnimatedTaskList } from '../components/AnimatedTaskList';

const reviewItems = [
  'Check for proper error handling and edge cases',
  'Verify all functions have descriptive names and comments',
  'Ensure code follows project style guidelines',
  'Confirm no hardcoded values or magic numbers',
];

export const ReviewScene: React.FC = () => {
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
    frame: Math.max(frame - 50, 0),
    config: { damping: 140, stiffness: 200 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 121 (4 frames before scene ends) to match other button timing.
   * ReviewScene has 125 frames, so starts at 125-4=121.
   */
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - 121, 0), // begin at appearance
    config: { damping: 12, stiffness: 280, mass: 1.2 },
  });
  /* Scale goes from 1  →  0.88  →  1.02  →  1
     TranslateY goes from 0px →  8px  → -4px → 0px */
  const pressScale = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [1, 0.88, 1.02, 1]
  );
  const pressTranslate = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [0, 8, -4, 0]
  );

  // ─── Mouse-click SFX ───
  const slamFrame = 121;
  const clickLen  = 8; // 8 frames ≈ 0.33 s @ 24 fps

  // Status is always "REVIEWING" in this scene
  const statusTransition = 1; // Always shows REVIEWING

  // Plan item animations now handled by AnimatedTaskList component

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

      {/* Main container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${planSpring})`,
          width: '90%',
          maxWidth: 1200,
          opacity: planSpring,
        }}
      >
        {/* Task header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 21,
            marginBottom: 42,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: 29,
              fontWeight: 600,
              color: '#7dd3fc',
            }}
          >
            #42
          </div>
          <div
            style={{
              padding: '8px 21px',
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 19,
              fontWeight: 600,
              textTransform: 'uppercase',
              transition: 'background-color 0.3s ease',
            }}
          >
            REVIEW
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            Remotion Video for Swarm
          </h2>
        </div>

        {/* Plan container */}
        <div
          style={{
            backgroundColor: '#111315',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 31,
            marginBottom: 31,
          }}
        >

          <AnimatedTaskList items={reviewItems} revealDelay={17} />
        </div>

        {/* Merge PR button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            opacity: promptSpring,
            transform: `translateY(${(1 - promptSpring) * 30}px)`,
          }}
        >
          <div
            style={{
              padding: '16px 31px',
              backgroundColor: '#7dd3fc',
              color: '#0e0e10',
              borderRadius: 8,
              fontSize: 26,
              fontWeight: 600,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              transform: `translateY(${pressTranslate}px) scale(${pressScale})`,
              boxShadow: `0 ${4 + pressSpring * 8}px 24px rgba(125, 211, 252, ${
                0.4 + pressSpring * 0.15
              })`,
              transition: 'none', // driven purely by Remotion
            }}
          >
            Merge PR
          </div>
        </div>
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
