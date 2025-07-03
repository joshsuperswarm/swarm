UPDATE users 
SET github_username = $2, github_user_id = $3, updated_at = NOW()
WHERE id = $1
RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, created_at, updated_at