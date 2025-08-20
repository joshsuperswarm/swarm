-- Fix UNIQUE constraint on messages table to include role
-- This prevents user and assistant messages from overwriting each other

-- First, drop the existing unique constraint that doesn't include role
ALTER TABLE messages DROP CONSTRAINT comments_task_id_run_id_mode_key;

-- Create a new unique constraint that includes the role field
-- This allows both user and assistant messages to coexist for the same run
ALTER TABLE messages 
ADD CONSTRAINT messages_task_id_run_id_mode_role_key 
UNIQUE (task_id, run_id, mode, role);