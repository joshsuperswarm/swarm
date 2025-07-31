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
import { Zap, FileText, Eye } from 'lucide-react';

/**
 * CreateTaskScene - Sequential Animations
 * -------------------------------------------------------------------
 * Sequential micro-animations for better visual flow:
 *
 * Animation timeline (frames @ 30fps):
 *   0-72     → Mode chip cycles Execute → Review → Plan (2 clicks)
 *   72-130   → Title typewriter (cursor blinks)
 *   130-229  → Description text typewriter (cursor blinks)
 *   268-272  → "Create Task" button slam & bounce animation
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

  /** NEW timeline */
  const modeStart = 0;
  const modePhase = 24;
  const titleStart = modeStart + modePhase * 3; // 72
  const descStart = titleStart + 30; // 102
  const slamFrame = 196 + modePhase * 3; // 268

  /** Timing helpers */
  const titleProg = interpolate(frame, [titleStart, titleStart + 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const descProg = interpolate(frame, [descStart, descStart + 99], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Helper giving 0..1 inside each phase
  const phase = (f: number) =>
    Math.min(1, Math.max(0, (f - modeStart) / modePhase));

  const execPhase = phase(frame); // 0-24
  const reviewPhase = phase(frame - modePhase); // 24-48
  const planPhase = phase(frame - modePhase * 2); // 48-72

  // Derive the display label, icon & colors
  type ModeState = 'Execute' | 'Review' | 'Plan';
  const state: ModeState =
    planPhase > 0 ? 'Plan' : reviewPhase > 0 ? 'Review' : 'Execute';

  const icon =
    state === 'Execute' ? Zap : state === 'Review' ? Eye : FileText;

  const color =
    state === 'Execute'
      ? '#10b981' // green
      : state === 'Review'
      ? '#facc15' // yellow
      : '#7dd3fc'; // blue

  // Animate the "pop" per transition
  const modePop = spring({
    fps,
    frame:
      frame -
      modeStart -
      (state === 'Execute'
        ? 0
        : state === 'Review'
        ? modePhase
        : modePhase * 2),
    config: { damping: 120, stiffness: 180 },
  });
  const scale = interpolate(modePop, [0, 1], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // ─── Button slam animation ───
  /**
   * Starts at frame 268 to account for the mode cycling time shift.
   */
  const pressSpring = spring({
    fps,
    frame: Math.max(frame - slamFrame, 0), // begin at appearance
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
  const clickLen = 8; // 8 frames ≈ 0.33 s @ 30 fps

  // ─── Typing SFX ───
  const titleTypingStart     = titleStart;
  const titleTypingDuration  = 58;   // title still instant; leave as-is
  const descTypingStart      = descStart;  // now 30 f sooner
  const descTypingDuration   = 99;

  /** Title - no animation, appears immediately */
  const fullTitle = 'Create a Remotion video for Swarm';

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
            {fullTitle}
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
                transform: `scale(${scale})`,
                backgroundColor: `${color}1a`, // add alpha
                color: color,
                border: `1px solid ${color}40`,
                transition: 'none', // driven purely by Remotion
              }}
            >
              {React.createElement(icon, { size: 22 })}
              {state}
            </div>
          </div>

          {/* Description textarea with typewriter animation */}
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: 28,            // even padding
              minHeight: 190,
              height: 190,            // fixed box height
              display: 'flex',        // NEW
              flexDirection: 'column',// NEW
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

      {/* Description typing sound */}
      <Sequence from={descTypingStart} durationInFrames={descTypingDuration}>
        <Audio
          src={staticFile('Mechanical Keyboard Typing Sound.mp3')}
          volume={0.3}                     // lower volume for background typing
        />
      </Sequence>

      {/* Mode transition clicks */}
      <Sequence from={modeStart + modePhase - 2} durationInFrames={clickLen}>
        <Audio src={staticFile('Mouse Click Sound.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={modeStart + modePhase * 2 - 2} durationInFrames={clickLen}>
        <Audio src={staticFile('Mouse Click Sound.wav')} volume={0.8} />
      </Sequence>

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
