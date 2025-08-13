-- description is now NULL; first prompt will be written to messages later
INSERT INTO tasks (user_id, repository_id, title)
VALUES ($1, $2, $3)
RETURNING id, user_id, repository_id, title,
         NULL::TEXT          AS description,
         status, github_pr_url,
         pr_title, pr_body, pr_merged_at, is_archived, created_at, updated_at