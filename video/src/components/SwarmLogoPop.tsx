import {
  AbsoluteFill,
  Img,
  staticFile,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * SwarmLogoPop
 * -------------
 * • Frames 0-18  : spring-overshoot (0.6 → 1.15 → 1)
 * • Frames 0-120 : continuous slow scale-up to 1.11×
 *
 * Accepts optional `size` so you can reuse it elsewhere.
 */
export const SwarmLogoPop: React.FC<{ size?: number }> = ({ size = 420 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry pop
  const pop = spring({
    fps,
    frame,
    config: { mass: 0.8, damping: 18, stiffness: 240 },
  });

  // Slow, linear expansion after entry (runs for the first 120 frames)
  const slowGrow = interpolate(
    frame,
    [0, 120],          // adjust if Intro scene length changes
    [1, 1.11],         // ~11% larger by frame 120
    { extrapolateRight: 'clamp' }
  );

  const scale = pop * slowGrow;

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Img
        src={staticFile('swarm-logo.svg')}
        style={{
          width: size,
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};