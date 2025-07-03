import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ApiService } from '@/services/api';
import { getBackendJwt } from '@/lib/authToken';
import type { RepositoryWithTasks } from '@/types/generated';

interface CreateTaskData {
  title: string;
  description: string;
  repositoryId: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
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
    repositoryId: null,
    priority: 'medium'
  });
  
  const [repositories, setRepositories] = useState<RepositoryWithTasks[]>([]);
  const [loading, setLoading] = useState(false);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);

  // Load repositories when modal opens and JWT is available
  useEffect(() => {
    if (isOpen) {
      const jwt = getBackendJwt()
      if (jwt) {
        loadRepositories();
      } else {
        console.log('Waiting for JWT before loading repositories...')
        // Try again in a moment
        setTimeout(() => {
          if (getBackendJwt()) {
            loadRepositories();
          }
        }, 500)
      }
    }
  }, [isOpen]);

  const loadRepositories = async () => {
    try {
      setRepositoriesLoading(true);

      const response = await ApiService.getUserRepositories();
      setRepositories(response.repositories);
    } catch (err) {
      console.error('Failed to load repositories:', err);
      
      // Show empty list when API fails - user will see "Connect GitHub" message
      setRepositories([]);
    } finally {
      setRepositoriesLoading(false);
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
      repositoryId: null,
      priority: 'medium'
    });

    setLoading(false);
  };

  const handleChange = (field: keyof CreateTaskData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = field === 'repositoryId' ? parseInt(e.target.value) : e.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
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
            <label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-1">
              GitHub Repository *
            </label>
            {repositories.length === 0 && !repositoriesLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <p className="text-gray-500 text-sm">
                  No repositories available. Please connect your GitHub account and ensure you have repository access.
                </p>
              </div>
            ) : (
              <select
                id="repository"
                required
                value={formData.repositoryId || ''}
                onChange={handleChange('repositoryId')}
                disabled={repositoriesLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">
                  {repositoriesLoading ? 'Loading repositories...' : 'Select a repository...'}
                </option>
                {repositories.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.full_name} {repo.is_private ? '(Private)' : '(Public)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
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
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={handleChange('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what the AI agent should work on..."
            />
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={handleChange('priority')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
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
              disabled={loading}
              className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};