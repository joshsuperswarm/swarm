INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private, last_fetched_at)
VALUES ($1, $2, $3, $4, $5, $6, NOW())
ON CONFLICT (github_repo_id, user_id) DO UPDATE SET
    owner = EXCLUDED.owner,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    is_private = EXCLUDED.is_private,
    last_fetched_at = NOW()
RETURNING id, github_repo_id, owner, name, full_name, user_id, is_private, created_at, last_fetched_at