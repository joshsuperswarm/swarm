/* Insert the first run or update the existing run for the task */
INSERT INTO runs AS r (
  task_id,
  sandbox_id,
  sandbox_hostname,
  session_id,
  command_id,
  branch,
  status,
  commit_title,
  commit_body,
  pr_title,
  pr_body,
  created_at,
  updated_at
)
VALUES (
  $1,  -- task_id
  $2,  -- sandbox_id
  $3,  -- sandbox_hostname
  $4,  -- session_id
  $5,  -- command_id
  $6,  -- branch
  $7,  -- status
  $8,  -- commit_title
  $9,  -- commit_body
  $10, -- pr_title
  $11, -- pr_body
  NOW(), NOW())
ON CONFLICT (task_id) DO UPDATE SET
  sandbox_id       = EXCLUDED.sandbox_id,
  sandbox_hostname = EXCLUDED.sandbox_hostname,
  session_id       = EXCLUDED.session_id,
  command_id       = EXCLUDED.command_id,
  branch           = EXCLUDED.branch,
  status           = EXCLUDED.status,
  commit_title     = EXCLUDED.commit_title,
  commit_body      = EXCLUDED.commit_body,
  pr_title         = EXCLUDED.pr_title,
  pr_body          = EXCLUDED.pr_body,
  updated_at       = NOW()
RETURNING id, task_id, sandbox_id, sandbox_hostname,
          session_id, command_id, branch, status,
          commit_title, commit_body, pr_title, pr_body,
          created_at, updated_at;