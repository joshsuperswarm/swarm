UPDATE tasks
SET    title = $2,
       updated_at = NOW()
WHERE  id = $1
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, pr_title, pr_body, pr_merged_at, pr_closed_at, is_archived, created_at, updated_at;