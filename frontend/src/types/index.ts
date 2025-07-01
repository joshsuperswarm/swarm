export type AgentType = 'claude_code' | 'codex' | 'gemini_cli' | 'custom';
export type SessionStatus = 'todo' | 'in_progress' | 'done';

export interface Session {
  id: string;
  title: string;
  description: string;
  status: SessionStatus;
  agentType: AgentType;
  repoUrl?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateSessionData {
  title: string;
  description: string;
  agentType: AgentType;
  repoUrl?: string;
}