-- Rename comments table to messages
ALTER TABLE comments RENAME TO messages;

-- Rename index to match new table name
ALTER INDEX idx_comments_task_id RENAME TO idx_messages_task_id;

-- Add role column with enum constraint
ALTER TABLE messages 
ADD COLUMN role TEXT NOT NULL DEFAULT 'assistant' 
CHECK (role IN ('user', 'assistant', 'system'));