-- Add pr_closed_at column to tasks table for tracking PR closed state
-- This allows tracking PRs that are closed but not merged

ALTER TABLE tasks ADD COLUMN pr_closed_at TIMESTAMPTZ NULL;

-- Create index for efficient querying of closed PR status
CREATE INDEX idx_tasks_pr_closed_at ON tasks(pr_closed_at);

-- Update the existing PR polling index to include pr_closed_at
DROP INDEX IF EXISTS idx_tasks_pr_polling;
CREATE INDEX idx_tasks_pr_polling ON tasks(github_pr_url, pr_merged_at, pr_closed_at, is_archived) 
WHERE github_pr_url IS NOT NULL;