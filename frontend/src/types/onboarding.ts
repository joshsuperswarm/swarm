export interface OnboardingStatus {
  onboarding_completed: boolean;
  step: string | null; // 'api-keys' | 'default-repo' | null
  has_anthropic: boolean;
  has_openai: boolean;
  has_default_repo: boolean;
}

export interface ApiKeysStatus {
  has_anthropic: boolean;
  has_openai: boolean;
}

export interface UpdateApiKeysRequest {
  anthropic_api_key?: string;
  openai_api_key?: string;
}

export interface SetDefaultRepoRequest {
  repository_id: number;
}