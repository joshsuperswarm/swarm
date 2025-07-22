-- One row per task (its latest run)
SELECT DISTINCT ON (r.task_id)
       r.id           AS run_id,
       t.id           AS task_id,
       t.title,
       t.description,
       t.repository_id,
       t.user_id,
       -- surfaced run fields
       r.status,
       r.branch        AS github_branch,
       r.sandbox_id,
       r.sandbox_hostname,
       r.session_id,
       r.command_id,
       r.commit_title,
       r.commit_body,
       r.mode,         -- run mode (plan/execute/review)
       t.pr_title,     -- PR artifacts from task
       t.pr_body,      -- PR artifacts from task
       r.created_at,
       r.updated_at,
       t.github_pr_url -- still lives on task
FROM   tasks t
JOIN   runs  r ON r.task_id = t.id
WHERE  t.user_id = $1
ORDER  BY r.task_id, r.created_at DESC;