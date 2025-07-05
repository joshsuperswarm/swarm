-- Add Daytona session and command ID columns to tasks table
ALTER TABLE tasks
ADD COLUMN daytona_session_id TEXT,
ADD COLUMN daytona_command_id TEXT;

-- Create indexes for efficient querying
CREATE INDEX idx_tasks_daytona_session_id ON tasks(daytona_session_id);
CREATE INDEX idx_tasks_daytona_command_id ON tasks(daytona_command_id);