import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  spring
} from 'remotion';
import { Zap, FileText } from 'lucide-react';

/**
 * New CreateTaskScene
 * -------------------------------------------------------------------
 * Visual style & animation model now mirrors ExecutePlanScene so that
 * both scenes share a unified dark aesthetic, spring‑based entrance,
 * and accent palette (#7dd3fc / indigo / emerald).
 *
 * Animation timeline (frames):
 *   0‑10   card scales & fades in (containerSpring)
 *   10‑40  title auto‑types (typingProgress)
 *   45‑65  mode chip cycles Execute → Plan (showPlan)
 *   70‑85  submit button pulses (submitGlow)
 */
export const CreateTaskScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /** Card entrance */
  const containerSpring = spring({ fps, frame, config: { damping: 120, stiffness: 180 } });

  /** Title typewriter */
  const fullTitle = 'Implement JWT authentication system';
  const typingProgress = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentTitle = fullTitle.substring(0, Math.floor(fullTitle.length * typingProgress));

  /** Mode chip toggles Execute → Plan */
  const showPlan = frame >= 45 && frame < 65;

  /** CTA pulse */
  const submitGlow = interpolate(frame, [70, 75, 80, 85], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  /** Blinking cursor opacity */
  const cursorOpacity = interpolate(frame % 30, [0, 15, 30], [1, 0, 1]);

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
          width: '85%',
          maxWidth: 900,
          opacity: containerSpring,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, color: '#7dd3fc' }}>#63</div>

          <div
            style={{
              padding: '6px 16px',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Create
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)',
              maxWidth: '80%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentTitle}
            {typingProgress < 1 && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: '1em',
                  backgroundColor: '#ffffff',
                  marginLeft: 2,
                  opacity: cursorOpacity,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Mode:</span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: showPlan ? 'rgba(96,165,250,0.1)' : 'rgba(16,185,129,0.1)',
                color: showPlan ? '#60a5fa' : '#10b981',
                transition: 'all 0.3s ease',
              }}
            >
              {showPlan ? <FileText size={14} /> : <Zap size={14} />}
              {showPlan ? 'Plan' : 'Execute'}
            </div>
          </div>

          {/* Description textarea placeholder */}
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: 16,
              minHeight: 120,
            }}
          >
            {/* Show placeholder once typing finished */}
            {typingProgress >= 1 && (
              <p style={{ margin: 0, fontSize: 16, color: 'rgba(255, 255, 255, 0.9)' }}>
                Describe the task in detail...
              </p>
            )}
          </div>
        </div>

        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
              boxShadow: submitGlow > 0 ? `0 0 20px rgba(125, 211, 252, ${submitGlow})` : 'none',
              transform: submitGlow > 0 ? `scale(${1 + submitGlow * 0.05})` : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          >
            Create Task
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};