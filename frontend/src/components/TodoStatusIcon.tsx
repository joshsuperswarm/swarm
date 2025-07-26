import { Circle } from 'lucide-react'; // outline
import React from 'react';

interface Props { completed: boolean; size?: number }

/**
 * Renders ○ for open todos and ● for completed ones, using a single Lucide
 * <Circle> and the `fill` SVG attribute. Defaults to 12 px.
 */
export const TodoStatusIcon: React.FC<Props> = ({
  completed,
  size = 12,
}) => (
  <Circle
    size={size}
    strokeWidth={2}
    className={completed ? 'text-gray-500' : 'text-gray-400'}
    style={{ fill: completed ? 'currentColor' : 'none' }}
    aria-label={completed ? 'completed todo' : 'open todo'}
  />
);