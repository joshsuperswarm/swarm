-- Add Daytona sandbox columns to tasks table
ALTER TABLE tasks ADD COLUMN daytona_sandbox_id TEXT;
ALTER TABLE tasks ADD COLUMN sandbox_hostname TEXT;

-- Create indexes for the new columns
CREATE INDEX idx_tasks_daytona_sandbox_id ON tasks(daytona_sandbox_id);
CREATE INDEX idx_tasks_sandbox_hostname ON tasks(sandbox_hostname);