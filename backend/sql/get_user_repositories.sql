SELECT 
    r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at, r.last_fetched_at,
    COUNT(t.id) as task_count
FROM repositories r
LEFT JOIN tasks t ON r.id = t.repository_id
WHERE r.user_id = $1
GROUP BY r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at, r.last_fetched_at
ORDER BY r.created_at DESC