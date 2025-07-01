import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Session, SessionStatus } from '../types';
import { SessionCard } from './SessionCard';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
  title: string;
  status: SessionStatus;
  sessions: Session[];
  onDelete: (id: string) => void;
  onAddSession?: () => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  sessions,
  onDelete,
  onAddSession
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const getColumnColor = (status: SessionStatus) => {
    switch (status) {
      case 'todo': return 'border-gray-300 bg-gray-50';
      case 'in_progress': return 'border-blue-300 bg-blue-50';
      case 'done': return 'border-green-300 bg-green-50';
    }
  };

  const getHeaderColor = (status: SessionStatus) => {
    switch (status) {
      case 'todo': return 'text-gray-700';
      case 'in_progress': return 'text-blue-700';
      case 'done': return 'text-green-700';
    }
  };

  return (
    <div className={`flex-1 min-w-80 rounded-lg border-2 ${getColumnColor(status)} ${isOver ? 'border-blue-400' : ''}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h2 className={`font-semibold ${getHeaderColor(status)}`}>
              {title}
            </h2>
            <span className="ml-2 px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-600">
              {sessions.length}
            </span>
          </div>
          {status === 'todo' && onAddSession && (
            <button
              onClick={onAddSession}
              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
              title="Add new session"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="p-4 min-h-96 space-y-3"
      >
        <SortableContext items={sessions.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
        
        {sessions.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            {status === 'todo' ? 'No sessions yet. Create your first session!' : 
             status === 'in_progress' ? 'No sessions in progress' : 
             'No completed sessions'}
          </div>
        )}
      </div>
    </div>
  );
};