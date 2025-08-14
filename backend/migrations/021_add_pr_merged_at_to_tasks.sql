-- Add pr_merged_at column to tasks table for tracking PR merged state
-- This replaces the need to use status='pr_merged'

ALTER TABLE tasks ADD COLUMN pr_merged_at TIMESTAMPTZ NULL;

-- Create index for efficient querying of merged PR status
CREATE INDEX idx_tasks_pr_merged_at ON tasks(pr_merged_at);

-- Create index for PR polling queries
CREATE INDEX idx_tasks_pr_polling ON tasks(github_pr_url, pr_merged_at, is_archived) 
WHERE github_pr_url IS NOT NULL;