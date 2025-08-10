import type { OnboardingStatus, ApiKeysStatus, UpdateApiKeysRequest, SetDefaultRepoRequest } from '@/types/onboarding';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(endpoint: string, { token, ...init }: RequestInit & { token?: string }): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export const OnboardingService = {
  async getOnboardingStatus(token: string): Promise<OnboardingStatus> {
    return request<OnboardingStatus>('/api/user/onboarding-status', {
      method: 'GET',
      token,
    });
  },

  async updateApiKeys(token: string, keys: UpdateApiKeysRequest): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/user/api-keys', {
      method: 'POST',
      token,
      body: JSON.stringify(keys),
    });
  },

  async getApiKeysStatus(token: string): Promise<ApiKeysStatus> {
    return request<ApiKeysStatus>('/api/user/api-keys/status', {
      method: 'GET',
      token,
    });
  },

  async setDefaultRepo(token: string, payload: SetDefaultRepoRequest): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/user/default-repo', {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    });
  },
};