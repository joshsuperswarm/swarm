// API service for backend communication

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

interface UserProfile {
  id: number;
  clerk_user_id: string;
  github_username?: string;
  email?: string;
  default_repo_id?: number;
  created_at: string;
}

interface Repository {
  id: number;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  is_private: boolean;
  task_count: number;
  created_at?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  repository_id: number;
  user_id: number;
  created_at: string;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  repository_id: number;
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
    token: string, 
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
  }

  // Public endpoints
  static async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Authenticated endpoints
  static async getUserProfile(token: string): Promise<UserProfile> {
    return this.authenticatedRequest<UserProfile>('/api/user/profile', token);
  }

  static async getUserRepositories(token: string): Promise<{ repositories: Repository[]; count: number; message?: string }> {
    return this.authenticatedRequest('/api/user/repos', token);
  }

  static async getTasks(token: string): Promise<{ tasks: Task[]; count: number; user_id: number }> {
    return this.authenticatedRequest('/api/tasks', token);
  }

  static async createTask(token: string, task: CreateTaskRequest): Promise<{ success: boolean; task: Task }> {
    return this.authenticatedRequest('/api/tasks', token, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  static async setDefaultRepository(token: string, repositoryId: number | null): Promise<{ success: boolean }> {
    return this.authenticatedRequest('/api/user/default-repo', token, {
      method: 'POST',
      body: JSON.stringify({ repository_id: repositoryId }),
    });
  }
}