-- Remove PR fields from runs table as they should only exist on tasks
ALTER TABLE runs
DROP COLUMN pr_title,
DROP COLUMN pr_body;