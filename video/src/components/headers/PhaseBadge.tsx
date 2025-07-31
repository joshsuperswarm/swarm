import React from 'react';
import type { Phase } from '../../types';

interface PhaseBadgeProps {
  phase: Phase;
}

const phaseStyles = {
  CREATE: {
    background: '#6366f1',
    color: '#ffffff'
  },
  PLAN: {
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: '#ffffff'
  },
  EXECUTE: {
    background: 'linear-gradient(135deg, #3ebd93, #1f7c6d)',
    color: '#ffffff'
  },
  REVIEW: {
    background: '#7dd3fc',
    color: '#0e0e10'
  }
};

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ phase }) => {
  const style = phaseStyles[phase] || phaseStyles.CREATE;
  
  return (
    <div
      style={{
        padding: '8px 21px',
        background: style.background,
        color: style.color,
        borderRadius: 6,
        fontSize: 19,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}
    >
      {phase.toLowerCase()}
    </div>
  );
};