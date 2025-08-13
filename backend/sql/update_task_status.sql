UPDATE tasks 
SET status = $2, github_pr_url = $3, updated_at = NOW()
WHERE id = $1
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, pr_merged_at, is_archived, created_at, updated_at