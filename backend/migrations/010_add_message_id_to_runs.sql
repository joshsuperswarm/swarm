-- Add message_id column to runs table to link runs to messages
ALTER TABLE runs
  ADD COLUMN message_id BIGINT REFERENCES messages(id);