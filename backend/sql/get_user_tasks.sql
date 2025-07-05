SELECT id, user_id, repository_id, title, description, status, github_pr_url, daytona_workspace_id, workspace_hostname, daytona_session_id, daytona_command_id, created_at, updated_at 
FROM tasks 
WHERE user_id = $1 
ORDER BY created_at DESC