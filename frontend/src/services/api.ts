// API service for backend communication
import { getBackendJwt } from "@/lib/authToken";
import type { RepositoryWithTasks } from "@/types/generated/RepositoryWithTasks";
import type { Task } from "@/types/generated/Task";
import type { UserWithDefaultRepo } from "@/types/generated/UserWithDefaultRepo";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

interface CreateTaskRequest {
  title: string;
  description?: string | undefined;
  repository_id: number;
}

interface TaskLog {
  id: number;
  task_id: number;
  log_line: string;
  created_at: string | null;
}

export class ApiService {
  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
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

  private static async authenticatedRequest<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = getBackendJwt();
    if (!token) throw new Error("Missing backend JWT");
    return this.request<T>(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  // Public endpoints
  static async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Authenticated endpoints
  static async getUserProfile(): Promise<UserWithDefaultRepo> {
    return this.authenticatedRequest<UserWithDefaultRepo>('/api/user/profile');
  }

  static async getUserRepositories(): Promise<{ repositories: RepositoryWithTasks[]; count: number; message?: string }> {
    return this.authenticatedRequest('/api/user/repos');
  }

  static async getTasks(): Promise<{ tasks: Task[]; count: number; user_id: number }> {
    return this.authenticatedRequest('/api/tasks');
  }

  static async createTask(task: CreateTaskRequest): Promise<{ success: boolean; task: Task }> {
    // Client-side validation
    if (!task.title.trim()) {
      throw new Error('Title cannot be empty');
    }
    
    // Sanitize data
    const sanitized = {
      ...task,
      title: task.title.trim(),
      description: task.description?.trim() || undefined,
    };
    
    return this.authenticatedRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(sanitized),
    });
  }

  static async setDefaultRepository(repositoryId: number | null): Promise<{ success: boolean }> {
    return this.authenticatedRequest('/api/user/default-repo', {
      method: 'POST',
      body: JSON.stringify({ repository_id: repositoryId }),
    });
  }

  static async setGithubToken(access_token: string): Promise<{ success: boolean }> {
    return this.authenticatedRequest("/api/auth/github-token", {
      method: "POST",
      body: JSON.stringify({ access_token }),
      headers: { "Content-Type": "application/json" },
    });
  }

  static async connectGitHub(): Promise<{ success: boolean; error?: string; message?: string }> {
    return this.authenticatedRequest("/api/auth/github/connect", {
      method: "POST",
    });
  }

  static async getTaskLogs(taskId: number, sinceId?: number): Promise<{ logs: TaskLog[]; task_id: number; count: number }> {
    const url = sinceId 
      ? `/api/tasks/${taskId}/logs?since=${sinceId}`
      : `/api/tasks/${taskId}/logs`;
    
    return this.authenticatedRequest(url);
  }
}