-- Add github_branch column to tasks table for tracking git branches
ALTER TABLE tasks ADD COLUMN github_branch VARCHAR(255);

-- Create index for efficient branch lookups
CREATE INDEX idx_tasks_github_branch ON tasks(github_branch);