-- Add unique constraint on task_id in runs table
-- This ensures each task can have at most one run record
ALTER TABLE runs ADD CONSTRAINT unique_runs_task_id UNIQUE (task_id);