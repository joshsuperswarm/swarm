-- Create table for storing task execution logs
CREATE TABLE task_logs (
    id               BIGSERIAL PRIMARY KEY,
    task_id          INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    log_line         TEXT            NOT NULL,
    created_at       TIMESTAMPTZ     DEFAULT now()
);

-- Create index for efficient log queries by task
CREATE INDEX idx_task_logs_task_id ON task_logs(task_id);

-- Create index for efficient pagination (getting logs after specific ID)
CREATE INDEX idx_task_logs_task_id_id ON task_logs(task_id, id);