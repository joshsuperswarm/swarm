-- Allow multiple completed runs per task by dropping unique constraint
-- This migration allows multiple runs with the same mode for a task when they are completed
BEGIN;

-- Drop the unique constraint that prevents multiple runs per task per mode
DROP INDEX IF EXISTS idx_runs_unique_mode;

COMMIT;