BEGIN;
ALTER TABLE task_logs
  ADD COLUMN run_id INT REFERENCES runs(id);

CREATE INDEX IF NOT EXISTS idx_task_logs_run_id
  ON task_logs(run_id);

/* back-fill old rows with "latest run per task" */
WITH latest AS (
  SELECT task_id, max(id) AS run_id
    FROM runs
   GROUP BY task_id
)
UPDATE task_logs l
   SET run_id = latest.run_id
  FROM latest
 WHERE l.run_id IS NULL
   AND l.task_id = latest.task_id;
COMMIT;