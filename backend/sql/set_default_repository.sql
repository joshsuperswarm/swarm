UPDATE users 
SET default_repo_id = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, anthropic_api_key, created_at, updated_at