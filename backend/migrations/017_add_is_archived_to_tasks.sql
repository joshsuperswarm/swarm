-- Add is_archived boolean field to tasks table
ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient filtering
CREATE INDEX idx_tasks_is_archived ON tasks(is_archived) WHERE is_archived = FALSE;