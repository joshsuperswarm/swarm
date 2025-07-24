-- Add metadata column to messages table for storing UI data (logs, todos, plan-review flags)
ALTER TABLE messages
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Fast retrieval in order
CREATE INDEX IF NOT EXISTS idx_messages_task_time
  ON messages(task_id, created_at);