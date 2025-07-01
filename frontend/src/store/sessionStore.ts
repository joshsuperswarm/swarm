import { create } from 'zustand';
import type { Session, CreateSessionData, SessionStatus } from '../types';

interface SessionStore {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (sessionData: CreateSessionData) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  deleteSession: (id: string) => void;
  moveSession: (id: string, newStatus: SessionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Mock data for development
const mockSessions: Session[] = [
  {
    id: '1',
    title: 'Add user authentication',
    description: 'Implement JWT-based authentication system',
    status: 'todo',
    agentType: 'claude_code',
    repoUrl: 'https://github.com/user/my-app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user_123'
  },
  {
    id: '2',
    title: 'Fix database migrations',
    description: 'Resolve issues with Postgres schema migrations',
    status: 'in_progress',
    agentType: 'codex',
    repoUrl: 'https://github.com/user/backend',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user_123'
  },
  {
    id: '3',
    title: 'Optimize React components',
    description: 'Improve performance of dashboard components',
    status: 'done',
    agentType: 'gemini_cli',
    repoUrl: 'https://github.com/user/frontend',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    userId: 'user_123'
  }
];

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: mockSessions,
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  addSession: (sessionData) => {
    const newSession: Session = {
      ...sessionData,
      id: Math.random().toString(36).substring(7),
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user_123' // This would come from Clerk in real implementation
    };
    set((state) => ({ sessions: [...state.sessions, newSession] }));
  },

  updateSession: (id, updates) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id
          ? { ...session, ...updates, updatedAt: new Date().toISOString() }
          : session
      )
    }));
  },

  deleteSession: (id) => {
    set((state) => ({
      sessions: state.sessions.filter((session) => session.id !== id)
    }));
  },

  moveSession: (id, newStatus) => {
    get().updateSession(id, { status: newStatus });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}));