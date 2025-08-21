import { z } from "zod";
import type { TaskWithRun } from "./generated/TaskWithRun";

// TaskWithRun schema matching the backend TaskWithRun structure
export const taskWithRunSchema = z.object({
  run_id: z.number(),
  task_id: z.number(),
  title: z.string(),
  description: z.string().optional().nullable(),
  repository_id: z.number(),
  user_id: z.number(),
  status: z.string().optional().nullable(),
  github_branch: z.string().optional().nullable(),
  sandbox_id: z.string().optional().nullable(),
  sandbox_hostname: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  command_id: z.string().optional().nullable(),
  commit_title: z.string().optional().nullable(),
  commit_body: z.string().optional().nullable(),
  pr_title: z.string().optional().nullable(),
  pr_body: z.string().optional().nullable(),
  pr_merged_at: z.string().optional().nullable(),
  pr_closed_at: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
  github_pr_url: z.string().optional().nullable(),
});

export type Task = TaskWithRun;
export { type TaskWithRun };