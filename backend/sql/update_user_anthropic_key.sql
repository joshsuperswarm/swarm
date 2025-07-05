UPDATE users 
SET anthropic_api_key = $2, updated_at = NOW() 
WHERE id = $1 
RETURNING *;