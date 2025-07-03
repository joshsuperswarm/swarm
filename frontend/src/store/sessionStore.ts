import { create } from 'zustand';
import type { Session, CreateSessionData, Message, Task } from '../types';

interface SessionStore {
  currentSession: Session | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentSession: (session: Session | null) => void;
  createSession: (sessionData: CreateSessionData) => void;
  addMessage: (message: Message) => void;
  sendMessage: (content: string) => void;
  
  // Task management actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Mock session for development (simplified) - only in dev mode
const mockSession: Session | null = process.env.NODE_ENV === 'production' ? null : {
  id: '1',
  title: 'Frontend Redesign Project',
  agentType: 'claude_code',
  status: 'idle',
  messages: [],
  tasks: [],
  claudeSessionId: 'claude_session_123',
  createdAt: new Date(Date.now() - 10800000).toISOString(),
  updatedAt: new Date().toISOString(),
  userId: 'user_123'
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentSession: mockSession,
  isLoading: false,
  error: null,

  setCurrentSession: (session) => set({ currentSession: session }),

  createSession: (sessionData) => {
    const newSession: Session = {
      ...sessionData,
      id: Math.random().toString(36).substring(7),
      status: 'idle',
      messages: [],
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'user_123' // This would come from Clerk in real implementation
    };
    set({ currentSession: newSession });
  },

  addMessage: (message) => {
    set((state) => {
      if (!state.currentSession) return state;
      
      return {
        currentSession: {
          ...state.currentSession,
          messages: [...state.currentSession.messages, message],
          updatedAt: new Date().toISOString()
        }
      };
    });
  },

  sendMessage: async (content) => {
    const { currentSession, addMessage, setLoading, setError } = get();
    if (!currentSession) return;

    // Add user message immediately
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    addMessage(userMessage);

    try {
      setLoading(true);
      setError(null);
      
      // TODO: Replace with actual API call to backend
      // For now, simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: `I received your message: "${content}". This is a mock response. Backend integration coming soon!`,
          timestamp: new Date().toISOString(),
          type: 'text'
        };
        addMessage(assistantMessage);
        setLoading(false);
      }, 1500);
      
    } catch {
      setError('Failed to send message');
      setLoading(false);
    }
  },

  // Task management actions
  addTask: (taskData) => {
    set((state) => {
      if (!state.currentSession) return state;
      
      const newTask: Task = {
        ...taskData,
        id: `task_${Date.now()}`
      };
      
      return {
        currentSession: {
          ...state.currentSession,
          tasks: [...(state.currentSession.tasks || []), newTask],
          updatedAt: new Date().toISOString()
        }
      };
    });
  },

  updateTaskStatus: (taskId, status) => {
    set((state) => {
      if (!state.currentSession) return state;
      
      const updatedTasks = (state.currentSession.tasks || []).map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status, 
              updatedAt: new Date().toISOString(),
              completedAt: status === 'done' ? new Date().toISOString() : undefined
            }
          : task
      );
      
      return {
        currentSession: {
          ...state.currentSession,
          tasks: updatedTasks,
          updatedAt: new Date().toISOString()
        }
      };
    });
  },

  updateTask: (taskId, updates) => {
    set((state) => {
      if (!state.currentSession) return state;
      
      const updatedTasks = (state.currentSession.tasks || []).map(task => 
        task.id === taskId 
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      );
      
      return {
        currentSession: {
          ...state.currentSession,
          tasks: updatedTasks,
          updatedAt: new Date().toISOString()
        }
      };
    });
  },

  deleteTask: (taskId) => {
    set((state) => {
      if (!state.currentSession) return state;
      
      const updatedTasks = (state.currentSession.tasks || []).filter(task => task.id !== taskId);
      
      return {
        currentSession: {
          ...state.currentSession,
          tasks: updatedTasks,
          updatedAt: new Date().toISOString()
        }
      };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}));