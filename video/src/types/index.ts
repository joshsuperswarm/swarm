import { Circle, Clock, CheckCircle, GitPullRequest, AlertCircle, XCircle } from 'lucide-react';

// Status configuration with icons and labels
export const STATUSES = [
  { value: "pending", label: "Pending", icon: Circle },
  { value: "spinning", label: "Spinning", icon: Clock },
  { value: "running", label: "Running", icon: Clock },
  { value: "in_progress", label: "In Progress", icon: Clock },
  { value: "completed", label: "Completed", icon: CheckCircle },
  { value: "done", label: "Done", icon: CheckCircle },
  { value: "pr_opened", label: "PR Opened", icon: GitPullRequest },
  { value: "failed", label: "Failed", icon: XCircle },
  { value: "review", label: "Review", icon: AlertCircle },
] as const;

// Derive types from the constants
export type Status = typeof STATUSES[number]["value"];

// Priority levels
export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export type Priority = typeof PRIORITIES[number]["value"];

// Phase/Mode types
export const PHASES = [
  { value: "CREATE", label: "Create" },
  { value: "PLAN", label: "Plan" },
  { value: "EXECUTE", label: "Execute" },
  { value: "REVIEW", label: "Review" },
] as const;

export type Phase = typeof PHASES[number]["value"];

// Core interfaces
export interface Task {
  id: number;
  task_id: number;
  title: string;
  description?: string;
  status: Status;
  mode: string | null;
  created_at: string | null;
  github_pr_url: string | null;
  latest_run?: {
    id: number;
    status: Status;
    created_at: string;
  } | null;
}

export interface Todo {
  id: string;
  todo_id?: number;
  content: string;
  status: Status;
  priority: Priority;
  updated_at?: string;
}

export interface TaskDetails {
  task: Task;
  messages: Array<{
    run: {
      run: {
        status: Status;
      };
    };
  }>;
}

// Legacy compatibility types (maintain backward compatibility)
export interface TaskWithRun extends Task {}
export interface AgentTodo extends Todo {}