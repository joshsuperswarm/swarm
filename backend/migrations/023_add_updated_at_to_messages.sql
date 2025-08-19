-- Add updated_at column to messages table to track when messages are updated
-- without changing created_at

ALTER TABLE messages 
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set initial values for existing records
UPDATE messages SET updated_at = created_at;