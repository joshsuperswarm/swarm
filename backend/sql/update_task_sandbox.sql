UPDATE tasks 
SET daytona_sandbox_id = $2, sandbox_hostname = $3, status = $4, updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, daytona_sandbox_id, sandbox_hostname, daytona_session_id, daytona_command_id, created_at, updated_at