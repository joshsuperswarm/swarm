import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

// Default animation configurations
export const POP_DEFAULT = { damping: 120, stiffness: 180 };
export const SLAM_DEFAULT = { damping: 12, stiffness: 280, mass: 1.2 };
export const SMOOTH_DEFAULT = { damping: 140, stiffness: 200 };

// Reusable spring animation hook
export const popSpring = (
  frame: number,
  fps: number,
  config = POP_DEFAULT
) => spring({ fps, frame, config });

// Button slam animation hook
export const useSlam = (frameOffset = 4) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const springVal = spring({ 
    fps, 
    frame: Math.max(frame - frameOffset, 0),
    config: SLAM_DEFAULT 
  });
  
  return {
    scale: interpolate(springVal, [0, 0.5, 0.8, 1], [1, 0.88, 1.02, 1]),
    translateY: interpolate(springVal, [0, 0.5, 0.8, 1], [0, 8, -4, 0]),
    depth: springVal, // convenient extra if you need z-fade
  };
};

// General purpose spring hook with customizable config
export const useSpring = (frameOffset = 0, config = POP_DEFAULT) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  return spring({
    fps,
    frame: Math.max(frame - frameOffset, 0),
    config,
  });
};

// Typewriter animation helper
export const useTypewriter = (
  text: string,
  startFrame: number,
  duration: number,
  showCursor = true
) => {
  const frame = useCurrentFrame();
  
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const visibleLength = Math.floor(progress * text.length);
  const visibleText = text.substring(0, visibleLength);
  
  // Cursor blink
  const shouldShowCursor = showCursor && 
    Math.floor((frame - startFrame) / 15) % 2 === 0;
  
  return {
    visibleText,
    cursor: shouldShowCursor ? '|' : '',
    progress,
  };
};