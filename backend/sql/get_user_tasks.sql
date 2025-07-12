SELECT id, user_id, repository_id, title, description, status, github_pr_url, github_branch, sandbox_id, sandbox_hostname, session_id, command_id, commit_title, commit_body, pr_title, pr_body, created_at, updated_at 
FROM tasks 
WHERE user_id = $1 
ORDER BY created_at DESC