INSERT INTO tasks (user_id, repository_id, title, description)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, github_branch, daytona_sandbox_id, sandbox_hostname, daytona_session_id, daytona_command_id, created_at, updated_at