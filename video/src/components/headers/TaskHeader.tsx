import React from 'react';
import { PhaseBadge } from './PhaseBadge';
import type { Phase } from '../../types';

interface TaskHeaderProps {
  id: number;
  title: string;
  phase: Phase;
}

export const TaskHeader: React.FC<TaskHeaderProps> = ({ id, title, phase }) => (
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
    <div
      style={{
        fontSize: 29,
        fontWeight: 600,
        color: '#7dd3fc',
      }}
    >
      #{id}
    </div>
    <PhaseBadge phase={phase} />
    <h2
      style={{
        margin: 0,
        fontSize: 38,
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.95)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
      }}
    >
      {title}
    </h2>
  </div>
);