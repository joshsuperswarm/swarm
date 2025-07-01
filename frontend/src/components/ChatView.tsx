import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export const ChatView: React.FC = () => {
  const { currentSession, isLoading, error } = useSessionStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            No Active Session
          </h2>
          <p className="text-gray-600 mb-6">
            Create a new Claude Code session to get started
          </p>
          <button
            onClick={() => {/* TODO: Implement session creation */}}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader session={currentSession} />
      <MessageList 
        messages={currentSession.messages} 
        isLoading={isLoading}
      />
      <MessageInput 
        onSendMessage={(content) => useSessionStore.getState().sendMessage(content)}
        disabled={currentSession.status === 'error'}
      />
    </div>
  );
};