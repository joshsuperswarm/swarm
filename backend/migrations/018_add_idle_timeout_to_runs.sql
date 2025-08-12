-- Add idle_timeout_at field to runs table for session persistence
-- Task 112: Comprehensive Plan: Persistent Sessions with Branch Reuse

ALTER TABLE runs ADD COLUMN idle_timeout_at TIMESTAMPTZ;

-- Create index for efficient timeout queries
CREATE INDEX CONCURRENTLY idx_runs_idle_timeout_at ON runs (idle_timeout_at) WHERE idle_timeout_at IS NOT NULL;