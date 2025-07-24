-- 20250725_allow_multiple_completed_runs.sql
BEGIN;

-- 1) Drop the old index
DROP INDEX IF EXISTS idx_runs_unique_mode;

-- 2) Re-create it as partial:
CREATE UNIQUE INDEX idx_runs_unique_mode_active
       ON runs(task_id, mode)
    WHERE status IN ('pending','spinning','running');  -- adjust if you add more active states

COMMIT;