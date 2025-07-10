import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUserStore } from '@/store/userStore';

interface CreateTaskData {
  title: string;
  description: string;
  repositoryId: number | null;
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
  const [formData, setFormData] = useState<CreateTaskData>({
    title: '',
    description: '',
    repositoryId: null
  });
  
  const [loading, setLoading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
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

  // Auto-focus title input when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Focus trap for accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      
      if (e.key === 'Tab') {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
          'input, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.repositoryId) return;

    setLoading(true);
    onCreateTask(formData);

    // Reset form
    setFormData({
      title: '',
      description: '',
      repositoryId: null
    });

    setLoading(false);
  };

  const handleChange = (field: keyof CreateTaskData) => (
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

          <div className="space-y-1">
            <input
              ref={titleInputRef}
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange('title')}
              className="w-full px-0 py-1 text-base placeholder:text-muted-foreground field focus:outline-none border-b border-gray-200 focus:border-gray-400"
              placeholder="Issue title"
            />
            <textarea
              id="description"
              value={formData.description}
              onChange={handleChange('description')}
              rows={2}
              className="w-full px-0 py-1 text-base placeholder:text-muted-foreground field focus:outline-none border-b border-gray-200 focus:border-gray-400 resize-none"
              placeholder="Add description..."
            />
          </div>


          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading || !user?.default_repo || !formData.title.trim()}
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