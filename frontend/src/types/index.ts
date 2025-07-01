export type AgentType = 'claude_code' | 'codex' | 'gemini_cli' | 'custom';
export type SessionStatus = 'idle' | 'running' | 'completed' | 'error';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'code' | 'error' | 'tool_use';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  type?: MessageType;
}

export interface Session {
  id: string;
  title: string;
  agentType: AgentType;
  status: SessionStatus;
  messages: Message[];
  claudeSessionId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateSessionData {
  title: string;
  agentType: AgentType;
}