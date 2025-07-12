UPDATE tasks
SET session_id = $2,
    command_id = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;