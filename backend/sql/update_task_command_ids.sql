UPDATE tasks
SET daytona_session_id = $2,
    daytona_command_id = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;