// API service for backend communication
import type { AgentTodo } from "@/types/generated/AgentTodo";
import type { RepositoryWithTasks } from "@/types/generated/RepositoryWithTasks";
import type { TaskWithRun } from "@/types/generated/TaskWithRun";
import type { UserWithDefaultRepo } from "@/types/generated/UserWithDefaultRepo";
import type { Run } from "@/types/generated/Run";
import type { Task } from "@/types/generated/Task";
import type { MessageWithRun } from "@/types/generated/MessageWithRun";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export type RunMode = 'execute' | 'plan' | 'review';

export interface Message {
  id: number;
  task_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  run?: Run;
}

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

interface CreateTaskRequest {
  description: string;
  repository_id: number;
  mode: RunMode;
}

interface TaskLog {
  id: number;
  task_id: number;
  log_line: string;
  created_at: string | null;
}

async function request<T>(endpoint: string, { token, ...init }: RequestInit & { token?: string }): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

export class ApiService {

  // Public endpoints
  static async healthCheck(): Promise<HealthResponse> {
    return request<HealthResponse>('/health', {});
  }

  // Authenticated endpoints
  static async getUserProfile(token: string): Promise<UserWithDefaultRepo> {
    return request<UserWithDefaultRepo>('/api/user/profile', { token });
  }

  static async getUserRepositories(token: string): Promise<{ repositories: RepositoryWithTasks[]; count: number; message?: string }> {
    return request('/api/user/repos', { token });
  }

  static async getTasks(token: string, options?: { include?: string }): Promise<{ tasks: TaskWithRun[]; count: number; user_id: number }> {
    const queryParams = options?.include ? `?include=${options.include}` : '';
    return request(`/api/tasks${queryParams}`, { token });
  }

  static async createTask(token: string, task: CreateTaskRequest): Promise<{ success: boolean; task: TaskWithRun }> {
    // Client-side validation
    if (!task.description.trim()) {
      throw new Error('Description cannot be empty');
    }
    
    if (!['execute', 'plan', 'review'].includes(task.mode)) {
      throw new Error('Invalid run mode');
    }
    
    // Sanitize data
    const sanitized = {
      ...task,
      description: task.description.trim(),
    };
    
    return request('/api/tasks', {
      token,
      method: 'POST',
      body: JSON.stringify(sanitized),
    });
  }

  static async setDefaultRepository(token: string, repositoryId: number | null): Promise<{ success: boolean }> {
    return request('/api/user/default-repo', {
      token,
      method: 'POST',
      body: JSON.stringify({ repository_id: repositoryId }),
    });
  }

  static async setGithubToken(token: string, access_token: string): Promise<{ success: boolean }> {
    return request("/api/auth/github-token", {
      token,
      method: "POST",
      body: JSON.stringify({ access_token }),
    });
  }

  static async connectGitHub(token: string): Promise<{ success: boolean; error?: string; message?: string }> {
    return request("/api/auth/github/connect", {
      token,
      method: "POST",
    });
  }

  static async getTaskLogs(token: string, taskId: number, sinceId?: number): Promise<{ logs: TaskLog[]; task_id: number; count: number }> {
    const url = sinceId 
      ? `/api/tasks/${taskId}/logs?since=${sinceId}`
      : `/api/tasks/${taskId}/logs`;
    
    return request(url, { token });
  }

  static async getTaskTodos(token: string, taskId: number): Promise<AgentTodo[]> {
    const response = await request<{ task_id: number; todos: AgentTodo[]; count: number }>(`/api/tasks/${taskId}/todos`, { token });
    return response.todos;
  }

  static async getTaskMessages(token: string, taskId: number): Promise<Message[]> {
    return request(`/api/tasks/${taskId}/messages`, { token });
  }

  static async getTaskDetails(token: string, taskId: number): Promise<{ task: Task; messages: MessageWithRun[] }> {
    return request(`/api/tasks/${taskId}/details`, { token });
  }

  static async postTaskMessage(
    token: string,
    taskId: number,
    body: { content: string; mode?: RunMode }
  ): Promise<{ message: Message; run: Run }> {
    return request(`/api/tasks/${taskId}/messages`, {
      token,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async archiveTask(token: string, taskId: number): Promise<{ success: boolean; task_id: number; message: string }> {
    return request(`/api/tasks/${taskId}/archive`, {
      token,
      method: 'PUT',
    });
  }
}