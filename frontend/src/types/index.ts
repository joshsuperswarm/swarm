import { z } from "zod";

// Task schema matching the backend structure
export const taskSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  repository_id: z.number(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  github_pr_url: z.string().optional().nullable(),
  sandbox_id: z.string().optional().nullable(),
  sandbox_hostname: z.string().optional().nullable(),
  ssh_hostname: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  command_id: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export type Task = z.infer<typeof taskSchema>;