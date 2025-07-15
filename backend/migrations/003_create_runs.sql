CREATE TABLE runs (
    id               SERIAL PRIMARY KEY,
    task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sandbox_id       TEXT,
    sandbox_hostname TEXT,
    session_id       TEXT,
    command_id       TEXT,
    branch           TEXT,
    status           VARCHAR(50) DEFAULT 'pending',
    commit_title     TEXT,
    commit_body      TEXT,
    pr_title         TEXT,
    pr_body          TEXT,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_runs_task_id   ON runs(task_id);
CREATE INDEX idx_runs_status    ON runs(status);