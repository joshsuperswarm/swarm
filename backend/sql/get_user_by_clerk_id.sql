SELECT id, clerk_user_id, github_username, github_user_id, email, default_repo_id, anthropic_api_key, created_at, updated_at 
FROM users 
WHERE clerk_user_id = $1