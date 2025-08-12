UPDATE tasks 
SET is_archived = TRUE, updated_at = NOW()
WHERE id = ANY($1) AND user_id = $2
RETURNING id;