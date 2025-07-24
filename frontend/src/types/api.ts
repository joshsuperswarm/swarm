// API types for frontend-backend communication
export interface ApiMessage {
  id: number;
  task_id: number;
  role: 'user' | 'assistant';
  content: string;           // markdown
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ApiRun {
  id: number;
  task_id: number;
  message_id: number;
  status: string;            // 'pending' | 'running' | …
  mode: 'execute' | 'plan' | 'review';
  created_at: string;
}

export interface SendMessagePayload {
  content: string;
  mode?: 'execute' | 'plan' | 'review';
}

export interface SendMessageResponse {
  message: ApiMessage;
  run: ApiRun;
}