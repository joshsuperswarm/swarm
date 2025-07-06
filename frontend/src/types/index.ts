import { z } from "zod";

export type AgentType = 'claude_code' | 'codex' | 'gemini_cli' | 'custom';
export type SessionStatus = 'idle' | 'running' | 'completed' | 'error';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'code' | 'error' | 'tool_use';

// Task schema matching the backend structure
export const taskSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  repository_id: z.number(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  github_pr_url: z.string().optional().nullable(),
  daytona_workspace_id: z.string().optional().nullable(),
  workspace_hostname: z.string().optional().nullable(),
  ssh_hostname: z.string().optional().nullable(),
  daytona_session_id: z.string().optional().nullable(),
  daytona_command_id: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export type Task = z.infer<typeof taskSchema>;

// Legacy task interface for backward compatibility
export interface LegacyTask {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  type: 'feature' | 'bug' | 'improvement' | 'task';
  assignee?: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimatedHours?: number;
  completedAt?: string;
}

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
  tasks: Task[];
  claudeSessionId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateSessionData {
  title: string;
  agentType: AgentType;
}