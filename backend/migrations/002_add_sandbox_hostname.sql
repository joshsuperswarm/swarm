-- Add missing sandbox_hostname column to tasks table
ALTER TABLE tasks ADD COLUMN sandbox_hostname TEXT;

-- Create index for the new column
CREATE INDEX idx_tasks_sandbox_hostname ON tasks(sandbox_hostname);