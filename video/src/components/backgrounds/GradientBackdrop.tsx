import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface GradientBackdropProps {
  variant?: 'radial' | 'linear' | 'multi';
  intensity?: number;
  withFloatingBlobs?: boolean;
  animate?: boolean;
}

export const GradientBackdrop: React.FC<GradientBackdropProps> = ({
  variant = 'radial',
  intensity = 0.1,
  withFloatingBlobs = true,
  animate = true,
}) => {
  const frame = useCurrentFrame();

  const getMainGradient = () => {
    switch (variant) {
      case 'linear':
        return `linear-gradient(135deg, rgba(125, 211, 252, ${intensity}), rgba(99, 102, 241, ${intensity * 0.6}), transparent)`;
      case 'multi':
        return `linear-gradient(135deg, rgba(125, 211, 252, ${intensity}), rgba(99, 102, 241, ${intensity * 0.8}), rgba(62, 189, 147, ${intensity * 0.6}), transparent)`;
      case 'radial':
      default:
        return `radial-gradient(ellipse at center, rgba(125, 211, 252, ${intensity}), rgba(99, 102, 241, ${intensity * 0.6}), transparent)`;
    }
  };

  const animatedTransform = animate
    ? `translateY(${interpolate(frame, [0, 300], [0, -20], {
        extrapolateLeft: 'extend',
        extrapolateRight: 'extend',
      })}px)`
    : 'none';

  return (
    <>
      {/* Main background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: getMainGradient(),
          filter: 'blur(120px)',
          transform: animatedTransform,
        }}
      />

      {/* Floating blobs */}
      {withFloatingBlobs && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '20%',
              right: '10%',
              width: 200,
              height: 200,
              background: `radial-gradient(circle, rgba(99, 102, 241, ${intensity * 0.8}), transparent)`,
              borderRadius: '50%',
              filter: 'blur(80px)',
              transform: animate
                ? `translateX(${interpolate(frame, [0, 300], [0, 15], {
                    extrapolateLeft: 'extend',
                    extrapolateRight: 'extend',
                  })}px)`
                : 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '25%',
              left: '15%',
              width: 150,
              height: 150,
              background: `radial-gradient(circle, rgba(125, 211, 252, ${intensity * 0.6}), transparent)`,
              borderRadius: '50%',
              filter: 'blur(60px)',
              transform: animate
                ? `translateY(${interpolate(frame, [0, 300], [0, 10], {
                    extrapolateLeft: 'extend',
                    extrapolateRight: 'extend',
                  })}px)`
                : 'none',
            }}
          />
        </>
      )}
    </>
  );
};