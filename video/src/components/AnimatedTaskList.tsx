import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

interface AnimatedTaskListProps {
  /** Lines to render */
  items: string[];
  /** Optional placeholder shown *until* the row is completed */
  placeholders?: readonly string[];
  /** Pass "execute" to reuse ExecuteScene row animation */
  animationStyle?: 'default' | 'execute';
  /** Frames to wait before the list starts animating (default 0) */
  revealDelay?: number;
  /** Disable the completion/done animation (default false) */
  disableCompleteAnimation?: boolean;
}

export const AnimatedTaskList: React.FC<AnimatedTaskListProps> = ({
  items,
  placeholders,
  animationStyle = 'default',
  revealDelay = 0,
  disableCompleteAnimation = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ─── helper fns copied from PlanScene ────────────────────────────── */
  const itemSpring = (i: number) =>
    spring({
      fps,
      frame: Math.max(frame - revealDelay - 17 - i * 8, 0),
      config: animationStyle === 'execute' 
        ? { damping: 140, stiffness: 200 } 
        : { damping: 120, stiffness: 180 },
    });

  const floatOffset = (i: number) =>
    interpolate(frame + i * 5, [0, 60, 120], [0, -3, 0], {
      extrapolateLeft: "extend",
      extrapolateRight: "extend",
    });

  const pulse = (i: number) => {
    const completeF = 60 + i * 15;
    const strikeEnd = completeF + 30;
    const active = frame > completeF && frame <= strikeEnd;
    if (!active) return 0;
    return interpolate(
      (frame - completeF) % 60,
      [0, 15, 30, 45, 60],
      [0, 0.3, 0, 0.3, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  };
  /* ─────────────────────────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((txt, i) => {
        const s = itemSpring(i);
        const y = floatOffset(i);
        const glow = disableCompleteAnimation ? 0 : pulse(i);
        const completeFrame = 60 + i * 15;
        const done = disableCompleteAnimation ? false : frame > completeFrame;
        
        // Typewriter replacement from placeholder to actual text
        const placeholder = placeholders?.[i];
        
        // Typewriter transition starts 30 frames before completion
        const typewriterStart = completeFrame - 30;
        const typewriterProgress = interpolate(
          frame,
          [typewriterStart, completeFrame],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        
        // Calculate display text with typewriter effect
        let displayText: string;
        if (!placeholder || frame < typewriterStart) {
          // Show placeholder normally before typewriter starts
          displayText = placeholder || txt;
        } else if (frame < completeFrame) {
          // During typewriter transition: gradually replace characters
          const targetLength = Math.floor(txt.length * typewriterProgress);
          const actualPart = txt.slice(0, targetLength);
          const placeholderPart = placeholder.slice(targetLength);
          displayText = actualPart + placeholderPart;
        } else {
          // After completion: show full actual text
          displayText = txt;
        }

        return (
          <div
            key={txt + i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 21px",
              backgroundColor: `rgba(255,255,255,${0.05 + glow * 0.1})`,
              borderRadius: 8,
              opacity: s,
              transform: `translateY(${(1 - s) * 20 + y}px)`,
              fontFamily:
                '-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,"Helvetica Neue",Arial,sans-serif',
              boxShadow: `0 0 ${20 + glow * 10}px rgba(125,211,252,${
                glow * 0.4
              })`,
              border: `1px solid rgba(125,211,252,${0.1 + glow * 0.3})`,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: done ? "#4ade80" : "#7dd3fc",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 22,
                color: done
                  ? "rgba(148,163,184,0.75)"
                  : "rgba(255,255,255,0.85)",
                fontFamily: 'monospace', // Use monospace for consistent character widths during typewriter effect
              }}
            >
              {displayText}
            </span>
          </div>
        );
      })}
    </div>
  );
};