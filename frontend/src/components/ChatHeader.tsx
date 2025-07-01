import React from 'react';
import type { Session } from '../types';
import { Bot, Clock } from 'lucide-react';

interface ChatHeaderProps {
  session: Session;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ session }) => {
  const getAgentColor = (agentType: Session['agentType']) => {
    switch (agentType) {
      case 'claude_code': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'codex': return 'bg-green-100 text-green-800 border-green-200';
      case 'gemini_cli': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'idle': return 'bg-gray-100 text-gray-700';
      case 'running': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              {session.title}
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getAgentColor(session.agentType)}`}>
              {session.agentType.replace('_', ' ')}
            </span>
            
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)}`}>
              {session.status}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{formatDate(session.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};