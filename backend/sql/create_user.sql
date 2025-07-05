INSERT INTO users (clerk_user_id, github_username, github_user_id, email)
VALUES ($1, $2, $3, $4)
RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, anthropic_api_key, created_at, updated_at