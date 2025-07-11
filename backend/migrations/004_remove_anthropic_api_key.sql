-- Remove anthropic_api_key column from users table
-- The Anthropic API key is now configured as an environment variable
ALTER TABLE users DROP COLUMN IF EXISTS anthropic_api_key;