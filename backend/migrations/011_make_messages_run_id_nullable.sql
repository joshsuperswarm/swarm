-- Make run_id nullable in messages table
-- This allows messages to be created before a run is assigned
ALTER TABLE messages 
ALTER COLUMN run_id DROP NOT NULL;