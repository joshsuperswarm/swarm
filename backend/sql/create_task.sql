INSERT INTO tasks (user_id, repository_id, title, description)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, repository_id, title, description, status, github_pr_url, daytona_workspace_id, workspace_hostname, created_at, updated_at