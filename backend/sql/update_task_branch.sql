UPDATE tasks 
SET github_branch = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, github_branch, sandbox_id, sandbox_hostname, session_id, command_id, commit_title, commit_body, pr_title, pr_body, created_at, updated_at