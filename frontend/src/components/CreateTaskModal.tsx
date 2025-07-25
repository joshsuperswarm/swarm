import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, FileText, Search } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import type { RunMode } from '@/services/api';

interface CreateTaskData {
  description: string;
  repositoryId: number | null;
  mode: RunMode;
}

interface CreateTaskFormData {
  description: string;
  repositoryId: number | null;
  mode: RunMode;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: CreateTaskData) => void;
}


export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateTask 
}) => {
  const [formData, setFormData] = useState<CreateTaskFormData>({
    description: '',
    repositoryId: null,
    mode: 'execute'
  });
  
  const [loading, setLoading] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Run mode cycling
  const runModes: RunMode[] = ['execute', 'plan', 'review'];
  
  const cycleRunMode = () => {
    const currentIndex = runModes.indexOf(formData.mode);
    const nextIndex = (currentIndex + 1) % runModes.length;
    setFormData(prev => ({ ...prev, mode: runModes[nextIndex] }));
  };

  const getModeConfig = (mode: RunMode) => {
    switch (mode) {
      case 'execute':
        return { icon: Zap, label: 'Execute', color: 'text-green-600 bg-green-50 border-green-200', description: 'Execute changes immediately' };
      case 'plan':
        return { icon: FileText, label: 'Plan', color: 'text-blue-600 bg-blue-50 border-blue-200', description: 'Create a plan only' };
      case 'review':
        return { icon: Search, label: 'Review', color: 'text-purple-600 bg-purple-50 border-purple-200', description: 'Review and analyze code' };
    }
  };
  
  // Get user data from store instead of fetching on every modal open
  const { user, loading: userLoading } = useUserStore();

  // Set default repository when modal opens and user data is available
  useEffect(() => {
    if (isOpen && user?.default_repo) {
      setFormData(prev => ({
        ...prev,
        repositoryId: user.default_repo!.id
      }));
    }
  }, [isOpen, user]);

  // Auto-focus description input when modal opens
  useEffect(() => {
    if (isOpen && descriptionInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        descriptionInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Focus trap for accessibility and run mode cycling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      
      if (e.key === 'Tab') {
        // Handle Shift+Tab for mode cycling
        if (e.shiftKey) {
          e.preventDefault();
          cycleRunMode();
          return;
        }

        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'input, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, cycleRunMode]);


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

    // Reset form
    setFormData({
      description: '',
      repositoryId: null,
      mode: 'execute'
    });

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-lg max-w-2xl w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {userLoading ? (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
              <p className="text-gray-500 text-sm">Loading default repository...</p>
            </div>
          ) : user?.default_repo ? (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
              <p className="text-gray-700 text-sm">
                <strong>{user.default_repo.full_name}</strong> {user.default_repo.is_private ? '(Private)' : '(Public)'}
              </p>
            </div>
          ) : (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
              <p className="text-gray-500 text-sm">
                No default repository set. Please set a default repository in your settings.
              </p>
            </div>
          )}

          {/* Run Mode Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Mode:</span>
              <button
                type="button"
                onClick={cycleRunMode}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${getModeConfig(formData.mode).color}`}
                title={`${getModeConfig(formData.mode).description} (Shift+Tab to cycle)`}
              >
                {React.createElement(getModeConfig(formData.mode).icon, { size: 14 })}
                {getModeConfig(formData.mode).label}
              </button>
            </div>
            <div className="text-xs text-gray-500">Shift+Tab to cycle</div>
          </div>

          <div className="space-y-1">
            <textarea
              ref={descriptionInputRef}
              id="description"
              required
              value={formData.description}
              onChange={handleChange('description')}
              rows={3}
              className="w-full px-0 py-1 text-base placeholder:text-muted-foreground field focus:outline-none resize-none"
              placeholder="Describe the task..."
            />
          </div>


          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading || !user?.default_repo || !formData.description.trim()}
              className="px-4 py-2 text-sm text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};