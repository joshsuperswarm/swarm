import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill
} from 'remotion';
import { X, Zap, FileText } from 'lucide-react';

export const CreateTaskScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Animation phases (60 frames total):
  // 0-10: Modal fade/scale in
  // 10-35: Auto-type description  
  // 35-45: Mode cycle (execute → plan)
  // 45-60: Create button glow and completion

  // Modal animation
  const modalScale = interpolate(frame, [0, 10], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const modalOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Text typing animation
  const fullText = "Implement JWT authentication system";
  const typingProgress = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentText = fullText.substring(0, Math.floor(fullText.length * typingProgress));

  // Mode cycling animation (execute → plan)
  const showPlanMode = frame >= 35 && frame < 50;
  
  // Submit button animation
  const submitGlow = interpolate(frame, [45, 50, 55, 60], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Modal backdrop overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: modalOpacity,
        }}
      />

      {/* Modal container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
        }}
      >
        {/* Modal content - matching CreateTaskModal exactly */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 12,
            maxWidth: 640,
            width: width * 0.6,
            padding: 16,
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#111827',
                margin: 0,
              }}
            >
              Create New Task
            </h2>
            <div style={{ color: '#9ca3af' }}>
              <X size={20} />
            </div>
          </div>

          {/* Repository info */}
          <div
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              backgroundColor: '#f9fafb',
              marginBottom: 12,
            }}
          >
            <p
              style={{
                color: '#374151',
                fontSize: 14,
                margin: 0,
              }}
            >
              <strong>company/swarm</strong> (Private)
            </p>
          </div>

          {/* Mode selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#374151',
                }}
              >
                Mode:
              </span>
              <button
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: '500',
                  border: '1px solid',
                  backgroundColor: showPlanMode ? '#eff6ff' : '#f0fdf4',
                  borderColor: showPlanMode ? '#bfdbfe' : '#bbf7d0',
                  color: showPlanMode ? '#1d4ed8' : '#166534',
                  cursor: 'pointer',
                }}
              >
                {showPlanMode ? (
                  <>
                    <FileText size={14} />
                    Plan
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    Execute
                  </>
                )}
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#6b7280',
                opacity: showPlanMode ? 1 : 0,
              }}
            >
              Shift+Tab to cycle
            </div>
          </div>

          {/* Description textarea */}
          <div style={{ marginBottom: 12 }}>
            <textarea
              value={currentText}
              readOnly
              rows={3}
              style={{
                width: '100%',
                padding: '4px 0',
                fontSize: 16,
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                color: '#111827',
                backgroundColor: 'transparent',
              }}
              placeholder="Describe the task..."
            />
            {/* Typing cursor */}
            {typingProgress < 1 && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 20,
                  backgroundColor: '#111827',
                  opacity: interpolate(frame % 30, [0, 15, 30], [1, 0, 1]),
                }}
              />
            )}
          </div>

          {/* Submit button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: 4,
            }}
          >
            <button
              style={{
                padding: '8px 16px',
                fontSize: 14,
                color: '#ffffff',
                backgroundColor: '#111827',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                boxShadow: submitGlow > 0 ? `0 0 20px rgba(16, 185, 129, ${submitGlow})` : 'none',
                transform: submitGlow > 0 ? `scale(${1 + submitGlow * 0.03})` : 'scale(1)',
                transition: 'all 0.2s ease',
              }}
            >
              Create Task
            </button>
          </div>
        </div>
      </div>

      {/* Subtle background gradient */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 800,
          height: 600,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(125, 211, 252, 0.05), transparent)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          zIndex: -1,
        }}
      />
    </AbsoluteFill>
  );
};