-- Add anthropic_api_key column to users table
-- This allows each user to store their own Anthropic API key for Claude Code integration
ALTER TABLE users ADD COLUMN anthropic_api_key TEXT;