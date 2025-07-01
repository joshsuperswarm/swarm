import React, { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { User, Bot, Terminal, AlertCircle } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading = false }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getMessageIcon = (role: Message['role'], type?: Message['type']) => {
    if (role === 'user') return <User className="w-5 h-5" />;
    if (type === 'error') return <AlertCircle className="w-5 h-5" />;
    if (type === 'tool_use') return <Terminal className="w-5 h-5" />;
    return <Bot className="w-5 h-5" />;
  };

  const getMessageBubbleClass = (role: Message['role'], type?: Message['type']) => {
    if (role === 'user') {
      return 'bg-blue-600 text-white ml-12';
    }
    if (type === 'error') {
      return 'bg-red-50 text-red-900 border border-red-200 mr-12';
    }
    if (type === 'code') {
      return 'bg-gray-900 text-gray-100 font-mono text-sm mr-12';
    }
    return 'bg-white text-gray-900 border border-gray-200 mr-12';
  };

  const getAvatarClass = (role: Message['role'], type?: Message['type']) => {
    if (role === 'user') {
      return 'bg-blue-600 text-white';
    }
    if (type === 'error') {
      return 'bg-red-100 text-red-600';
    }
    return 'bg-gray-100 text-gray-600';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <div className="text-center">
          <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Start a conversation with Claude Code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
      {messages.map((message) => (
        <div key={message.id} className={`flex items-start space-x-3 ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getAvatarClass(message.role, message.type)}`}>
            {getMessageIcon(message.role, message.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={`rounded-lg p-4 ${getMessageBubbleClass(message.role, message.type)}`}>
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
            <div className={`mt-1 text-xs text-gray-500 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              {formatTime(message.timestamp)}
            </div>
          </div>
        </div>
      ))}
      
      {isLoading && (
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-gray-500 text-sm">Claude is thinking...</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};