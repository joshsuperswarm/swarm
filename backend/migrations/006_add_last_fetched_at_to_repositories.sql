-- Add last_fetched_at column to repositories table for GitHub API caching
ALTER TABLE repositories ADD COLUMN last_fetched_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient cache validation queries
CREATE INDEX idx_repositories_last_fetched_at ON repositories(last_fetched_at);