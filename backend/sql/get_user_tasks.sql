SELECT id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, created_at, updated_at 
FROM tasks 
WHERE user_id = $1 AND status != 'archived'
ORDER BY created_at DESC