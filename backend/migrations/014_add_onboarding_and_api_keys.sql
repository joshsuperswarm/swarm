-- Migration to add onboarding and encrypted API keys support
-- user_api_keys holds encrypted API keys (envelope encryption: ciphertext + nonce)
CREATE TABLE IF NOT EXISTS user_api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anthropic_ciphertext TEXT,
  anthropic_nonce TEXT,
  openai_ciphertext TEXT,
  openai_nonce TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Onboarding status on users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT; -- 'api-keys' | 'default-repo' | NULL

-- Create index for better performance on onboarding queries
CREATE INDEX idx_users_onboarding_completed ON users(onboarding_completed);
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);