import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ApiService } from '@/services/api';
import { getBackendJwt } from '@/lib/authToken';
import type { RepositoryTS } from '@/types/generated/RepositoryTS';

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
  
  const [defaultRepo, setDefaultRepo] = useState<RepositoryTS | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  // Load user profile with default repo when modal opens
  useEffect(() => {
    if (isOpen) {
      const jwt = getBackendJwt()
      if (jwt) {
        loadUserProfile();
      } else {
        console.log('Waiting for JWT before loading user profile...')
        // Try again in a moment
        setTimeout(() => {
          if (getBackendJwt()) {
            loadUserProfile();
          }
        }, 500)
      }
    }
  }, [isOpen]);

  const loadUserProfile = async () => {
    try {
      setUserLoading(true);

      const user = await ApiService.getUserProfile();
      if (user.default_repo) {
        const defaultRepo = user.default_repo;
        setDefaultRepo(defaultRepo);
        setFormData(prev => ({
          ...prev,
          repositoryId: defaultRepo.id
        }));
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setDefaultRepo(null);
    } finally {
      setUserLoading(false);
    }
  };

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
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="repository" className="block text-xs text-muted-foreground mb-1">
              GitHub Repository
            </label>
            {userLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-gray-500 text-sm">Loading default repository...</p>
              </div>
            ) : defaultRepo ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-gray-700 text-sm">
                  <strong>{defaultRepo.full_name}</strong> {defaultRepo.is_private ? '(Private)' : '(Public)'}
                </p>
              </div>
            ) : (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-gray-500 text-sm">
                  No default repository set. Please set a default repository in your settings.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="title" className="block text-xs text-muted-foreground mb-1">
              Task Title *
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange('title')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Add user authentication system"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-xs text-muted-foreground mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={handleChange('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what the AI agent should work on... (Markdown supported)"
            />
          </div>


          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !defaultRepo || !formData.title.trim()}
              className="flex-1 px-4 py-2 text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};