export interface TaskWithRun {
  task_id: number
  title: string
  status: string
  mode: string | null
  created_at: string | null
  github_pr_url: string | null
  latest_run: {
    id: number
    status: string
    created_at: string
  } | null
}