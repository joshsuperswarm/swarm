// API service for backend communication

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
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

  static async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }
}