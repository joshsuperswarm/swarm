-- Rename Daytona-specific column names to generic sandbox names
ALTER TABLE tasks 
RENAME COLUMN daytona_sandbox_id TO sandbox_id;

ALTER TABLE tasks 
RENAME COLUMN daytona_session_id TO session_id;

ALTER TABLE tasks 
RENAME COLUMN daytona_command_id TO command_id;