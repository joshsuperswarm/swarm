-- Add github_pushed_at column to repositories table
-- This allows storing the last push time from GitHub API
ALTER TABLE repositories
ADD COLUMN IF NOT EXISTS github_pushed_at timestamptz;