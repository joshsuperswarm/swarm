import React from 'react';
import { Sparkles, Zap } from 'lucide-react';

export type ClaudeModel = 'sonnet' | 'opus';

interface ModelSelectorProps {
  model: ClaudeModel;
  onModelChange: (model: ClaudeModel) => void;
  className?: string;
}

const modelInfo = {
  sonnet: {
    name: 'Sonnet',
    description: 'Fast and cost-effective for most tasks',
    icon: Zap,
  },
  opus: {
    name: 'Opus',
    description: 'Advanced reasoning for complex problems (5x cost)',
    icon: Sparkles,
  },
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  model, 
  onModelChange, 
  className = '' 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Claude Model
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(modelInfo) as ClaudeModel[]).map((modelKey) => {
          const info = modelInfo[modelKey];
          const Icon = info.icon;
          const isSelected = model === modelKey;
          
          return (
            <button
              key={modelKey}
              type="button"
              onClick={() => onModelChange(modelKey)}
              className={`
                relative flex items-center p-3 text-left rounded-lg border-2 transition-all
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 text-blue-900' 
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <Icon className={`mr-3 h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
              <div className="flex-1">
                <div className="font-medium">{info.name}</div>
                <div className="text-xs text-gray-500 mt-1">{info.description}</div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};