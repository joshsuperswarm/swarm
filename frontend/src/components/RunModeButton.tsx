import React from 'react';
import { Zap, MessageSquare } from 'lucide-react';
import type { RunMode } from '@/services/api';

export interface RunModeConfig {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
  description: string;
}

export const getModeConfig = (mode: RunMode): RunModeConfig => {
  switch (mode) {
    case 'execute':
      return { 
        icon: Zap, 
        label: 'Execute', 
        color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700', 
        description: 'Execute changes immediately' 
      };
    case 'chat':
      return { 
        icon: MessageSquare, 
        label: 'Chat', 
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700', 
        description: 'Chat, plan, analyze, and review code' 
      };
  }
};

interface RunModeButtonProps {
  mode: RunMode;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  title?: string;
}

export const RunModeButton: React.FC<RunModeButtonProps> = ({ 
  mode, 
  onClick, 
  className = '',
  size = 'md',
  showLabel = true,
  title
}) => {
  const config = getModeConfig(mode);
  
  const sizeClasses = {
    sm: 'px-2 py-2 text-xs',
    md: 'px-3 py-2 text-sm'
  };
  
  const iconSize = size === 'sm' ? 12 : 14;
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${sizeClasses[size]} rounded-md font-medium border transition-colors touch-target ${config.color} ${className}`}
      title={title || `${config.description} (Shift+Tab to cycle)`}
    >
      <config.icon size={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </button>
  );
};