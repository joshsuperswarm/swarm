UPDATE tasks 
SET status = $2, github_pr_url = $3, updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, daytona_workspace_id, workspace_hostname, daytona_session_id, daytona_command_id, created_at, updated_at