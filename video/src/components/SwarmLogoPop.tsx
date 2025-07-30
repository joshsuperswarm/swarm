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
 * • Every 40 f   : 5-frame scale ping + glow
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

  // Looping ping (starts once pop finished)
  const local = frame % 40; // 0-39
  const ping = interpolate(local, [0, 5, 20], [1, 1.05, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = pop * ping;
  const glow = (ping - 1) * 8; // 0 → ~0.4 → 0

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Img
        src={staticFile('swarm-logo.svg')}
        style={{
          width: size,
          transform: `scale(${scale})`,
          filter: `drop-shadow(0 0 ${glow}px rgba(125,211,252,0.55))`,
        }}
      />
    </AbsoluteFill>
  );
};