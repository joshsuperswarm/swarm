import React, { useState } from 'react';
import type { CreateSessionData, Session } from '../types';
import { useSessionStore } from '../store/sessionStore';
import { X } from 'lucide-react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({ isOpen, onClose }) => {
  const { addSession } = useSessionStore();
  const [formData, setFormData] = useState<CreateSessionData>({
    title: '',
    description: '',
    agentType: 'claude_code',
    repoUrl: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;

    addSession({
      ...formData,
      repoUrl: formData.repoUrl || undefined
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      agentType: 'claude_code',
      repoUrl: ''
    });

    onClose();
  };

  const handleChange = (field: keyof CreateSessionData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
          <h2 className="text-lg font-semibold text-gray-900">Create New Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Session Title *
            </label>
            <input
              id="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange('title')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Add user authentication"
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
            <label htmlFor="agentType" className="block text-sm font-medium text-gray-700 mb-1">
              AI Agent Type
            </label>
            <select
              id="agentType"
              value={formData.agentType}
              onChange={handleChange('agentType')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="claude_code">Claude Code</option>
              <option value="codex">Codex</option>
              <option value="gemini_cli">Gemini CLI</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Repository URL (Optional)
            </label>
            <input
              id="repoUrl"
              type="url"
              value={formData.repoUrl}
              onChange={handleChange('repoUrl')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://github.com/username/repo"
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
              className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Create Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};