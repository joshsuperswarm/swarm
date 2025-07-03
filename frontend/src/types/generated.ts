// Generated TypeScript bindings from Rust using ts-rs
// This file is auto-generated. Do not edit manually.

export interface User {
  id: number;
  clerk_user_id: string;
  github_username?: string;
  github_user_id?: number;
  email?: string;
  default_repo_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GitHubToken {
  id: number;
  user_id: number;
  access_token: string;
  token_type: string;
  scope?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id: number;
  user_id: number;
  repository_id: number;
  title: string;
  description?: string;
  status: string;
  github_pr_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RepositoryWithTasks {
  id: number;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  is_private: boolean;
  task_count: number;
  created_at?: string;
}