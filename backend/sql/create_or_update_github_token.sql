INSERT INTO github_tokens (user_id, access_token, token_type, scope)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id) DO UPDATE SET
    access_token = EXCLUDED.access_token,
    token_type = EXCLUDED.token_type,
    scope = EXCLUDED.scope,
    updated_at = NOW()
RETURNING id, user_id, access_token, token_type, scope, created_at, updated_at