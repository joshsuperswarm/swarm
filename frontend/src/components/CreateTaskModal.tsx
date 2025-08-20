import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, Sparkles } from 'lucide-react';
import { RunModeButton } from '@/components/RunModeButton';
import type { RunMode, ClaudeModel } from '@/services/api';
import type { RepositoryTS } from '@/types/generated/RepositoryTS';

interface CreateTaskData {
  description: string;
  repositoryId: number | null;
  mode: RunMode;
  model: ClaudeModel;
}

interface CreateTaskFormData {
  description: string;
  repositoryId: number | null;
  mode: RunMode;
  model: ClaudeModel;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: CreateTaskData) => void;
  defaultRepository: RepositoryTS | null;
}


export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateTask,
  defaultRepository
}) => {
  const [formData, setFormData] = useState<CreateTaskFormData>({
    description: '',
    repositoryId: null,
    mode: 'execute',
    model: 'sonnet'
  });
  
  const [loading, setLoading] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Run mode cycling
  const runModes: RunMode[] = ['execute', 'chat'];
  
  const cycleRunMode = () => {
    const currentIndex = runModes.indexOf(formData.mode);
    const nextIndex = (currentIndex + 1) % runModes.length;
    setFormData(prev => ({ ...prev, mode: runModes[nextIndex] }));
  };

  
  // Model cycling
  const models: ClaudeModel[] = ['sonnet', 'opus'];
  
  const cycleModel = () => {
    const currentIndex = models.indexOf(formData.model);
    const nextIndex = (currentIndex + 1) % models.length;
    setFormData(prev => ({ ...prev, model: models[nextIndex] }));
  };
  
  const getModelConfig = (model: ClaudeModel) => {
    switch (model) {
      case 'sonnet':
        return { icon: Zap, label: 'Sonnet', color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700', description: 'Fast and cost-effective' };
      case 'opus':
        return { icon: Sparkles, label: 'Opus', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700', description: 'Advanced reasoning (5x cost)' };
    }
  };
  
  // Initialize repository when modal opens or when default changes
  useEffect(() => {
    if (isOpen && defaultRepository && !formData.repositoryId) {
      setFormData(prev => ({ ...prev, repositoryId: defaultRepository.id }));
    }
  }, [isOpen, defaultRepository, formData.repositoryId]);

  // Auto-focus description input when modal opens and handle body lock
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element
      lastActiveElementRef.current = document.activeElement as HTMLElement;
      
      document.body.classList.add('body-lock');
      if (descriptionInputRef.current) {
        // Small delay to ensure modal is fully rendered
        setTimeout(() => {
          descriptionInputRef.current?.focus();
        }, 100);
      }
    } else {
      // Restore focus to the previously focused element when modal closes
      if (lastActiveElementRef.current) {
        setTimeout(() => {
          lastActiveElementRef.current?.focus();
        }, 100);
      }
    }
    return () => document.body.classList.remove('body-lock');
  }, [isOpen]);

  // Add a mount guard (dev aid)
  useEffect(() => {
    if (!isOpen) return;
    if (import.meta.env.DEV) {
      const others = document.querySelectorAll('[data-create-task-modal="true"]');
      if (others.length > 1) {
        console.warn('CreateTaskModal mounted more than once!', others);
      }
    }
  }, [isOpen]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim() || !formData.repositoryId) return;

    // Sanitize data: trim description
    const sanitizedData: CreateTaskData = {
      ...formData,
      description: formData.description.trim(),
    };

    setLoading(true);
    onCreateTask(sanitizedData);

    // Reset form but preserve mode and model preference
    setFormData(prev => ({
      description: '',
      repositoryId: null,
      mode: prev.mode,
      model: prev.model
    }));

    setLoading(false);
  };

  const handleChange = (field: keyof CreateTaskFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50"
      data-create-task-modal="true"
      // Key handling at the container; do not let it bubble to window
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          // Some environments need this to be extra safe:
          if (e.nativeEvent && 'stopImmediatePropagation' in e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
            e.nativeEvent.stopImmediatePropagation();
          }
          onClose();
        }
        
        // Handle Shift+Tab for mode cycling
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          cycleRunMode();
        }
      }}
      // Close on overlay click, but not when clicking content
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-full h-[100dvh] md:h-auto md:max-w-2xl rounded-t-2xl md:rounded-lg p-4 safe-pt safe-pb overflow-auto"
        // prevent clicks from closing
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="create-task-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors touch-target"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // Let the form submit but prevent bubbling to window handlers
              e.stopPropagation();
            }
          }}
          className="space-y-3"
        >
          {defaultRepository ? (
            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                <strong>{defaultRepository.full_name}</strong> {defaultRepository.is_private ? '(Private)' : '(Public)'}
              </p>
            </div>
          ) : (
            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No default repository set. Please set a default repository in your settings.
              </p>
            </div>
          )}

          {/* Run Mode and Model Buttons */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mode:</span>
              <RunModeButton
                mode={formData.mode}
                onClick={cycleRunMode}
                size="md"
                showLabel={true}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model:</span>
              <button
                type="button"
                onClick={cycleModel}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors touch-target ${getModelConfig(formData.model).color}`}
                title={getModelConfig(formData.model).description}
              >
                {React.createElement(getModelConfig(formData.model).icon, { size: 14 })}
                {getModelConfig(formData.model).label}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <textarea
              ref={descriptionInputRef}
              id="description"
              required
              value={formData.description}
              onChange={handleChange('description')}
              rows={3}
              className="w-full px-0 py-1 text-base text-gray-900 dark:text-gray-100 bg-transparent placeholder:text-gray-500 dark:placeholder:text-gray-400 field focus:outline-none resize-none"
              placeholder="Describe the task..."
            />
          </div>


          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading || !defaultRepository || !formData.description.trim()}
              className="px-4 py-2 text-sm text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 rounded-md transition-colors touch-target"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};