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

const planItems = [
  'Storyboard key scenes (intro, create task, plan, outro)',
  'Build React components for each scene',
  'Animate with Remotion interpolate & spring',
  'Add gradients, typography, and on-brand colors',
];

// Words shown while the agent is still working out the plan
const placeholderWords = ['Pondering', 'Analyzing', 'Perusing', 'Planning'] as const;
// No dedicated overlay anymore – items will show these placeholders directly
const revealDelay = 17; // keep slight staggering for AnimatedTaskList

export const PlanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plan display animation
  const planSpring = spring({
    fps,
    frame: Math.max(frame - revealDelay, 0),
    config: { damping: 120, stiffness: 180 },
  });

  // User prompt animation
  const promptSpring = spring({
    fps,
    frame: Math.max(frame - revealDelay - 50, 0),
    config: { damping: 140, stiffness: 200 },
  });

  // ─── Button slam animation ───
  const pressStart = 121;                // 4 frames before 125 (matches other scenes)
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - pressStart, 0),
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
  const slamFrame = pressStart;
  const clickLen  = 8; // 8 frames ≈ 0.33 s @ 24 fps

  // Status is always "PLAN" in this scene
  const statusTransition = 0; // Always shows PLAN

  // Plan item animations now handled by AnimatedTaskList component

  return (
    <AbsoluteFill>
      {/* Enhanced background with motion gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.15), rgba(125, 211, 252, 0.05), transparent)',
          filter: 'blur(120px)',
          transform: `translateY(${interpolate(frame, [0, 300], [0, -20], {
            extrapolateLeft: 'extend',
            extrapolateRight: 'extend',
          })}px)`,
        }}
      />

      {/* Additional floating background elements */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: 200,
          height: 200,
          background:
            'radial-gradient(circle, rgba(125, 211, 252, 0.1), transparent)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          transform: `translateY(${interpolate(frame, [0, 200], [0, 15], {
            extrapolateLeft: 'extend',
            extrapolateRight: 'extend',
          })}px)`,
        }}
      />

      {/* overlay removed – list rows handle their own intro text */}

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
              backgroundColor: '#334155',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 19,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            PLAN
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

          <AnimatedTaskList
            items={planItems}
            placeholders={placeholderWords}
            revealDelay={revealDelay}
            animationStyle="execute"   // reuse ExecuteScene bounce-in
            disableCompleteAnimation={true}
          />
        </div>

        {/* Execute Plan button */}
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
            Execute Plan
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
