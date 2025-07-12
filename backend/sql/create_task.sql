INSERT INTO tasks (user_id, repository_id, title, description)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, github_branch, sandbox_id, sandbox_hostname, session_id, command_id, commit_title, commit_body, pr_title, pr_body, created_at, updated_at