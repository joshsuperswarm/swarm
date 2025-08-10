UPDATE users 
SET default_repo_id = $2, updated_at = NOW()
WHERE id = $1
RETURNING id, clerk_user_id, github_username, github_user_id, email, default_repo_id, onboarding_completed, onboarding_completed_at, onboarding_step, created_at, updated_at