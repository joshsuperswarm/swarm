-- Archive multiple tasks and return branch/repository info for branch deletion
UPDATE tasks 
SET is_archived = TRUE, updated_at = NOW()
WHERE id = ANY($1) AND user_id = $2
RETURNING 
    id as task_id,
    (
        SELECT r.branch 
        FROM runs r 
        WHERE r.task_id = tasks.id 
        ORDER BY r.created_at DESC 
        LIMIT 1
    ) as branch,
    (
        SELECT repo.owner
        FROM repositories repo
        WHERE repo.id = tasks.repository_id
    ) as repo_owner,
    (
        SELECT repo.name
        FROM repositories repo
        WHERE repo.id = tasks.repository_id
    ) as repo_name;