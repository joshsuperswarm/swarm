SELECT id, user_id, access_token, token_type, scope, created_at, updated_at 
FROM github_tokens 
WHERE user_id = $1