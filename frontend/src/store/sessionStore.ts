import { create } from 'zustand';
import type { Session, CreateSessionData, Message } from '../types';

interface SessionStore {
  currentSession: Session | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCurrentSession: (session: Session | null) => void;
  createSession: (sessionData: CreateSessionData) => void;
  addMessage: (message: Message) => void;
  sendMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Mock session for development
const mockSession: Session = {
  id: '1',
  title: 'Add user authentication',
  agentType: 'claude_code',
  status: 'idle',
  messages: [
    {
      id: 'msg_1',
      role: 'user',
      content: 'Help me implement JWT-based authentication for my React app',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      type: 'text'
    },
    {
      id: 'msg_2',
      role: 'assistant',
      content: 'I\'ll help you implement JWT authentication. Let me start by examining your current project structure and then set up the necessary components.',
      timestamp: new Date(Date.now() - 3500000).toISOString(),
      type: 'text'
    },
    {
      id: 'msg_3',
      role: 'assistant',
      content: 'First, let me check your package.json to see what dependencies you already have...',
      timestamp: new Date(Date.now() - 3400000).toISOString(),
      type: 'tool_use'
    }
  ],
  claudeSessionId: 'claude_session_123',
  createdAt: new Date(Date.now() - 3600000).toISOString(),
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
      
    } catch (error) {
      setError('Failed to send message');
      setLoading(false);
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}));