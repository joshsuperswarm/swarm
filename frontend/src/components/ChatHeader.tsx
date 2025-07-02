import React from 'react';
import type { Session } from '../types';
import { Bot, Clock } from 'lucide-react';

interface ChatHeaderProps {
  session: Session;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ session }) => {

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6 text-gray-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              {session.title}
            </h1>
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