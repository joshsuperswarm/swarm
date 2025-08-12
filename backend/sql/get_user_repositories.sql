SELECT 
    r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at, r.last_fetched_at, r.github_pushed_at,
    COUNT(t.id) as task_count
FROM repositories r
LEFT JOIN tasks t ON r.id = t.repository_id AND t.is_archived = FALSE
WHERE r.user_id = $1
GROUP BY r.id, r.github_repo_id, r.owner, r.name, r.full_name, r.is_private, r.created_at, r.last_fetched_at, r.github_pushed_at
ORDER BY r.github_pushed_at DESC NULLS LAST, r.created_at DESC