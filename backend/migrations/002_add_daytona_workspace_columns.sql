-- Add Daytona workspace columns to tasks table
ALTER TABLE tasks ADD COLUMN daytona_workspace_id TEXT;
ALTER TABLE tasks ADD COLUMN workspace_hostname TEXT;

-- Create indexes for the new columns
CREATE INDEX idx_tasks_daytona_workspace_id ON tasks(daytona_workspace_id);
CREATE INDEX idx_tasks_workspace_hostname ON tasks(workspace_hostname);