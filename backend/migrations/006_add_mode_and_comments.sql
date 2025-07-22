-- Add mode column to runs table
ALTER TABLE runs
ADD COLUMN mode TEXT NOT NULL DEFAULT 'execute';

-- Create unique constraint to ensure only one run per task per mode
CREATE UNIQUE INDEX idx_runs_unique_mode
ON runs(task_id, mode);

-- Create comments table for storing markdown artifacts
CREATE TABLE comments (
    id          BIGSERIAL PRIMARY KEY,
    task_id     INT  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    run_id      INT  NOT NULL REFERENCES runs(id)  ON DELETE CASCADE,
    mode        TEXT NOT NULL,             -- 'plan' | 'review'
    body_md     TEXT NOT NULL,
    sha         TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (task_id, run_id, mode)
);

-- Create index for efficient lookups by task_id
CREATE INDEX idx_comments_task_id ON comments(task_id);