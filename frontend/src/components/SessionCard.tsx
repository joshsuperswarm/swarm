import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Session } from '../types';
import { Calendar, ExternalLink, Trash2 } from 'lucide-react';

interface SessionCardProps {
  session: Session;
  onDelete: (id: string) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getAgentColor = (agentType: Session['agentType']) => {
    switch (agentType) {
      case 'claude_code': return 'bg-blue-100 text-blue-800';
      case 'codex': return 'bg-green-100 text-green-800';
      case 'gemini_cli': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
          {session.title}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session.id);
          }}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <p className="text-gray-600 text-xs mb-3 line-clamp-2">
        {session.description}
      </p>

      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgentColor(session.agentType)}`}>
          {session.agentType.replace('_', ' ')}
        </span>
        
        {session.repoUrl && (
          <a
            href={session.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-blue-500 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <div className="flex items-center mt-3 text-xs text-gray-500">
        <Calendar size={12} className="mr-1" />
        {formatDate(session.createdAt)}
      </div>
    </div>
  );
};