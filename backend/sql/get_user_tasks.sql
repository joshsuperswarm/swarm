SELECT id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, pr_merged_at, is_archived, created_at, updated_at 
FROM tasks 
WHERE user_id = $1 AND is_archived = FALSE
ORDER BY created_at DESC