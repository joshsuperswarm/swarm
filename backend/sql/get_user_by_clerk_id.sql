SELECT id, clerk_user_id, github_username, github_user_id, email, default_repo_id, onboarding_completed, onboarding_completed_at, onboarding_step, created_at, updated_at 
FROM users 
WHERE clerk_user_id = $1