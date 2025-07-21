-- Remove obsolete columns from tasks table that were moved to runs table
-- These fields are now stored per-run in the runs table and accessed via TaskWithRun

ALTER TABLE tasks DROP COLUMN IF EXISTS sandbox_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS sandbox_hostname;
ALTER TABLE tasks DROP COLUMN IF EXISTS session_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS command_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS github_branch;
ALTER TABLE tasks DROP COLUMN IF EXISTS commit_title;
ALTER TABLE tasks DROP COLUMN IF EXISTS commit_body;

-- Keep task-level columns that are still needed:
-- - status (task-level status)
-- - github_pr_url (task-level PR URL)
-- - pr_title, pr_body (task-level PR artifacts)
-- - user_id, repository_id, title, description (core task data)
-- - created_at, updated_at (task timestamps)