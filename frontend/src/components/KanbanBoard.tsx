import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import type { Session, SessionStatus } from '../types';
import { useSessionStore } from '../store/sessionStore';
import { KanbanColumn } from './KanbanColumn';
import { SessionCard } from './SessionCard';

interface KanbanBoardProps {
  onCreateSession: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onCreateSession }) => {
  const { sessions, moveSession, deleteSession } = useSessionStore();
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const session = sessions.find(s => s.id === active.id);
    setActiveSession(session || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const sessionId = active.id as string;
    const newStatus = over.id as SessionStatus;
    
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.status !== newStatus) {
      moveSession(sessionId, newStatus);
    }

    setActiveSession(null);
  };

  const handleDragOver = () => {
    // Handle any additional drag over logic if needed
  };

  const getSessionsByStatus = (status: SessionStatus) => {
    return sessions.filter(session => session.status === status);
  };

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="flex gap-6 h-full overflow-x-auto pb-4">
          <KanbanColumn
            title="To Do"
            status="todo"
            sessions={getSessionsByStatus('todo')}
            onDelete={deleteSession}
            onAddSession={onCreateSession}
          />
          
          <KanbanColumn
            title="In Progress"
            status="in_progress"
            sessions={getSessionsByStatus('in_progress')}
            onDelete={deleteSession}
          />
          
          <KanbanColumn
            title="Done"
            status="done"
            sessions={getSessionsByStatus('done')}
            onDelete={deleteSession}
          />
        </div>

        <DragOverlay>
          {activeSession ? (
            <div className="rotate-2">
              <SessionCard
                session={activeSession}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};