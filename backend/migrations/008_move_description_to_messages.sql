-- 008_move_description_to_messages.sql
-- Dep: 007_rename_comments_to_messages.sql
BEGIN;

-- Insert one 'user' message per task (first run only) for rows that still have a description
INSERT INTO messages (task_id, run_id, mode, body_md, sha, role, created_at)
SELECT  t.id,
        -- first run for the task (if any); fallback to 0 which violates FK so we filter
        r.id,
        'execute',                -- we treat the initial prompt as execute-mode context
        t.description,
        NULL,
        'user',
        t.created_at
FROM    tasks t
JOIN    runs  r ON r.task_id = t.id
WHERE   t.description IS NOT NULL
AND     r.id = (
          SELECT id FROM runs r2
          WHERE r2.task_id = t.id
          ORDER BY r2.created_at ASC
          LIMIT 1
        );

-- (optional) set description to NULL so app no longer shows stale data
UPDATE tasks SET description = NULL WHERE description IS NOT NULL;

COMMIT;