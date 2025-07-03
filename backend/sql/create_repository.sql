INSERT INTO repositories (github_repo_id, owner, name, full_name, user_id, is_private)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (github_repo_id, user_id) DO UPDATE SET
    owner = EXCLUDED.owner,
    name = EXCLUDED.name,
    full_name = EXCLUDED.full_name,
    is_private = EXCLUDED.is_private
RETURNING id, github_repo_id, owner, name, full_name, user_id, is_private, created_at