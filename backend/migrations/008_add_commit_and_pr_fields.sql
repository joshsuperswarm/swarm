-- Add commit and PR artifact fields to tasks table
ALTER TABLE tasks
ADD COLUMN commit_title TEXT,
ADD COLUMN commit_body TEXT,
ADD COLUMN pr_title TEXT,
ADD COLUMN pr_body TEXT;