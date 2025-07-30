import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring,
} from 'remotion';
import { Zap, FileText } from 'lucide-react';

/**
 * CreateTaskScene - Sequential Animations
 * -------------------------------------------------------------------
 * Sequential micro-animations for better visual flow:
 *
 * Animation timeline (frames @ 30fps):
 *   0-58     → Title typewriter (cursor blinks)
 *   59-158   → Description text typewriter (cursor blinks)
 *   159-192  → Mode chip cross-fades Execute → Plan
 *   196-200  → "Create Task" button slam & bounce animation
 */
export const CreateTaskScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /** Card entrance */
  const containerSpring = spring({
    fps,
    frame,
    config: { damping: 120, stiffness: 180 },
  });

  /** Timing helpers */
  const titleProg = interpolate(frame, [0, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const descProg = interpolate(frame, [59, 158], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const modeProg = spring({
    frame: Math.max(frame - 159, 0), // ensures 0 at start
    fps,
    config: { damping: 120, stiffness: 180 },
  });

  // Enhanced mode transition animations
  const modeTransition = interpolate(
    modeProg,
    [0, 0.3, 0.5, 0.7, 1],
    [0, 0, 0.5, 1, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Scale animation for mode switch - creates a "pop" effect
  const modeScale = interpolate(
    modeProg,
    [0, 0.3, 0.5, 0.7, 1],
    [1, 1, 1.15, 1.05, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Flash effect during transition
  const modeFlash = interpolate(
    modeProg,
    [0, 0.4, 0.5, 0.6, 1],
    [0, 0, 1, 0, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  // ─── Button slam animation ───
  /**
   * Starts at frame 196 (4 frames before scene ends) to match other scenes.
   * CreateTaskScene has 200 frames, so starts at 200-4=196.
   */
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - 196, 0), // begin at appearance
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

  /** Title typewriter */
  const fullTitle = 'Create a Remotion video for Swarm';
  const typedTitle = fullTitle.slice(
    0,
    Math.floor(fullTitle.length * titleProg)
  );

  /** Description typewriter with bullets */
  const bulletLines = [
    'Storyboard key scenes (intro, create task, plan, outro)',
    'Build React components for each scene',
    'Animate with Remotion interpolate & spring',
    'Add gradients, typography, and on-brand colors',
  ];
  const fullDesc = bulletLines.map((l) => `• ${l}`).join('\n');
  const typedDesc = fullDesc.slice(0, Math.floor(fullDesc.length * descProg));
  const trimmedDesc = typedDesc.trimEnd();

  return (
    <AbsoluteFill>
      {/* Background gradient (shared with ExecutePlanScene) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.1), transparent)',
          filter: 'blur(100px)',
        }}
      />

      {/* Center container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${containerSpring})`,
          width: '90%',
          maxWidth: 1200,
          opacity: containerSpring,
        }}
      >
        {/* Header */}
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
          <div style={{ fontSize: 29, fontWeight: 600, color: '#7dd3fc' }}>
            #63
          </div>

          <div
            style={{
              padding: '8px 21px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 19,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Create
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
              maxWidth: '80%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {typedTitle}
            {titleProg < 1 && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: '1em',
                  backgroundColor: '#ffffff',
                  marginLeft: 2,
                  opacity: interpolate(frame % 50, [0, 25, 50], [1, 0, 1]),
                }}
              />
            )}
          </h2>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: '#111315',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: 24,
            marginBottom: 24,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          {/* Mode selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 31,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Mode:
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 22,
                fontWeight: 500,
                transform: `scale(${modeScale})`,
                backgroundColor:
                  modeTransition < 0.5
                    ? 'rgba(16,185,129,0.1)'
                    : `rgba(${interpolate(modeTransition, [0, 1], [16, 96])}, ${interpolate(modeTransition, [0, 1], [185, 165])}, ${interpolate(modeTransition, [0, 1], [129, 250])}, 0.1)`,
                color:
                  modeTransition < 0.5
                    ? '#10b981'
                    : `rgb(${interpolate(modeTransition, [0, 1], [16, 96])}, ${interpolate(modeTransition, [0, 1], [185, 165])}, ${interpolate(modeTransition, [0, 1], [129, 250])})`,
                boxShadow: `0 0 ${modeFlash * 20}px rgba(125, 211, 252, ${modeFlash * 0.8})`,
                border: `1px solid rgba(125, 211, 252, ${modeFlash * 0.5})`,
                transition: 'none', // driven purely by Remotion
              }}
            >
              {modeTransition < 0.5 ? (
                <Zap size={22} />
              ) : (
                <FileText size={22} />
              )}
              {modeTransition < 0.5 ? 'Execute' : 'Plan'}
            </div>
          </div>

          {/* Description textarea with typewriter animation */}
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              paddingTop: 28,
              paddingLeft: 21,
              paddingRight: 21,
              paddingBottom: 35,
              minHeight: 190,
              height: 190,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            <pre
              style={{
                margin: 0,
                fontSize: 26,
                color: 'rgba(255,255,255,0.9)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.3,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              }}
            >
              {trimmedDesc}
              {descProg < 1 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: '1em',
                    background: '#fff',
                    marginLeft: 2,
                    opacity: interpolate(frame % 50, [0, 25, 50], [1, 0, 1]),
                  }}
                />
              )}
            </pre>
          </div>
        </div>

        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
            Create Task
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
