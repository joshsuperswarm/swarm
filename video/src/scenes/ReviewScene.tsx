import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';

const planItems = [
  'Storyboard key scenes (intro, create task, plan, outro)',
  'Build React components for each scene',
  'Animate with Remotion interpolate & spring',
  'Add gradients, typography, and on-brand colors'
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
    frame: frame - 30,
    config: { damping: 140, stiffness: 200 },
  });

  // ─── Button slam animation ───
  /**
   * Starts at frame 71 (4 frames before scene ends) to match other button timing.
   * ReviewScene has 75 frames, so starts at 75-4=71.
   */
  const pressSpring = spring({
    fps,
    frame: frame - 71,      // begin at appearance
    config: { damping: 12, stiffness: 280, mass: 1.2 },
  });
  /* Scale goes from 1  →  0.88  →  1.02  →  1
     TranslateY goes from 0px →  8px  → -4px → 0px */
  const pressScale = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [1, 0.88, 1.02, 1],
  );
  const pressTranslate = interpolate(
    pressSpring,
    [0, 0.5, 0.8, 1],
    [0, 8, -4, 0],
  );

  // Status is always "REVIEWING" in this scene
  const statusTransition = 1; // Always shows REVIEWING

  // Plan item animations
  const getPlanItemSpring = (index: number) =>
    spring({
      fps,
      frame: frame - 10 - index * 5,
      config: { damping: 140, stiffness: 200 },
    });

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
          width: '85%',
          maxWidth: 900,
          opacity: planSpring,
        }}
      >
        {/* Task header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
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
              transition: 'background-color 0.3s ease',
            }}
          >
            REVIEWING
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
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
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            Execution Plan
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {planItems.map((item, index) => {
              const itemSpring = getPlanItemSpring(index);
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 8,
                    opacity: itemSpring,
                    transform: `translateY(${(1 - itemSpring) * 20}px)`,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#7dd3fc',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.85)',
                    }}
                  >
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
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
              padding: '12px 24px',
              backgroundColor: '#7dd3fc',
              color: '#0e0e10',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
              transform: `translateY(${pressTranslate}px) scale(${pressScale})`,
              boxShadow: `0 ${4 + pressSpring * 8}px 24px rgba(0,0,0,${
                0.25 + pressSpring * 0.15
              })`,
              transition: 'none', // driven purely by Remotion
            }}
          >
            Merge PR
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};