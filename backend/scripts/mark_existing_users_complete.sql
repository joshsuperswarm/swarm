-- Mark all existing users as having completed onboarding
-- Run this when deploying the onboarding feature to avoid forcing existing users through the flow

UPDATE users 
SET 
  onboarding_completed = true,
  onboarding_completed_at = NOW(),
  onboarding_step = NULL
WHERE onboarding_completed IS NULL OR onboarding_completed = false;