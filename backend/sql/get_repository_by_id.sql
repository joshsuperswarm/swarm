SELECT id, github_repo_id, owner, name, full_name, user_id, is_private, created_at, last_fetched_at
FROM repositories 
WHERE id = $1 AND user_id = $2