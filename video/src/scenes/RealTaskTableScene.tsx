import React from 'react';
import { AbsoluteFill } from 'remotion';
import { SimpleTaskTableForVideo } from '../frontend-components/SimpleTaskTableForVideo';

export const RealTaskTableScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <SimpleTaskTableForVideo />
    </AbsoluteFill>
  );
};